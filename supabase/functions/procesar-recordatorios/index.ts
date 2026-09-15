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
      } else {
        // Antes esto se tragaba en silencio -- ahora al menos queda en los logs de la función para
        // poder ver si algo está fallando de forma repetida (ej. llaves VAPID vencidas).
        console.error(`enviarPush falló para usuario ${usuarioId}:`, e);
      }
    }
  }
}

// Todos los que tienen algo que ver con este evento: por ítem del Setlist, por rol del equipo de
// alabanza (las dos formas en que miembros_rol vincula a una persona con un evento), y el LÍDER de
// cualquier ministerio vinculado a un bloque del Setlist (items_servicio.ministerio_id) — antes se
// quedaba afuera si ese líder no tenía además una fila propia en miembros_rol para ese bloque, así
// que un líder de ministerio podía no enterarse nunca de un recordatorio de "su" evento.
async function usuariosDelEvento(admin: ReturnType<typeof createClient>, eventoId: string): Promise<Set<string>> {
  const { data: items } = await admin.from("items_servicio").select("id, ministerio_id").eq("evento_id", eventoId);
  const { data: roles } = await admin.from("roles_evento").select("id").eq("evento_id", eventoId);
  const itemIds = (items ?? []).map((i: { id: string }) => i.id);
  const roleIds = (roles ?? []).map((x: { id: string }) => x.id);
  const ministerioIds = [...new Set((items ?? []).map((i: { ministerio_id: string | null }) => i.ministerio_id).filter((id): id is string => !!id))];

  const usuarioIds = new Set<string>();
  if (itemIds.length) {
    const { data: m1 } = await admin.from("miembros_rol").select("usuario_id").in("item_servicio_id", itemIds).not("usuario_id", "is", null);
    (m1 ?? []).forEach((m: { usuario_id: string }) => usuarioIds.add(m.usuario_id));
  }
  if (roleIds.length) {
    const { data: m2 } = await admin.from("miembros_rol").select("usuario_id").in("rol_id", roleIds).not("usuario_id", "is", null);
    (m2 ?? []).forEach((m: { usuario_id: string }) => usuarioIds.add(m.usuario_id));
  }
  if (ministerioIds.length) {
    const { data: lideres } = await admin.from("ministerios").select("lider_id").in("id", ministerioIds).not("lider_id", "is", null);
    (lideres ?? []).forEach((m: { lider_id: string }) => usuarioIds.add(m.lider_id));
  }
  return usuarioIds;
}

type Reminder = {
  id: string;
  evento_id: string;
  cantidad: number;
  unidad: "horas" | "dias";
  eventos: { fecha: string; hora: string | null; titulo: string } | null;
};

// Guatemala no usa horario de verano, así que el offset es fijo todo el año -- no hace falta una
// librería de zonas horarias para esto, solo escribirlo explícito.
const OFFSET_GUATEMALA = "-06:00";

