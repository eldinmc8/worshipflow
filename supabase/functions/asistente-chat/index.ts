import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Mismo helper que notificar-asignacion/procesar-recordatorios (cada Edge Function es un archivo
// independiente, sin código compartido entre ellas) — inserta la notificación in-app y, si hay
// llaves VAPID configuradas, también manda el Web Push real a cada dispositivo suscrito.
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

// Resumen compacto de los últimos cultos ya creados (setlist + quién estuvo en cada cargo) — para
// que el modelo pueda reconocer el patrón semanal (Miércoles/Viernes/Domingo AM/PM, quién suele
// tocar qué) y replicarlo cuando le pidan algo como "arma los cultos de octubre". Sin esto, el
// asistente no tenía forma de saber que esos eventos existían siquiera.
async function resumenEventosPasados(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data: eventos } = await admin
    .from("eventos").select("id, titulo, fecha, hora")
    .eq("es_plantilla", false).order("fecha", { ascending: false }).limit(12);
  if (!eventos?.length) return "(todavía no hay eventos anteriores creados en la app)";

  const eventoIds = eventos.map((e: { id: string }) => e.id);
  const { data: items } = await admin
    .from("items_servicio").select("id, evento_id, orden, tipo, titulo, cancion_id, canciones(titulo)")
    .in("evento_id", eventoIds).order("orden");
  const { data: roles } = await admin.from("roles_evento").select("id, evento_id, nombre").in("evento_id", eventoIds);
  const itemIds = (items ?? []).map((i: { id: string }) => i.id);
  const roleIds = (roles ?? []).map((r: { id: string }) => r.id);
  const { data: m1 } = itemIds.length ? await admin.from("miembros_rol").select("item_servicio_id, nombre").in("item_servicio_id", itemIds) : { data: [] };
  const { data: m2 } = roleIds.length ? await admin.from("miembros_rol").select("rol_id, nombre").in("rol_id", roleIds) : { data: [] };

  const nombresPorItem = new Map<string, string[]>();
  (m1 ?? []).forEach((m: { item_servicio_id: string; nombre: string }) => {
    const arr = nombresPorItem.get(m.item_servicio_id) || [];
    arr.push(m.nombre);
    nombresPorItem.set(m.item_servicio_id, arr);
  });
  const nombresPorRol = new Map<string, string[]>();
  (m2 ?? []).forEach((m: { rol_id: string; nombre: string }) => {
    const arr = nombresPorRol.get(m.rol_id) || [];
    arr.push(m.nombre);
    nombresPorRol.set(m.rol_id, arr);
  });

  return eventos.map((ev: { id: string; titulo: string; fecha: string; hora: string | null }) => {
    const itemsDeEvento = (items ?? []).filter((i: { evento_id: string }) => i.evento_id === ev.id);
    const rolesDeEvento = (roles ?? []).filter((r: { evento_id: string }) => r.evento_id === ev.id);
    const itemsTxt = itemsDeEvento.map((it: { id: string; tipo: string; titulo: string | null; canciones: { titulo: string } | null }) => {
      const etiqueta = it.tipo === "cancion" ? `canción: ${it.canciones?.titulo || "?"}` : it.titulo ? `${it.tipo}: ${it.titulo}` : it.tipo;
      const gente = nombresPorItem.get(it.id);
      return gente?.length ? `${etiqueta} (${gente.join(", ")})` : etiqueta;
    }).join("; ");
    const rolesTxt = rolesDeEvento.map((r: { id: string; nombre: string }) => {
      const gente = nombresPorRol.get(r.id);
      return `${r.nombre}: ${gente?.length ? gente.join(", ") : "sin asignar"}`;
    }).join("; ");
    return `- "${ev.titulo}" (${ev.fecha}${ev.hora ? " " + ev.hora : ""}) — Setlist: ${itemsTxt || "(vacío)"} | Equipo: ${rolesTxt || "(vacío)"}`;
  }).join("\n");
}

