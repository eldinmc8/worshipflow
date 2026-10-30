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

    // Pueden generar una notificación de asignación quienes pueden asignar gente en la app: el
    // administrador, un rol con permisos de Setlist/eventos/ministerios, o el líder de un grupo
    // (asigna encargados en los bloques vinculados a su grupo — 2026-10-30).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);
    const { data: callerRow } = await admin.from("usuarios").select("rol, rol_id, iglesia_id").eq("id", caller.id).single();
    if (!callerRow) return json({ error: "No autorizado." }, 403);
    let puedeAsignar = callerRow.rol === "admin";
    if (!puedeAsignar && callerRow.rol_id) {
      const { data: rolApp } = await admin.from("roles_app").select("permisos, protegido").eq("id", callerRow.rol_id).single();
      const p = rolApp?.permisos || {};
      puedeAsignar = !!(rolApp?.protegido || p.editar_eventos_setlist || p.editar_setlist || p.gestionar_eventos || p.gestionar_ministerios);
    }
    if (!puedeAsignar) {
      const { count } = await admin.from("ministerios").select("id", { count: "exact", head: true })
        .eq("lider_id", caller.id).eq("iglesia_id", callerRow.iglesia_id);
      puedeAsignar = (count ?? 0) > 0;
    }
    if (!puedeAsignar) return json({ error: "No tienes permiso para avisar asignaciones." }, 403);

    const body = await req.json();
    const usuario_id = String(body.usuario_id || "");
    const tipo = TIPOS_VALIDOS.includes(body.tipo) ? body.tipo : "general";
    const titulo = String(body.titulo || "").trim();
    const cuerpo = body.cuerpo ? String(body.cuerpo) : null;
    const evento_id = body.evento_id || null;
    if (!usuario_id) return json({ error: "Falta usuario_id." }, 400);
    if (!titulo) return json({ error: "Falta título." }, 400);

    // La notificación necesita SU iglesia_id explícito (ver el mismo problema arreglado en
    // crear-usuario) — se toma la del USUARIO QUE LA RECIBE, no la del admin que la manda, y de paso
    // sirve de chequeo: un admin no debería poder notificar a alguien de otra iglesia (no tendría
    // cómo haberlo visto en su propia app para asignarlo en primer lugar, pero por si acaso).
    const { data: destinatario } = await admin.from("usuarios").select("iglesia_id").eq("id", usuario_id).single();
    if (!destinatario || destinatario.iglesia_id !== callerRow.iglesia_id) {
      return json({ error: "Ese usuario no pertenece a tu iglesia." }, 403);
    }

    const { error: insertError } = await admin
      .from("notificaciones")
      .insert({ usuario_id, tipo, titulo, cuerpo, evento_id, iglesia_id: destinatario.iglesia_id });
    if (insertError) return json({ error: "No se pudo guardar la notificación: " + insertError.message }, 400);

    await enviarPush(admin, usuario_id, { title: titulo, body: cuerpo || "" });

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
