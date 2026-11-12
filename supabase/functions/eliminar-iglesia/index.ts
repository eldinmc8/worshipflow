import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Borrar una iglesia por completo desde la consola general (pedido de Eldin, 2026-11-12: "creé algunas
// de prueba y quiero poder borrarlas"). Solo el super admin de la plataforma. Para que no se borre una
// por error, quien llama tiene que mandar el NOMBRE exacto de la iglesia (lo escribe en la consola), y
// nunca se borra una iglesia que tenga un super admin adentro (la tuya).
//
// Qué se borra:
//  1. Los archivos de la iglesia en Storage (todos los buckets guardan bajo "<iglesia_id>/…").
//  2. La fila de iglesias: todas sus tablas caen en cascada (canciones, eventos, setlists, ministerios,
//     usuarios, sesión en vivo…). Los códigos de invitación quedan, con iglesia_id en null.
//  3. Las cuentas de Auth de sus usuarios — si no, ese correo quedaría "ya registrado" y no se podría
//     volver a invitar a la persona.
async function archivosDe(admin: ReturnType<typeof createClient>, bucket: string, carpeta: string): Promise<string[]> {
  const out: string[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(carpeta, { limit: 1000, offset: desde });
    if (error || !data?.length) break;
    for (const f of data) {
      const ruta = `${carpeta}/${f.name}`;
      if (f.id === null) out.push(...(await archivosDe(admin, bucket, ruta))); // es una carpeta
      else out.push(ruta);
    }
    if (data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);
    const callerClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);
    const { data: esSuper } = await callerClient.rpc("soy_super_admin");
    if (esSuper !== true) return json({ error: "Solo el administrador de la plataforma puede borrar iglesias." }, 403);

    const body = await req.json();
    const iglesiaId = String(body.iglesia_id || "");
    const confirmacion = String(body.confirmacion || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(iglesiaId)) return json({ error: "Falta la iglesia." }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: iglesia } = await admin.from("iglesias").select("id, nombre").eq("id", iglesiaId).maybeSingle();
    if (!iglesia) return json({ error: "Esa iglesia ya no existe." }, 404);
    if (confirmacion !== String(iglesia.nombre || "").trim()) return json({ error: "El nombre escrito no coincide con el de la iglesia. No se borró nada." }, 400);

    const { data: usuarios } = await admin.from("usuarios").select("id").eq("iglesia_id", iglesiaId);
    const ids = (usuarios || []).map((u: { id: string }) => u.id);
    if (ids.length) {
      const { data: supers } = await admin.from("super_admins").select("usuario_id").in("usuario_id", ids);
      if (supers?.length) return json({ error: "Esta iglesia tiene un administrador de la plataforma. No se puede borrar desde aquí." }, 400);
    }
    if (caller.id && ids.includes(caller.id)) return json({ error: "No puedes borrar tu propia iglesia." }, 400);

    // 1) Archivos.
    let archivos = 0;
    const { data: buckets } = await admin.storage.listBuckets();
    for (const b of buckets || []) {
      const rutas = await archivosDe(admin, b.id, iglesiaId);
      for (let i = 0; i < rutas.length; i += 100) {
        const { error } = await admin.storage.from(b.id).remove(rutas.slice(i, i + 100));
        if (!error) archivos += Math.min(100, rutas.length - i);
      }
    }

    // 2) La iglesia (y en cascada todo lo suyo).
    const { error: errIglesia } = await admin.from("iglesias").delete().eq("id", iglesiaId);
    if (errIglesia) return json({ error: "No se pudo borrar la iglesia: " + errIglesia.message }, 400);

    // 3) Las cuentas de Auth de su gente.
    let cuentas = 0;
    const fallidas: string[] = [];
    for (const id of ids) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error && !/not found/i.test(error.message)) fallidas.push(id); else cuentas++;
    }

    return json({ success: true, nombre: iglesia.nombre, usuarios: cuentas, archivos, cuentas_sin_borrar: fallidas.length }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
