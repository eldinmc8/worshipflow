import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

// Función interna: manda push real para notificaciones ya decididas por fuera de la app (hoy, un
// asistente que llama por SQL con net.http_post — ver el ejemplo en la migración
// 20261003000000_verificar_secreto_push_manual.sql). No pasa por sesión de usuario (verify_jwt en
// false), así que se autoriza con un secreto compartido — ver verificarSecreto() más abajo. El
// secreto YA NO vive en este código: antes de 2026-10-03 era una constante fija ("jbp-manual-push-
// ...") que quedó expuesta en un chat; ahora vive solo en Supabase Vault y esta función lo valida
// por RPC sin nunca leerlo ella misma.
async function verificarSecreto(admin: ReturnType<typeof createClient>, secreto: string | null): Promise<boolean> {
  if (!secreto) return false;
  const { data, error } = await admin.rpc("verificar_secreto_push", { p_secreto: secreto });
  if (error) {
    console.error("verificar_secreto_push falló:", error);
    return false;
  }
  return data === true;
}

async function enviarPush(
  admin: ReturnType<typeof createClient>,
  usuarioId: string,
  payload: { title: string; body: string },
) {
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");
  if (!vapidPublic || !vapidPrivate || !vapidSubject) return 0;
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const { data: subs } = await admin.from("push_subscriptions").select("*").eq("usuario_id", usuarioId);
  let enviados = 0;
  for (const sub of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      enviados++;
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        // Antes esto se tragaba en silencio -- ahora al menos queda en los logs de la función,
        // igual que ya hace procesar-recordatorios.
        console.error(`enviarPush falló para usuario ${usuarioId}:`, e);
      }
    }
  }
  return enviados;
}

Deno.serve(async (req: Request) => {
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const secreto = req.headers.get("x-manual-secret");
    if (!(await verificarSecreto(admin, secreto))) {
      return json({ error: "No autorizado." }, 401);
    }

    const body = await req.json();

    // Antes no exigía iglesia_id y mandaba push a cualquier usuario_id que le pasaran, sin revisar a
    // qué iglesia pertenece — ahora quien llama tiene que decir de qué iglesia son las notificaciones,
    // y cualquier usuario_id que no sea de ESA iglesia se descarta en vez de recibir el push.
    const iglesia_id = body.iglesia_id ? String(body.iglesia_id) : null;
    if (!iglesia_id) return json({ error: "Falta iglesia_id." }, 400);

    const notifs = Array.isArray(body.notificaciones) ? body.notificaciones : [];
    const usuarioIdsSolicitados = [...new Set(
      notifs.map((n: { usuario_id?: string }) => n.usuario_id).filter((id: unknown): id is string => typeof id === "string" && id.length > 0),
    )];

    let usuariosDeEstaIglesia = new Set<string>();
    if (usuarioIdsSolicitados.length) {
      const { data: filas, error: filasError } = await admin
        .from("usuarios").select("id").eq("iglesia_id", iglesia_id).in("id", usuarioIdsSolicitados);
      if (filasError) return json({ error: "No se pudo verificar la iglesia de los usuarios: " + filasError.message }, 500);
      usuariosDeEstaIglesia = new Set((filas ?? []).map((f: { id: string }) => f.id));
    }

    let totalDispositivos = 0;
    let usuariosProcesados = 0;
    let descartados = 0;
    for (const n of notifs) {
      if (!n.usuario_id || !n.titulo) continue;
      if (!usuariosDeEstaIglesia.has(n.usuario_id)) {
        descartados++;
        continue;
      }
      const enviados = await enviarPush(admin, n.usuario_id, { title: n.titulo, body: n.cuerpo || "" });
      totalDispositivos += enviados;
      usuariosProcesados++;
    }

    return json({ success: true, usuariosProcesados, totalDispositivos, descartados }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
