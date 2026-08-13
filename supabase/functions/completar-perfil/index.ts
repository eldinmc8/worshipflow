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

// Un admin puede invitar solo con correo+rol (sin nombre) — la persona invitada completa su propio
// nombre (y foto, si inició sesión con Google) la primera vez que entra. Esto NO puede hacerse con un
// simple update desde el cliente: la única política de UPDATE en "usuarios" es para administradores, así
// que cualquiera más necesita esta función. A propósito solo puede tocar nombre/foto_url/perfil_completo
// de SU PROPIA fila (nunca su rol ni la de otra persona) — el service role hace el UPDATE, pero filtrado
// siempre por el id de quien llama, tomado de su sesión, nunca del body.
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

    const body = await req.json();
    const nombre = String(body.nombre || "").trim();
    if (!nombre) return json({ error: "El nombre es obligatorio." }, 400);
    const fotoUrl = body.foto_url ? String(body.foto_url).trim() : null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await admin
      .from("usuarios")
      .update({ nombre, foto_url: fotoUrl, perfil_completo: true })
      .eq("id", caller.id)
      .select()
      .single();
    if (error) return json({ error: "No se pudo guardar el perfil: " + error.message }, 400);

    return json({ success: true, usuario: data }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
