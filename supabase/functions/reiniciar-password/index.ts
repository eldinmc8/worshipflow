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
      .from("usuarios").select("rol").eq("email", caller.email).single();
    if (rolError || !callerRow || callerRow.rol !== "admin") {
      return json({ error: "Solo un administrador puede reiniciar contraseñas." }, 403);
    }

    // 3. Leer datos
    const body = await req.json();
    const id = String(body.id || "").trim();
    const password = String(body.password || "");
    if (!id) return json({ error: "Falta el usuario." }, 400);
    if (password.length < 6) return json({ error: "La contraseña debe tener al menos 6 caracteres." }, 400);

    // 4. Actualizar la contraseña
    const { error: updError } = await admin.auth.admin.updateUser(id, { password });
    if (updError) return json({ error: "No se pudo actualizar la contraseña: " + updError.message }, 400);

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
