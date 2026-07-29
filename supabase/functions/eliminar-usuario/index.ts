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
      return json({ error: "Solo un administrador puede eliminar usuarios." }, 403);
    }

    // 3. Leer el usuario a eliminar
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return json({ error: "Falta el usuario a eliminar." }, 400);

    const { data: urow, error: uErr } = await admin
      .from("usuarios").select("id, email").eq("id", id).maybeSingle();
    if (uErr || !urow) return json({ error: "No se encontró el usuario." }, 404);

    // 4. No permitir que un admin se elimine a sí mismo
    if ((urow.email || "").toLowerCase() === (caller.email || "").toLowerCase()) {
      return json({ error: "No puedes eliminar tu propia cuenta." }, 400);
    }

    // 5. Borrar el acceso (auth) — la fila de "usuarios" se borra sola por el
    // ON DELETE CASCADE de la referencia a auth.users(id).
    const { error: delAuthErr } = await admin.auth.admin.deleteUser(id);
    if (delAuthErr) return json({ error: "No se pudo eliminar el acceso: " + delAuthErr.message }, 400);

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