// La llama pg_cron cada 15 minutos (no un usuario) — por eso no hay sesión que verificar, sino un
// secreto compartido simple en el header (ver el cron job "procesar-recordatorios-evento").
Deno.serve(async (req: Request) => {
  try {
    const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
    if (req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "No autorizado." }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Ya no se filtra por "enviado" -- ver por qué en el bloque de abajo. El total de recordatorios de
    // esta iglesia es chico (unos pocos por evento), así que traerlos todos cada 15 min no pesa nada.
    const { data: pendientes, error } = await admin
      .from("recordatorios_evento")
      .select("id, evento_id, cantidad, unidad, eventos(fecha, hora, titulo)")
      .returns<Reminder[]>();
    if (error) throw error;

    const ahora = Date.now();
    let procesados = 0;
    const fallos: string[] = [];
    for (const r of pendientes ?? []) {
      const ev = r.eventos;
      if (!ev?.fecha) continue;
      // Sin hora definida en el evento, un recordatorio por horas no se puede calcular con
      // precisión — se deja pendiente hasta que se le asigne una hora.
      if (r.unidad === "horas" && !ev.hora) continue;
      // Sin offset explícito, "YYYY-MM-DDTHH:mm:ss" se interpreta como hora LOCAL DEL SERVIDOR (que en
      // Supabase Edge Functions corre en UTC) — no como la hora de la iglesia. Eso hacía que un evento
      // a las 10am (hora de Guatemala/El Salvador/Honduras, UTC-6) se calculara como si fuera 10am UTC,
      // es decir 6 horas antes de lo real, y los recordatorios avisaran mucho antes de tiempo. Con el
      // offset fijo -06:00 (estos países no usan horario de verano) el cálculo queda en la hora real.
      const inicio = new Date(`${ev.fecha}T${ev.hora || "00:00:00"}${OFFSET_GUATEMALA}`).getTime();
      // Una vez que el evento ya empezó, un recordatorio de "faltan X" ya no tiene sentido para nadie
      // más -- se le haya avisado a todos o no, no hay nada que "alcanzar a avisar" de un evento que
      // ya está pasando o pasó. Esto además acota el trabajo: sin esto, cada recordatorio de cada
      // evento de la historia se seguiría revisando cada 15 min para siempre.
      if (inicio <= ahora) continue;
      const msAntes = r.cantidad * (r.unidad === "horas" ? 3_600_000 : 86_400_000);
      if (ahora < inicio - msAntes) continue; // todavía no toca avisar

      const usuarioIds = await usuariosDelEvento(admin, r.evento_id);
      if (usuarioIds.size === 0) continue; // nadie asignado todavía -- se reintenta el próximo ciclo

      // ANTES: un solo booleano "enviado" por fila de recordatorios_evento, marcado una vez y para
      // siempre. Eso significaba que si alguien se agregaba al equipo del evento DESPUÉS de que ese
      // recordatorio ya se había disparado para los demás (muy común: roles que se van llenando en los
      // días antes del culto), esa persona se quedaba sin ese recordatorio para siempre -- no había
      // forma de "alcanzarla" en el siguiente ciclo, aunque siguiera pendiente según el reloj. Ahora se
      // rastrea A QUIÉN específicamente ya se le avisó de ESTE recordatorio puntual (recordatorio_id +
      // usuario_id), igual que ya hacía el aviso de "Confirma tu participación" más abajo con
      // avisos_confirmacion_enviados -- así, quien se agrega tarde sí recibe los recordatorios que
      // todavía sigan vigentes (el evento no haya empezado) en el próximo ciclo.
      const { data: yaNotificados } = await admin.from("recordatorio_notificados").select("usuario_id").eq("recordatorio_id", r.id);
      const yaNotificadosSet = new Set((yaNotificados ?? []).map((n: { usuario_id: string }) => n.usuario_id));
      const pendientesDeEste = [...usuarioIds].filter((id) => !yaNotificadosSet.has(id));
      if (pendientesDeEste.length === 0) continue; // ya se le avisó a todos los que hay hasta ahora

      const unidadLabel = r.unidad === "horas" ? "hora" : "día";
      const titulo = `Recordatorio: ${ev.titulo}`;
      const cuerpo = `Faltan ${r.cantidad} ${unidadLabel}${r.cantidad === 1 ? "" : "s"} para "${ev.titulo}".`;

      for (const usuarioId of pendientesDeEste) {
        try {
          const { error: insertErr } = await admin.from("notificaciones").insert({ usuario_id: usuarioId, tipo: "recordatorio", titulo, cuerpo, evento_id: r.evento_id });
          if (insertErr) throw insertErr;
          await enviarPush(admin, usuarioId, { title: titulo, body: cuerpo });
          await admin.from("recordatorio_notificados").insert({ recordatorio_id: r.id, usuario_id: usuarioId });
          procesados++;
        } catch (e) {
          const msg = `recordatorio ${r.id} / usuario ${usuarioId}: ${e instanceof Error ? e.message : String(e)}`;
          console.error(msg);
          fallos.push(msg);
        }
      }
    }

    // Segunda pasada, aparte de los recordatorios normales de arriba: a quien tenga un cargo en un
    // evento que empieza dentro de las próximas 24 horas y TODAVÍA no haya tocado "Te toca..." en la
    // app (sin fila en asignaciones_vistas), se le manda un aviso aparte insistiendo — una sola vez por
    // evento (se registra en avisos_confirmacion_enviados para no mandarlo de nuevo cada 15 minutos).
    // Así el admin no depende de acordarse de revisar los ojitos uno por uno.
    //
    // Si asignaciones_vistas/avisos_confirmacion_enviados todavía no existen (falta correr esa
    // migración), esta pasada se salta entera en vez de asumir "nadie ha visto nada" — sin esa tabla no
    // hay forma de recordar a quién ya se le avisó, y eso mandaría el mismo aviso cada 15 minutos.
    const VENTANA_MS = 24 * 3_600_000;
    const probe = await admin.from("avisos_confirmacion_enviados").select("evento_id").limit(1);
    const { data: eventosProximos } = probe.error
      ? { data: [] as { id: string; titulo: string; fecha: string; hora: string | null }[] }
      : await admin.from("eventos").select("id, titulo, fecha, hora").eq("es_plantilla", false).not("fecha", "is", null);

    let avisosConfirmacion = 0;
    for (const ev of eventosProximos ?? []) {
      const inicio = new Date(`${ev.fecha}T${ev.hora || "00:00:00"}${OFFSET_GUATEMALA}`).getTime();
      if (inicio < ahora || inicio > ahora + VENTANA_MS) continue;

      const usuarioIds = await usuariosDelEvento(admin, ev.id);
      if (usuarioIds.size === 0) continue;

      const { data: vistos } = await admin.from("asignaciones_vistas").select("usuario_id").eq("evento_id", ev.id);
      const vistosSet = new Set((vistos ?? []).map((v: { usuario_id: string }) => v.usuario_id));
      const { data: avisados } = await admin.from("avisos_confirmacion_enviados").select("usuario_id").eq("evento_id", ev.id);
      const avisadosSet = new Set((avisados ?? []).map((v: { usuario_id: string }) => v.usuario_id));

      const titulo = `Confirma tu participación: ${ev.titulo}`;
      const cuerpo = `Todavía no has confirmado que viste tu asignación para "${ev.titulo}". Ábrela y toca "Te toca..." para avisar que ya la viste.`;
      for (const usuarioId of usuarioIds) {
        if (vistosSet.has(usuarioId) || avisadosSet.has(usuarioId)) continue;
        try {
          const { error: insertErr } = await admin.from("notificaciones").insert({ usuario_id: usuarioId, tipo: "general", titulo, cuerpo, evento_id: ev.id });
          if (insertErr) throw insertErr;
          await enviarPush(admin, usuarioId, { title: titulo, body: cuerpo });
          await admin.from("avisos_confirmacion_enviados").insert({ evento_id: ev.id, usuario_id: usuarioId });
          avisosConfirmacion++;
        } catch (e) {
          console.error(`aviso confirmación evento ${ev.id} / usuario ${usuarioId}:`, e);
        }
      }
    }

    return json({ success: true, procesados, fallos, avisosConfirmacion }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
