import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    // Consola general (Fase: super admin): sin el código correcto, ni llegar a validar el resto —
    // antes cualquiera con el enlace ?crear-iglesia podía dar de alta una iglesia, y ese enlace podía
    // reenviarse a un tercero sin que Eldin se enterara. El código lo ve y cambia Eldin desde la
    // consola general (plataforma_config, solo accesible para super admin).
    const codigoIngresado = String(body.codigo_invitacion || "").trim();
    const { data: config } = await admin.from("plataforma_config").select("codigo_invitacion").eq("id", "default").maybeSingle();
    const codigoVigente = config?.codigo_invitacion;
    if (codigoVigente && codigoIngresado !== codigoVigente) {
      return json({ error: "Código de invitación incorrecto." }, 403);
    }

    const iglesiaNombre = String(body.iglesia_nombre || "").trim();
    const zonaHoraria = ZONAS_VALIDAS.includes(body.zona_horaria) ? body.zona_horaria : "Etc/GMT+6";
    const adminNombre = String(body.admin_nombre || "").trim();
    const adminEmail = String(body.admin_email || "").trim().toLowerCase();
    const adminPassword = String(body.admin_password || "");

    if (!iglesiaNombre) return json({ error: "El nombre de la iglesia es obligatorio." }, 400);
    if (!adminNombre) return json({ error: "Tu nombre es obligatorio." }, 400);
    if (!EMAIL_RE.test(adminEmail)) return json({ error: "Correo inválido." }, 400);
    if (adminPassword.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    // Los correos son únicos en TODA la base (una sola fila por email en "usuarios", sin importar la
    // iglesia) -- igual que en crear-usuario. Una persona no puede fundar dos iglesias con el mismo
    // correo, ni "robarle" sin querer el correo a alguien que ya es miembro de otra.
    const { data: yaExiste } = await admin.from("usuarios").select("email").eq("email", adminEmail).maybeSingle();
    if (yaExiste) return json({ error: "Ya existe una cuenta con ese correo." }, 400);

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
      if (error.code !== "23505") return json({ error: "No se pudo crear la iglesia: " + error.message }, 400);
      // 23505 = slug duplicado -- se reintenta con el siguiente sufijo, cualquier otro error corta de una.
    }
    if (!iglesia) return json({ error: "No se pudo generar un identificador único para la iglesia, intenta con otro nombre." }, 400);

    // 2) Crear el acceso del administrador -- con contraseña directa (igual que el bootstrap de
    // crear-usuario): no hay a quién mandarle un correo de invitación, es quien se está dando de alta.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: adminEmail, password: adminPassword, email_confirm: true,
    });
    if (createError || !created?.user) {
      await admin.from("iglesias").delete().eq("id", iglesia.id);
      return json({ error: "No se pudo crear el acceso: " + (createError?.message ?? "error") }, 400);
    }

    // 3) Guardar la fila en usuarios, ya como admin de su propia iglesia nueva.
    const { error: insertError } = await admin.from("usuarios").insert({
      id: created.user.id, email: adminEmail, nombre: adminNombre, rol: "admin",
      estado: "activo", perfil_completo: true, iglesia_id: iglesia.id,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("iglesias").delete().eq("id", iglesia.id);
      return json({ error: "No se pudo guardar el usuario: " + insertError.message }, 400);
    }

    // 4) Sembrar los 5 roles de fábrica para esta iglesia -- a diferencia de los 3 pasos de arriba,
    // esto NO revierte toda la alta si falla: la cuenta y la iglesia ya quedaron completas y
    // funcionando sin esto (roles_app solo hace falta para la pantalla Ajustes → Roles, nada más
    // depende de que existan estas filas). Se deja en los logs para poder sembrarlas a mano si hiciera falta.
    const { error: rolesError } = await admin.rpc("sembrar_roles_default", { p_iglesia_id: iglesia.id });
    if (rolesError) console.error(`sembrar_roles_default falló para iglesia ${iglesia.id}:`, rolesError);

    return json({ success: true, iglesia_id: iglesia.id }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