// ---- Herramienta que el modelo usa para proponer un plan (nunca para ejecutarlo directo) ----
const PROPONER_CAMBIOS_TOOL = {
  name: "proponer_cambios",
  description:
    "Propone un plan concreto de uno o varios eventos para crear en WorshipFlow (por ejemplo, todos " +
    "los cultos de un mes de una vez) — cada uno con su setlist, asignaciones de personas reales, y " +
    "recordatorios. Esto NO ejecuta nada todavía — el administrador va a ver un resumen y debe " +
    "confirmarlo antes de que se guarde de verdad. Úsala solo cuando ya tengas todos los datos que " +
    "necesitas. Si falta algo importante, pregunta primero en texto normal en vez de inventar un " +
    "valor — especialmente NUNCA inventes un usuario_id ni un cancion_id que no esté en las listas " +
    "reales que se te dieron; si no encuentras a la persona o la canción, dilo.",
  input_schema: {
    type: "object",
    properties: {
      resumen: { type: "string", description: "Resumen breve y claro en español de todo lo que se va a crear (todos los eventos), para mostrarle al administrador antes de confirmar." },
      eventos: {
        type: "array",
        description: "Uno o varios eventos a crear en este mismo plan.",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            fecha: { type: "string", description: "YYYY-MM-DD" },
            hora: { type: "string", description: "HH:MM en 24h, opcional" },
            ubicacion: { type: "string" },
            items_setlist: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["bloque", "cancion", "biblia", "slide"] },
                  titulo: { type: "string", description: "para tipo bloque o slide" },
                  descripcion: { type: "string", description: "para tipo bloque" },
                  cancion_id: { type: "string", description: "para tipo cancion — debe ser un id real de la lista de canciones dada" },
                  referencia_biblia: { type: "string", description: "para tipo biblia, ej. 'Juan 3:16'" },
                  texto_biblia: { type: "string", description: "para tipo biblia, el texto del versículo si se conoce" },
                },
                required: ["tipo"],
              },
            },
            asignaciones: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  usuario_id: { type: "string", description: "id real de la lista de usuarios dada — nunca inventado" },
                  destino: { type: "string", enum: ["item_setlist", "equipo_alabanza"] },
                  item_setlist_indice: { type: "integer", description: "índice (empezando en 0) dentro de items_setlist de ESTE evento — requerido si destino=item_setlist" },
                  rol_alabanza_nombre: { type: "string", description: "nombre del rol de alabanza (ej. 'Piano', 'Guitarra') — requerido si destino=equipo_alabanza" },
                },
                required: ["usuario_id", "destino"],
              },
            },
            recordatorios: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  cantidad: { type: "integer" },
                  unidad: { type: "string", enum: ["horas", "dias"] },
                },
                required: ["cantidad", "unidad"],
              },
            },
          },
          required: ["titulo", "fecha"],
        },
      },
    },
    required: ["resumen", "eventos"],
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };

