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

const ROLES_VALIDOS = ["admin", "multimedia", "musico", "miembro", "supervisor"];
// A donde vuelve el navegador tras hacer clic en el enlace de invitación (con la sesión ya en el hash
// de la URL) — ahí AuthGate.jsx detecta type=invite y pide elegir contraseña antes de entrar a la app.
const APP_URL = "https://worshipflow-pearl.vercel.app/";

// Nombre temporal cuando el admin invita solo con correo (ej. "juan.perez99@gmail.com" → "Juan Perez99")
// — se reemplaza por el nombre real apenas la persona completa su perfil.
function nombreProvisionalDesdeCorreo(email: string): string {
  const local = email.split("@")[0] || "";
  const partes = local.split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1));
  return partes.join(" ") || "Sin nombre";
}

// Busca un usuario de Auth por correo recorriendo listUsers (no hay getUserByEmail en el admin API).
// Un equipo de iglesia tiene a lo sumo unos cientos de cuentas, así que un par de páginas alcanza.
async function buscarUsuarioAuthPorCorreo(admin: ReturnType<typeof createClient>, email: string) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const encontrado = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (encontrado) return encontrado;
    if (data.users.length < perPage) return null;
    page++;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Bootstrap: si todavía no existe NINGÚN usuario, se permite crear el primero (siempre como
    // admin) sin pedir sesión de administrador — porque todavía no puede existir ningún admin
    // que la dé. En cuanto exista un usuario, esta puerta se cierra sola para siempre.
    const { count } = await admin.from("usuarios").select("*", { count: "exact", head: true });
    const isBootstrap = (count ?? 0) === 0;

    if (!isBootstrap) {
      // 1. Confirmar que quien llama tiene sesión iniciada
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "No autorizado." }, 401);

      const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
      if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);

      // 2. Confirmar que quien llama es administrador
      const { data: callerRow, error: rolError } = await admin
        .from("usuarios").select("rol").eq("email", caller.email).single();
      if (rolError || !callerRow || callerRow.rol !== "admin") {
        return json({ error: "Solo un administrador puede crear usuarios." }, 403);
      }
    }

    // 3. Leer los datos del formulario. El nombre es opcional — un admin solo tiene que dar correo y
    // rol; la propia persona invitada completa su nombre (y foto, si entra con Google) al aceptar la
    // invitación (ver Edge Function completar-perfil y AuthGate.jsx → CompleteProfile). Mientras tanto
    // se guarda un nombre provisional derivado del correo, para que ninguna pantalla que asuma un
    // nombre no vacío (iniciales del avatar, listas...) se rompa antes de que lo complete.
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const nombreInput = String(body.nombre || "").trim();
    const rol = isBootstrap ? "admin" : (ROLES_VALIDOS.includes(body.rol) ? body.rol : "miembro");

    if (!email) return json({ error: "El correo es obligatorio." }, 400);
    if (isBootstrap && !nombreInput) return json({ error: "El nombre es obligatorio." }, 400);
    const nombre = nombreInput || nombreProvisionalDesdeCorreo(email);
    const perfilCompleto = isBootstrap || !!nombreInput;

    // 4. Revisar que el correo no exista ya
    const { data: yaExiste } = await admin
      .from("usuarios").select("email").eq("email", email).maybeSingle();
    if (yaExiste) return json({ error: "Ya existe un usuario con ese correo." }, 400);

    // 5. Crear el acceso (login). El primer administrador se crea con contraseña directa (todavía no
    // hay a quién mandarle un correo de invitación en el primer arranque de la app) — todos los demás
    // reciben una invitación por correo y eligen su propia contraseña al aceptarla.
    let newUserId: string;
    if (isBootstrap) {
      const password = String(body.password || "");
      if (!password || password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (createError || !created?.user) {
        return json({ error: "No se pudo crear el acceso: " + (createError?.message ?? "error") }, 400);
      }
      newUserId = created.user.id;
    } else {
      let { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: APP_URL,
      });

      // Si alguien probó "Continuar con Google" antes de ser invitado, Supabase Auth le crea igual una
      // cuenta (aunque AuthGate.jsx la rechace después por no tener fila en "usuarios") — eso deja un
      // correo "ya registrado" en Auth sin que exista en nuestra tabla. El paso 4 ya confirmó que este
      // correo NO tiene fila en "usuarios", así que cualquier cuenta de Auth con este correo es
      // justamente ese huérfano: se borra y se reintenta la invitación una sola vez.
      const yaRegistradoEnAuth = /already.*registered|email_exists/i.test(
        `${inviteError?.message ?? ""} ${(inviteError as { code?: string })?.code ?? ""}`
      );
      if (inviteError && yaRegistradoEnAuth) {
        const huerfano = await buscarUsuarioAuthPorCorreo(admin, email);
        if (huerfano) {
          await admin.auth.admin.deleteUser(huerfano.id);
          ({ data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
            redirectTo: APP_URL,
          }));
        }
      }

      if (inviteError || !invited?.user) {
        return json({ error: "No se pudo enviar la invitación: " + (inviteError?.message ?? "error") }, 400);
      }
      newUserId = invited.user.id;
    }

    // 6. Guardar la fila en usuarios (mismo id que auth.users, por eso el insert lo trae explícito)
    const { error: insertError } = await admin.from("usuarios").insert({
      id: newUserId, email, nombre, rol, estado: "activo", perfil_completo: perfilCompleto,
    });
    if (insertError) {
      await admin.auth.admin.deleteUser(newUserId);
      return json({ error: "No se pudo guardar el usuario: " + insertError.message }, 400);
    }

    return json({
      success: true,
      message: isBootstrap ? "Usuario creado correctamente." : "Invitación enviada por correo.",
      bootstrap: isBootstrap,
    }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
