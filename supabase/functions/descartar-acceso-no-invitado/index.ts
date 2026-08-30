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

// Se llama desde AuthGate.jsx cuando alguien obtiene una sesión válida de Supabase (típicamente con
// "Continuar con Google") sin tener fila en "usuarios" — o sea, sin que un administrador lo haya
// invitado. Sin esto, Supabase Auth le deja igual la cuenta creada en auth.users aunque la app la
// rechace, y ese correo queda "ya registrado" para Auth: un administrador que después intente invitar
// a esa misma persona desde Usuarios se topa con un error confuso (ver crear-usuario/index.ts, que
// además se auto-repara solo si esto ya pasó antes de desplegar esta función).
//
// Solo puede borrar la cuenta que llama, y solo si esa cuenta NO tiene fila en "usuarios" — así no hay
// forma de usar esto para borrar una cuenta real.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);

    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: fila } = await admin.from("usuarios").select("id").eq("id", caller.id).maybeSingle();
    if (fila) return json({ error: "Esta cuenta sí está invitada, no se puede descartar." }, 400);

    const { error: delErr } = await admin.auth.admin.deleteUser(caller.id);
    if (delErr) return json({ error: delErr.message }, 400);

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
