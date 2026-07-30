import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

// Mismo helper que notificar-asignacion (cada Edge Function es un archivo independiente, sin código
// compartido entre ellas) — inserta la notificación in-app y, si hay llaves VAPID configuradas,
// también manda el Web Push real a cada dispositivo suscrito de ese usuario.
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
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
}

type Reminder = {
  id: string;
  evento_id: string;
  cantidad: number;
  unidad: "horas" | "dias";
  eventos: { fecha: string; hora: string | null; titulo: string } | null;
};

// La llama pg_cron cada 15 minutos (no un usuario) — por eso no hay sesión que verificar, sino un
// secreto compartido simple en el header (ver migración "programa_cron_recordatorios").
Deno.serve(async (req: Request) => {
  try {
    const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
    if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "No autorizado." }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: pendientes, error } = await admin
      .from("recordatorios_evento")
      .select("id, evento_id, cantidad, unidad, eventos(fecha, hora, titulo)")
      .eq("enviado", false)
      .returns<Reminder[]>();
    if (error) throw error;

    const ahora = Date.now();
    let procesados = 0;
    for (const r of pendientes ?? []) {
      const ev = r.eventos;
      if (!ev?.fecha) continue;
      // Sin hora definida en el evento, un recordatorio por horas no se puede calcular con
      // precisión — se deja pendiente (no se marca enviado) hasta que se le asigne una hora.
      if (r.unidad === "horas" && !ev.hora) continue;
      const inicio = new Date(`${ev.fecha}T${ev.hora || "00:00:00"}`).getTime();
      const msAntes = r.cantidad * (r.unidad === "horas" ? 3_600_000 : 86_400_000);
      if (ahora < inicio - msAntes) continue; // todavía no toca avisar

      // Todos los que tienen algo asignado en este evento: por ítem del Setlist y por rol del
      // equipo de alabanza (las dos formas en que miembros_rol vincula a una persona con un evento).
      const { data: items } = await admin.from("items_servicio").select("id").eq("evento_id", r.evento_id);
      const { data: roles } = await admin.from("roles_evento").select("id").eq("evento_id", r.evento_id);
      const itemIds = (items ?? []).map((i: { id: string }) => i.id);
      const roleIds = (roles ?? []).map((x: { id: string }) => x.id);
      const usuarioIds = new Set<string>();
      if (itemIds.length) {
        const { data: m1 } = await admin.from("miembros_rol").select("usuario_id").in("item_servicio_id", itemIds).not("usuario_id", "is", null);
        (m1 ?? []).forEach((m: { usuario_id: string }) => usuarioIds.add(m.usuario_id));
      }
      if (roleIds.length) {
        const { data: m2 } = await admin.from("miembros_rol").select("usuario_id").in("rol_id", roleIds).not("usuario_id", "is", null);
        (m2 ?? []).forEach((m: { usuario_id: string }) => usuarioIds.add(m.usuario_id));
      }

      const unidadLabel = r.unidad === "horas" ? "hora" : "día";
      const titulo = `Recordatorio: ${ev.titulo}`;
      const cuerpo = `Faltan ${r.cantidad} ${unidadLabel}${r.cantidad === 1 ? "" : "s"} para "${ev.titulo}".`;
      for (const usuarioId of usuarioIds) {
        await admin.from("notificaciones").insert({ usuario_id: usuarioId, tipo: "recordatorio", titulo, cuerpo, evento_id: r.evento_id });
        await enviarPush(admin, usuarioId, { title: titulo, body: cuerpo });
      }
      await admin.from("recordatorios_evento").update({ enviado: true }).eq("id", r.id);
      procesados++;
    }

    return json({ success: true, procesados }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
