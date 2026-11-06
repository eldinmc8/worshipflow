import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Misma regla que src/lib/passwordSegura.js (validarPassword), copiada aquí para que no se pueda
// saltar llamando a esta función directo. Si cambias una, cambia la otra.
const PASSWORDS_COMUNES = ["12345678", "123456789", "1234567890", "password", "password1", "contraseña", "contrasena", "qwerty123", "abc12345", "11111111", "00000000", "iloveyou", "jesus123", "jesucristo", "diosesamor", "aleluya1", "iglesia1", "admin123", "bienvenido"];
function errorPassword(p: string): string | null {
  if (p.length < 8) return "La contraseña necesita: al menos 8 caracteres.";
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p)) return "La contraseña necesita: al menos una letra.";
  if (!/\d/.test(p)) return "La contraseña necesita: al menos un número.";
  if (PASSWORDS_COMUNES.includes(p.toLowerCase()) || /^(.)\1+$/.test(p)) return "La contraseña necesita: que no sea una contraseña muy común.";
  return null;
}

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Fase 4 (SaaS): a diferencia de crear-usuario (que exige sesión de administrador, salvo el bootstrap
// de la toda la primera cuenta de toda la base), esta función es a propósito pública — no pide
// Authorization. Es la puerta de "una iglesia nueva se da de alta sola", así que por diseño cualquiera
// que tenga el enlace puede llamarla. El enlace mismo (src/CrearIglesia.jsx, ruta ?crear-iglesia) no
// está anunciado en ningún lado visible de la app — se comparte a mano mientras esto siga siendo una
// puerta controlada en vez de un lanzamiento público (decisión de Eldin, 2026-09-30).

// Deja "iglesia", "jesús el buen pastor", "Mi Iglesia 123!" -> "jesus-el-buen-pastor", "mi-iglesia-123"
// -- mismo criterio simple que cualquier slug de URL (sin libraries: NFD + quitar diacríticos cubre
// español de sobra para esto).
function slugify(texto: string): string {
  const base = texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quita acentos: é -> e
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "iglesia";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZONAS_VALIDAS = [
  "Etc/GMT+6", "America/Guatemala", "America/El_Salvador", "America/Tegucigalpa",
  "America/Managua", "America/Costa_Rica", "America/Mexico_City", "America/Bogota", "America/Lima",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json();

    // Sin un código de invitación válido, ni llegar a validar el resto — el enlace ?crear-iglesia
    // podría reenviarse a un tercero. Los códigos los crea Eldin desde la consola general (tabla
    // codigos_invitacion, solo accesible para super admin): puede haber VARIOS pendientes a la vez,
    // cada uno de un solo uso (pedido de Eldin, 2026-11-06).
    const codigoIngresado = String(body.codigo_invitacion || "").trim().toLowerCase();
    if (!codigoIngresado) return json({ error: "Falta el código de invitación." }, 403);
    const { data: invitacion } = await admin.from("codigos_invitacion").select("codigo, usado_at, vence_at").eq("codigo", codigoIngresado).maybeSingle();
    if (!invitacion) return json({ error: "Código de invitación incorrecto." }, 403);
    if (invitacion.usado_at) return json({ error: "Ese código de invitación ya se usó. Pide uno nuevo a quien te invitó." }, 403);
    if (invitacion.vence_at && new Date(invitacion.vence_at).getTime() < Date.now()) {
      return json({ error: "Ese código de invitación ya venció. Pide uno nuevo a quien te invitó." }, 403);
    }

    const iglesiaNombre = String(body.iglesia_nombre || "").trim();
    const zonaHoraria = ZONAS_VALIDAS.includes(body.zona_horaria) ? body.zona_horaria : "Etc/GMT+6";
    const adminNombre = String(body.admin_nombre || "").trim();
    const adminEmail = String(body.admin_email || "").trim().toLowerCase();
    const adminPassword = String(body.admin_password || "");

    if (!iglesiaNombre) return json({ error: "El nombre de la iglesia es obligatorio." }, 400);
    if (!adminNombre) return json({ error: "Tu nombre es obligatorio." }, 400);
    if (!EMAIL_RE.test(adminEmail)) return json({ error: "Correo inválido." }, 400);
    const errPassword = errorPassword(adminPassword);
    if (errPassword) return json({ error: errPassword }, 400);

    // Los correos son únicos en TODA la base (una sola fila por email en "usuarios", sin importar la
    // iglesia) -- igual que en crear-usuario. Una persona no puede fundar dos iglesias con el mismo
    // correo, ni "robarle" sin querer el correo a alguien que ya es miembro de otra.
    const { data: yaExiste } = await admin.from("usuarios").select("email").eq("email", adminEmail).maybeSingle();
    if (yaExiste) return json({ error: "Ya existe una cuenta con ese correo." }, 400);

    // Se gasta el código AQUÍ, antes de crear nada, solo si sigue sin usar — así dos personas con el
    // mismo código al mismo tiempo no pueden crear dos iglesias. Los demás códigos pendientes no se
    // tocan. Si algo de abajo falla, se libera para que puedan reintentar con el mismo.
    const { data: gastado } = await admin.from("codigos_invitacion").update({ usado_at: new Date().toISOString() })
      .eq("codigo", codigoIngresado).is("usado_at", null).gt("vence_at", new Date().toISOString()).select("codigo");
    if (!gastado?.length) return json({ error: "Ese código de invitación ya se usó. Pide uno nuevo a quien te invitó." }, 403);
    const fallar = async (mensaje: string, status: number) => {
      await admin.from("codigos_invitacion").update({ usado_at: null, iglesia_id: null }).eq("codigo", codigoIngresado);
      return json({ error: mensaje }, status);
    };

    // 1) Crear la iglesia -- reintenta con -2/-3/... si el slug generado ya existe (ej. dos iglesias
    // que se llaman "Fe y Esperanza" en ciudades distintas). 20 intentos es de sobra: si de verdad
    // chocaran tantas veces seguidas, algo más raro está pasando y es mejor fallar que reintentar para siempre.
    const base = slugify(iglesiaNombre);
    let iglesia: { id: string } | null = null;
    for (let intento = 0; intento < 20 && !iglesia; intento++) {
      const slug = intento === 0 ? base : `${base}-${intento + 1}`;
      const { data, error } = await admin
        .from("iglesias").insert({ nombre: iglesiaNombre, slug, zona_horaria: zonaHoraria }).select("id").single();
      if (!error) { iglesia = data; break; }
      if (error.code !== "23505") return await fallar("No se pudo crear la iglesia: " + error.message, 400);
      // 23505 = slug duplicado -- se reintenta con el siguiente sufijo, cualquier otro error corta de una.
    }
    if (!iglesia) return await fallar("No se pudo generar un identificador único para la iglesia, intenta con otro nombre.", 400);

    // 2) Crear el acceso del administrador -- con contraseña directa (igual que el bootstrap de
    // crear-usuario): no hay a quién mandarle un correo de invitación, es quien se está dando de alta.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
    });
    if (createError || !created?.user) {
      await admin.from("iglesias").delete().eq("id", iglesia.id);
      return await fallar("No se pudo crear el acceso: " + (createError?.message ?? "error"), 400);
    }

    // 3) Guardar la fila en usuarios, ya como admin de su propia iglesia nueva.
    const { error: insertError } = await admin.from("usuarios").insert({
      id: created.user.id, email: adminEmail, nombre: adminNombre, rol: "admin",
      estado: "activo", perfil_completo: true, iglesia_id: iglesia.id,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("iglesias").delete().eq("id", iglesia.id);
      return await fallar("No se pudo guardar el usuario: " + insertError.message, 400);
    }

    // 4) Sembrar los 5 roles de fábrica para esta iglesia -- a diferencia de los 3 pasos de arriba,
    // esto NO revierte toda la alta si falla: la cuenta y la iglesia ya quedaron completas y
    // funcionando sin esto (roles_app solo hace falta para la pantalla Ajustes → Roles, nada más
    // depende de que existan estas filas). Se deja en los logs para poder sembrarlas a mano si hiciera falta.
    const { error: rolesError } = await admin.rpc("sembrar_roles_default", { p_iglesia_id: iglesia.id });
    if (rolesError) console.error(`sembrar_roles_default falló para iglesia ${iglesia.id}:`, rolesError);

    // 5) Las 5 canciones de fábrica (ver migración 20261107000000_canciones_de_fabrica.sql) -- igual que
    // los roles: si falla, la iglesia queda funcionando con el cancionero vacío y queda en los logs.
    const { error: cancionesError } = await admin.rpc("sembrar_canciones_default", { p_iglesia_id: iglesia.id });
    if (cancionesError) console.error(`sembrar_canciones_default falló para iglesia ${iglesia.id}:`, cancionesError);

    // 6) Anotar qué iglesia usó el código (solo informativo para la consola).
    await admin.from("codigos_invitacion").update({ iglesia_id: iglesia.id }).eq("codigo", codigoIngresado);

    return json({ success: true, iglesia_id: iglesia.id }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
