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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Confirmar sesión
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);

    // 2. Confirmar que es administrador
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: callerRow, error: rolError } = await admin
      .from("usuarios").select("rol, iglesia_id").eq("email", caller.email).single();
    if (rolError || !callerRow || callerRow.rol !== "admin") {
      return json({ error: "Solo un administrador puede reiniciar contraseñas." }, 403);
    }
    // Consola general: un super admin (ver super_admins/soy_super_admin) puede restablecer la
    // contraseña de CUALQUIER iglesia, no solo la propia — esa es una de sus 4 acciones de soporte.
    const { data: esSuperAdmin } = await admin.from("super_admins").select("usuario_id").eq("usuario_id", caller.id).maybeSingle();

    // 3. Leer datos
    const body = await req.json();
    const id = String(body.id || "").trim();
    const password = String(body.password || "");
    if (!id) return json({ error: "Falta el usuario." }, 400);
    if (password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    // Fase 2+ (multi-iglesia): antes esto no revisaba de qué iglesia era el usuario objetivo — un
    // admin de CUALQUIER iglesia podía reiniciar la contraseña de alguien de OTRA iglesia con solo
    // conocer su id. Ahora, salvo que quien llama sea super admin, el objetivo tiene que ser de la
    // MISMA iglesia que el admin que llama.
    if (!esSuperAdmin) {
      const { data: objetivo } = await admin.from("usuarios").select("iglesia_id").eq("id", id).maybeSingle();
      if (!objetivo || objetivo.iglesia_id !== callerRow.iglesia_id) {
        return json({ error: "Ese usuario no pertenece a tu iglesia." }, 403);
      }
    }

    // 4. Actualizar la contraseña
    const { error: updError } = await admin.auth.admin.updateUser(id, { password });
    if (updError) return json({ error: "No se pudo actualizar la contraseña: " + updError.message }, 400);

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