async function llamarClaude(
  messages: ChatMessage[],
  usuarios: { id: string; nombre: string }[],
  canciones: { id: string; titulo: string; artista: string | null }[],
  reglas: string,
  contextoEventosPasados: string,
) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta configurar ANTHROPIC_API_KEY en los secretos de esta función.");

  const listaUsuarios = usuarios.map((u) => `- ${u.nombre} (usuario_id: ${u.id})`).join("\n");
  const listaCanciones = canciones.map((c) => `- ${c.titulo}${c.artista ? ` (${c.artista})` : ""} (cancion_id: ${c.id})`).join("\n");

  const system =
    "Eres el asistente de WorshipFlow, una app para armar cultos de una iglesia. Ayudas al administrador " +
    "a crear eventos (cultos), armar su setlist (bloques, canciones, versículos, slides) y asignar personas " +
    "reales a cargos — conversando en español, de forma breve y directa. Puedes crear varios eventos de " +
    "una sola vez (ej. \"arma los cultos de octubre\") reconociendo el patrón de los eventos anteriores que " +
    "se te dan abajo. " +
    "Cuando tengas todo lo necesario para un plan concreto, llama a la herramienta proponer_cambios — no " +
    "describas el plan en texto Y la llames a la vez, usa la herramienta directamente. Si falta información " +
    "clave (fecha, quién va en qué), pregunta antes.\n\n" +
    (reglas.trim()
      ? `Reglas y excepciones fijas que estableció el administrador — SIEMPRE aplícalas sin que te las repita, incluso si la conversación no las menciona:\n${reglas.trim()}\n\n`
      : "") +
    `Últimos cultos ya creados en la app (úsalos para reconocer el patrón semanal — qué tipo de evento va cada día, quién suele estar en cada cargo — y replicarlo cuando te pidan armar eventos nuevos):\n${contextoEventosPasados}\n\n` +
    `Personas reales registradas en la app (usa SIEMPRE estos usuario_id exactos, nunca inventes uno):\n${listaUsuarios || "(no hay usuarios cargados)"}\n\n` +
    `Canciones reales en el cancionero (usa SIEMPRE estos cancion_id exactos):\n${listaCanciones || "(no hay canciones cargadas)"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [PROPONER_CAMBIOS_TOOL],
      tool_choice: { type: "auto" },
    }),
  });
  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`La API de Claude respondió ${res.status}: ${texto.slice(0, 300)}`);
  }
  return await res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Solo administradores reales pueden usar el asistente — mismo chequeo manual que
    // notificar-asignacion (no hay RLS para esto, se verifica a mano).
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No autorizado." }, 401);
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: "Sesión inválida." }, 401);
    const { data: callerRow } = await admin.from("usuarios").select("rol").eq("id", caller.id).single();
    if (!callerRow || callerRow.rol !== "admin") {
      return json({ error: "Solo un administrador puede usar el asistente." }, 403);
    }

    const body = await req.json();
    const mode = body.mode === "apply" ? "apply" : body.mode === "reglas_get" ? "reglas_get" : body.mode === "reglas_set" ? "reglas_set" : "chat";

    // ---- reglas: excepciones fijas que el admin escribe una vez y el asistente siempre respeta,
    // sin depender de ninguna conversación ni de que se le repitan cada vez ----
    if (mode === "reglas_get") {
      const { data } = await admin.from("asistente_config").select("reglas").eq("id", "default").maybeSingle();
      return json({ reglas: data?.reglas || "" }, 200);
    }
    if (mode === "reglas_set") {
      const reglas = typeof body.reglas === "string" ? body.reglas : "";
      const { error } = await admin.from("asistente_config").upsert({ id: "default", reglas, actualizado_en: new Date().toISOString(), actualizado_por: caller.id });
      if (error) return json({ error: "No se pudieron guardar las reglas: " + error.message }, 400);
      return json({ success: true }, 200);
    }

    // ---- mode "chat": una sola llamada a Claude, devuelve texto o un plan propuesto (sin guardar nada) ----
    if (mode === "chat") {
      const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
      if (!messages.length) return json({ error: "Falta el mensaje." }, 400);

      const [{ data: usuarios }, { data: canciones }, { data: config }, contexto] = await Promise.all([
        admin.from("usuarios").select("id, nombre").order("nombre"),
        admin.from("canciones").select("id, titulo, artista").order("titulo"),
        admin.from("asistente_config").select("reglas").eq("id", "default").maybeSingle(),
        resumenEventosPasados(admin),
      ]);

      const respuesta = await llamarClaude(messages, usuarios ?? [], canciones ?? [], config?.reglas || "", contexto);
      const bloques = respuesta.content ?? [];
      const toolUse = bloques.find((b: { type: string }) => b.type === "tool_use" && b.name === "proponer_cambios");
      if (toolUse) {
        return json({ tipo: "plan", plan: toolUse.input, resumen: toolUse.input?.resumen || "Plan propuesto." }, 200);
      }
      const texto = bloques.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
      return json({ tipo: "texto", texto: texto || "No entendí, ¿puedes reformular?" }, 200);
    }

    // ---- mode "apply": ejecuta el plan ya confirmado por el administrador, determinista, sin IA ----
    const plan = body.plan;
    const eventosPlan = Array.isArray(plan?.eventos) ? plan.eventos : [];
    if (!eventosPlan.length) return json({ error: "Plan inválido: no trae ningún evento." }, 400);

    const resultados: { evento_id: string; titulo: string }[] = [];
    const notificadosTotal: string[] = [];
    const avisos: string[] = [];
    let totalItems = 0, totalAsignaciones = 0, totalRecordatorios = 0;

    for (const evPlan of eventosPlan) {
      if (!evPlan.titulo || !evPlan.fecha) return json({ error: "Un evento del plan no trae título o fecha." }, 400);

      const eventoId = crypto.randomUUID();
      const { error: eventoErr } = await admin.from("eventos").insert({
        id: eventoId,
        titulo: evPlan.titulo,
        fecha: evPlan.fecha,
        hora: evPlan.hora || null,
        ubicacion: evPlan.ubicacion || null,
        creado_por: caller.id,
        es_plantilla: false,
      });
      if (eventoErr) return json({ error: `No se pudo crear el evento "${evPlan.titulo}": ` + eventoErr.message }, 400);

      // Ítems del setlist — mismas columnas base que itemServicioAFila en src/lib/eventos.js
      // (estructura/fondo_tipo/es_punto_bosquejo son NOT NULL con default, pero el default solo
      // aplica si se omiten en un insert de una sola fila — mejor mandarlas siempre).
      const itemIds: string[] = [];
      const itemsPlan = Array.isArray(evPlan.items_setlist) ? evPlan.items_setlist : [];
      for (let i = 0; i < itemsPlan.length; i++) {
        const it = itemsPlan[i];
        const id = crypto.randomUUID();
        const base = { id, evento_id: eventoId, orden: i, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false };
        let fila;
        if (it.tipo === "cancion") fila = { ...base, tipo: "cancion", cancion_id: it.cancion_id, tonalidad_override: null };
        else if (it.tipo === "biblia") fila = { ...base, tipo: "biblia", referencia: it.referencia_biblia || "", version_biblia: "RVR1960", texto_biblia: it.texto_biblia || "" };
        else if (it.tipo === "slide") fila = { ...base, tipo: "slide", titulo: it.titulo || "", subtitulo: "", fondo_color: "#1B2029", fondo_video_url: null, fondo_imagen_url: null };
        else fila = { ...base, tipo: "bloque", titulo: it.titulo || "Bloque", descripcion: it.descripcion || "", ministerio_id: null };
        const { error: itemErr } = await admin.from("items_servicio").insert(fila);
        if (itemErr) return json({ error: `No se pudo agregar el ítem ${i + 1} del setlist de "${evPlan.titulo}": ` + itemErr.message }, 400);
        itemIds.push(id);
      }

      // Asignaciones — mismo efecto que addEncargado/addWorshipRoleMember en PrototipoWorshipFlow.jsx:
      // insertar en miembros_rol Y notificar (in-app + push), no solo lo primero.
      const asignacionesPlan = Array.isArray(evPlan.asignaciones) ? evPlan.asignaciones : [];
      const rolesCreados = new Map<string, string>(); // nombre de rol -> rol_id, para no duplicar roles dentro del mismo evento
      let ordenRol = 0;
      for (const a of asignacionesPlan) {
        const { data: usuarioRow } = await admin.from("usuarios").select("id, nombre").eq("id", a.usuario_id).single();
        if (!usuarioRow) return json({ error: `usuario_id inválido en una asignación de "${evPlan.titulo}": ${a.usuario_id}` }, 400);

        if (a.destino === "item_setlist") {
          const itemServicioId = itemIds[a.item_setlist_indice];
          if (!itemServicioId) return json({ error: `Índice de ítem de setlist inválido en una asignación de "${evPlan.titulo}".` }, 400);
          const { error: mErr } = await admin.from("miembros_rol").insert({ id: crypto.randomUUID(), item_servicio_id: itemServicioId, nombre: usuarioRow.nombre, usuario_id: usuarioRow.id, estado: "pendiente", lead: false, orden: 0 });
          if (mErr) return json({ error: "No se pudo asignar a " + usuarioRow.nombre + ": " + mErr.message }, 400);
        } else {
          const nombreRol = a.rol_alabanza_nombre || "Equipo de alabanza";
          let rolId = rolesCreados.get(nombreRol.toLowerCase());
          if (!rolId) {
            rolId = crypto.randomUUID();
            const { error: rolErr } = await admin.from("roles_evento").insert({ id: rolId, evento_id: eventoId, nombre: nombreRol, orden: ordenRol++ });
            if (rolErr) return json({ error: "No se pudo crear el rol " + nombreRol + ": " + rolErr.message }, 400);
            rolesCreados.set(nombreRol.toLowerCase(), rolId);
          }
          const { error: mErr } = await admin.from("miembros_rol").insert({ id: crypto.randomUUID(), rol_id: rolId, nombre: usuarioRow.nombre, usuario_id: usuarioRow.id, estado: "pendiente", lead: false, orden: 0 });
          if (mErr) return json({ error: "No se pudo asignar a " + usuarioRow.nombre + ": " + mErr.message }, 400);
        }

        const titulo = `Te asignaron: ${evPlan.titulo}`;
        const cuerpo = `Quedaste a cargo de algo en "${evPlan.titulo}".`;
        await admin.from("notificaciones").insert({ usuario_id: usuarioRow.id, tipo: "asignacion", titulo, cuerpo, evento_id: eventoId });
        await enviarPush(admin, usuarioRow.id, { title: titulo, body: cuerpo });
        notificadosTotal.push(usuarioRow.nombre);
      }

      // Recordatorios
      const recordatoriosPlan = Array.isArray(evPlan.recordatorios) ? evPlan.recordatorios : [];
      for (const r of recordatoriosPlan) {
        const { error: rErr } = await admin.from("recordatorios_evento").insert({ id: crypto.randomUUID(), evento_id: eventoId, cantidad: r.cantidad, unidad: r.unidad, enviado: false });
        if (rErr) return json({ error: `No se pudo agregar un recordatorio a "${evPlan.titulo}": ` + rErr.message }, 400);
      }

      // Auto-verificación por evento: revisa lo que acaba de escribir (no accede a nada más) y avisa
      // si algo quedó incompleto en vez de asumir que salió bien.
      if (recordatoriosPlan.length === 0) {
        avisos.push(`"${evPlan.titulo}" quedó sin ningún recordatorio — nadie recibirá aviso antes del evento.`);
      }
      const { count: encargadosSinUsuario } = await admin
        .from("miembros_rol")
        .select("id", { count: "exact", head: true })
        .in("item_servicio_id", itemIds.length ? itemIds : ["00000000-0000-0000-0000-000000000000"])
        .is("usuario_id", null);
      if ((encargadosSinUsuario ?? 0) > 0) {
        avisos.push(`En "${evPlan.titulo}" algún encargado quedó sin cuenta de usuario vinculada — no le llegarán notificaciones.`);
      }

      resultados.push({ evento_id: eventoId, titulo: evPlan.titulo });
      totalItems += itemsPlan.length;
      totalAsignaciones += asignacionesPlan.length;
      totalRecordatorios += recordatoriosPlan.length;
    }

    return json({
      success: true,
      eventos: resultados,
      resumen: `Se ${resultados.length === 1 ? "creó" : "crearon"} ${resultados.length} evento(s): ${resultados.map((r) => r.titulo).join(", ")} — ${totalItems} ítem(s) de setlist, ${totalAsignaciones} asignación(es) y ${totalRecordatorios} recordatorio(s) en total.`,
      notificados: notificadosTotal,
      avisos,
    }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
