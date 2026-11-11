import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Buscar canciones en internet (pedido de Eldin, 2026-11-11). Un navegador no puede leer la página de
// otro sitio (el sitio no lo permite), así que esta función la trae y le devuelve el HTML a la app,
// que es la que lo lee (src/lib/cancionesWeb.js).
//
// A propósito NO es un "trae cualquier dirección": solo sabe pedir dos cosas a UN sitio fijo
// (acordes.lacuerda.net) — la página de búsqueda y la página de una canción — y la dirección la arma
// ella misma con piezas que valida. Solo responde a alguien con sesión iniciada en WorshipFlow.
const SITIO = "https://acordes.lacuerda.net";
const AGENTE = "WorshipFlow/1.0 (importador de canciones)";
const MAX_BYTES = 600_000;

async function traer(url: string): Promise<{ status: number; html: string }> {
  const res = await fetch(url, { headers: { "User-Agent": AGENTE, Accept: "text/html" }, redirect: "manual", signal: AbortSignal.timeout(12_000) });
  if (res.status !== 200) { await res.body?.cancel(); return { status: res.status, html: "" }; }
  const html = (await res.text()).slice(0, MAX_BYTES);
  return { status: 200, html };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);
    const callerClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);

    const body = await req.json();

    if (body.accion === "buscar") {
      const q = String(body.q || "").replace(/\s+/g, " ").trim().slice(0, 80);
      if (q.length < 2) return json({ error: "Escribe qué canción buscas." }, 400);
      const exp = encodeURIComponent(q);
      // Búsqueda general (título y artista). Si lo escrito es el nombre de un artista, el sitio manda a
      // la página del artista o lista artistas: ahí se repite buscando solo en títulos de canciones.
      let r = await traer(`${SITIO}/busca.php?exp=${exp}`);
      if (r.status !== 200 || !r.html.includes("<li id='r")) r = await traer(`${SITIO}/busca.php?exp=${exp}&canc=1`);
      if (r.status !== 200) return json({ error: "LaCuerda no respondió. Intenta de nuevo en un momento." }, 502);
      return json({ html: r.html }, 200);
    }

    if (body.accion === "cancion") {
      const ruta = String(body.ruta || "");
      const version = Number(body.version || 1);
      if (!/^[a-z0-9_-]{1,80}\/[a-z0-9_-]{1,120}$/.test(ruta) || !Number.isInteger(version) || version < 1 || version > 99) {
        return json({ error: "Esa canción no es válida." }, 400);
      }
      const r = await traer(`${SITIO}/${ruta}${version > 1 ? `-${version}` : ""}.shtml`);
      if (r.status === 404) return json({ error: "Esa canción ya no está en LaCuerda." }, 404);
      if (r.status !== 200) return json({ error: "LaCuerda no respondió. Intenta de nuevo en un momento." }, 502);
      return json({ html: r.html }, 200);
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    const lento = e instanceof DOMException && e.name === "TimeoutError";
    return json({ error: lento ? "LaCuerda tardó demasiado en responder. Intenta de nuevo." : "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, lento ? 504 : 500);
  }
});
