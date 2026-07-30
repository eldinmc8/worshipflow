import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

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

const TIPOS_VALIDOS = ["asignacion", "recordatorio", "general"];

// Manda una notificación in-app (tabla notificaciones) y, si el usuario tiene algún dispositivo
// suscrito a push, también un Web Push real — usado tanto aquí (asignaciones) como por
// procesar-recordatorios (recordatorios programados). Si no hay llaves VAPID configuradas todavía,
// simplemente no manda push y deja la notificación in-app funcionando igual.
async function enviarPush(
  admin: ReturnType<typeof createClient>,
  usuarioId: string,
  payload: { title: string; body: string },
) {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("usuario_id", usuarioId);
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
    } catch (e) {
      // 404/410: el navegador dice que esa suscripción ya no existe (se desinstaló, expiró, etc.).
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
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

    // Solo administradores pueden generar una notificación de asignación — coincide con que solo
    // ellos pueden asignar encargados/roles de alabanza/líderes de ministerio en la app.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);
    const { data: callerRow } = await admin.from("usuarios").select("rol").eq("id", caller.id).single();
    if (!callerRow || callerRow.rol !== "admin") {
      return json({ error: "Solo un administrador puede hacer esto." }, 403);
    }

    const body = await req.json();
    const usuario_id = String(body.usuario_id || "");
    const tipo = TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : "general";
    const titulo = String(body.titulo || "").trim();
    const cuerpo = body.cuerpo ? String(body.cuerpo) : null;
    const evento_id = body.evento_id || null;
    if (!usuario_id) return json({ error: "Falta usuario_id." }, 400);
    if (!titulo) return json({ error: "Falta título." }, 400);

    const { error: insertError } = await admin
      .from("notificaciones")
      .insert({ usuario_id, tipo, titulo, cuerpo, evento_id });
    if (insertError) return json({ error: "No se pudo guardar la notificación: " + insertError.message }, 400);

    await enviarPush(admin, usuario_id, { title: titulo, body: cuerpo || "" });

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
