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

async function notificar(admin: ReturnType<typeof createClient>, usuarioId: string, tipo: string, titulo: string, cuerpo: string, eventoId: string | null) {
  await admin.from("notificaciones").insert({ usuario_id: usuarioId, tipo, titulo, cuerpo, evento_id: eventoId });
  await enviarPush(admin, usuarioId, { title: titulo, body: cuerpo });
}

// Contexto de los últimos cultos ya creados — CON sus ids reales (evento/ítem/miembro_rol/rol/
// recordatorio) para que el modelo pueda editarlos, borrarlos o duplicarlos con precisión, y sin
// ids para poder reconocer el patrón semanal y replicarlo al crear eventos nuevos. Antes esto solo
// traía nombres/títulos (sin ids), así que el asistente no tenía forma de referirse a algo que ya
// existía — solo podía crear cosas nuevas.
async function contextoEventos(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data: eventos } = await admin
    .from("eventos").select("id, titulo, fecha, hora")
    .eq("es_plantilla", false).order("fecha", { ascending: false }).limit(12);
  if (!eventos?.length) return "(todavía no hay eventos anteriores creados en la app)";

  const eventoIds = eventos.map((e: { id: string }) => e.id);
  const { data: items } = await admin
    .from("items_servicio").select("id, evento_id, orden, tipo, titulo, cancion_id, canciones(titulo)")
    .in("evento_id", eventoIds).order("orden");
  const { data: roles } = await admin.from("roles_evento").select("id, evento_id, nombre").in("evento_id", eventoIds);
  const { data: recordatorios } = await admin.from("recordatorios_evento").select("id, evento_id, cantidad, unidad").in("evento_id", eventoIds);
  const itemIds = (items ?? []).map((i: { id: string }) => i.id);
  const roleIds = (roles ?? []).map((r: { id: string }) => r.id);
  const { data: m1 } = itemIds.length ? await admin.from("miembros_rol").select("id, item_servicio_id, nombre").in("item_servicio_id", itemIds) : { data: [] };
  const { data: m2 } = roleIds.length ? await admin.from("miembros_rol").select("id, rol_id, nombre").in("rol_id", roleIds) : { data: [] };

  const miembrosPorItem = new Map<string, { id: string; nombre: string }[]>();
  (m1 ?? []).forEach((m: { id: string; item_servicio_id: string; nombre: string }) => {
    const arr = miembrosPorItem.get(m.item_servicio_id) || [];
    arr.push({ id: m.id, nombre: m.nombre });
    miembrosPorItem.set(m.item_servicio_id, arr);
  });
  const miembrosPorRol = new Map<string, { id: string; nombre: string }[]>();
  (m2 ?? []).forEach((m: { id: string; rol_id: string; nombre: string }) => {
    const arr = miembrosPorRol.get(m.rol_id) || [];
    arr.push({ id: m.id, nombre: m.nombre });
    miembrosPorRol.set(m.rol_id, arr);
  });

  return eventos.map((ev: { id: string; titulo: string; fecha: string; hora: string | null }) => {
    const itemsDeEvento = (items ?? []).filter((i: { evento_id: string }) => i.evento_id === ev.id);
    const rolesDeEvento = (roles ?? []).filter((r: { evento_id: string }) => r.evento_id === ev.id);
    const recDeEvento = (recordatorios ?? []).filter((r: { evento_id: string }) => r.evento_id === ev.id);
    const itemsTxt = itemsDeEvento.map((it: { id: string; tipo: string; titulo: string | null; canciones: { titulo: string } | null }) => {
      const etiqueta = it.tipo === "cancion" ? `canción: ${it.canciones?.titulo || "?"}` : it.titulo ? `${it.tipo}: ${it.titulo}` : it.tipo;
      const gente = miembrosPorItem.get(it.id);
      const genteTxt = gente?.length ? ` [encargados: ${gente.map((g) => `${g.nombre} (miembro_rol_id: ${g.id})`).join(", ")}]` : "";
      return `[item_id: ${it.id}] ${etiqueta}${genteTxt}`;
    }).join("; ");
    const rolesTxt = rolesDeEvento.map((r: { id: string; nombre: string }) => {
      const gente = miembrosPorRol.get(r.id);
      const genteTxt = gente?.length ? gente.map((g) => `${g.nombre} (miembro_rol_id: ${g.id})`).join(", ") : "sin asignar";
      return `${r.nombre} [rol_id: ${r.id}]: ${genteTxt}`;
    }).join("; ");
    const recTxt = recDeEvento.map((r: { id: string; cantidad: number; unidad: string }) => `${r.cantidad} ${r.unidad} antes [recordatorio_id: ${r.id}]`).join("; ");
    return `- [evento_id: ${ev.id}] "${ev.titulo}" (${ev.fecha}${ev.hora ? " " + ev.hora : ""})\n  Setlist: ${itemsTxt || "(vacío)"}\n  Equipo de alabanza: ${rolesTxt || "(vacío)"}\n  Recordatorios: ${recTxt || "(ninguno)"}`;
  }).join("\n");
}

// ---- Herramienta que el modelo usa para proponer un plan (nunca para ejecutarlo directo). Es una
// lista de "acciones" tipadas — crear, editar, borrar o duplicar eventos/ítems/asignaciones/
// recordatorios. Todas comparten un solo objeto flexible (no un esquema estricto por tipo) para que
// Claude pueda combinarlas libremente en un mismo plan; el ejecutor (más abajo) usa solo los campos
// que corresponden a cada "tipo". ----
const PROPONER_PLAN_TOOL = {
  name: "proponer_cambios",
  description:
    "Propone un plan concreto de acciones sobre WorshipFlow — crear, editar, borrar o duplicar " +
    "eventos, ítems del setlist, asignaciones de personas y recordatorios — en cualquier combinación. " +
    "Esto NO ejecuta nada todavía: el administrador ve un resumen claro (incluyendo explícito CUALQUIER " +
    "borrado) y debe confirmarlo antes de que se guarde de verdad. Úsala solo cuando ya tengas todos los " +
    "datos que necesitas — para editar/borrar/duplicar algo que ya existe, usa el evento_id/item_id/" +
    "miembro_rol_id/recordatorio_id REAL del contexto de abajo, nunca inventado; si no encuentras lo que " +
    "te piden editar/borrar, dilo en vez de adivinar.",
  input_schema: {
    type: "object",
    properties: {
      resumen: {
        type: "string",
        description: "Resumen breve y claro en español de TODAS las acciones del plan. Si el plan borra algo, dilo explícito y de entrada (ej. \"Esto va a ELIMINAR el evento X y todo su setlist\") — nunca lo escondas entre otros cambios.",
      },
      acciones: {
        type: "array",
        description: "Lista de acciones a aplicar en orden, hasta un máximo de 15 por plan.",
        items: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: [
                "crear_evento", "editar_evento", "eliminar_evento", "duplicar_evento",
                "agregar_item_setlist", "editar_item_setlist", "eliminar_item_setlist", "reordenar_setlist",
                "asignar_persona", "eliminar_asignacion",
                "agregar_recordatorio", "eliminar_recordatorio",
              ],
            },
            evento_id: { type: "string", description: "id real del evento — requerido en: editar_evento, eliminar_evento, duplicar_evento (el ORIGEN a clonar), agregar_item_setlist, reordenar_setlist, agregar_recordatorio" },
            titulo: { type: "string", description: "para crear_evento/editar_evento/duplicar_evento" },
            fecha: { type: "string", description: "YYYY-MM-DD — para crear_evento/editar_evento/duplicar_evento" },
            hora: { type: "string", description: "HH:MM 24h — para crear_evento/editar_evento/duplicar_evento" },
            ubicacion: { type: "string", description: "para crear_evento/editar_evento/duplicar_evento" },
            items_setlist: {
              type: "array",
              description: "SOLO para crear_evento — el setlist completo del evento nuevo.",
              items: {
                type: "object",
                properties: {
                  tipo: { type: "string", enum: ["bloque", "cancion", "biblia", "slide"] },
                  titulo: { type: "string" },
                  descripcion: { type: "string" },
                  cancion_id: { type: "string", description: "id real de la lista de canciones" },
                  referencia_biblia: { type: "string" },
                  texto_biblia: { type: "string" },
                },
                required: ["tipo"],
              },
            },
            asignaciones: {
              type: "array",
              description: "SOLO para crear_evento — asignaciones del evento nuevo (por índice dentro de items_setlist de esta misma acción). Para asignar a un evento/ítem YA EXISTENTE usa la acción asignar_persona en vez de esto.",
              items: {
                type: "object",
                properties: {
                  usuario_id: { type: "string" },
                  destino: { type: "string", enum: ["item_setlist", "equipo_alabanza"] },
                  item_setlist_indice: { type: "integer" },
                  rol_alabanza_nombre: { type: "string" },
                },
                required: ["usuario_id", "destino"],
              },
            },
            recordatorios: {
              type: "array",
              description: "SOLO para crear_evento — recordatorios del evento nuevo.",
              items: {
                type: "object",
                properties: { cantidad: { type: "integer" }, unidad: { type: "string", enum: ["horas", "dias"] } },
                required: ["cantidad", "unidad"],
              },
            },
            item_id: { type: "string", description: "id real del ítem del setlist — requerido en editar_item_setlist y eliminar_item_setlist" },
            item_tipo: { type: "string", enum: ["bloque", "cancion", "biblia", "slide"], description: "para agregar_item_setlist" },
            item_titulo: { type: "string", description: "para agregar_item_setlist / editar_item_setlist" },
            item_descripcion: { type: "string", description: "para agregar_item_setlist / editar_item_setlist" },
            item_cancion_id: { type: "string", description: "para agregar_item_setlist / editar_item_setlist, tipo cancion" },
            item_referencia_biblia: { type: "string", description: "para agregar_item_setlist / editar_item_setlist, tipo biblia" },
            item_texto_biblia: { type: "string", description: "para agregar_item_setlist / editar_item_setlist, tipo biblia" },
            item_ids_en_orden: { type: "array", items: { type: "string" }, description: "para reordenar_setlist — TODOS los item_id del evento, en el orden final deseado" },
            usuario_id: { type: "string", description: "para asignar_persona — id real de la lista de usuarios, nunca inventado" },
            destino: { type: "string", enum: ["item_setlist", "equipo_alabanza"], description: "para asignar_persona" },
            destino_item_id: { type: "string", description: "para asignar_persona con destino=item_setlist — item_id real ya existente" },
            rol_alabanza_nombre: { type: "string", description: "para asignar_persona con destino=equipo_alabanza — nombre del rol (ej. 'Piano'); si no existe en el evento se crea" },
            miembro_rol_id: { type: "string", description: "para eliminar_asignacion — id real de la fila de asignación a quitar" },
            cantidad: { type: "integer", description: "para agregar_recordatorio" },
            unidad: { type: "string", enum: ["horas", "dias"], description: "para agregar_recordatorio" },
            recordatorio_id: { type: "string", description: "para eliminar_recordatorio" },
          },
          required: ["tipo"],
        },
      },
    },
    required: ["resumen", "acciones"],
  },
};

type ChatMessage = { role: "user" | "assistant"; content: string };
// deno-lint-ignore no-explicit-any
type Accion = Record<string, any>;

async function llamarClaude(
  messages: ChatMessage[],
  usuarios: { id: string; nombre: string }[],
  canciones: { id: string; titulo: string; artista: string | null }[],
  reglas: string,
  contexto: string,
  imagen: { mediaType: string; data: string } | null,
) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Falta configurar ANTHROPIC_API_KEY en los secretos de esta función.");

  const listaUsuarios = usuarios.map((u) => `- ${u.nombre} (usuario_id: ${u.id})`).join("\n");
  const listaCanciones = canciones.map((c) => `- ${c.titulo}${c.artista ? ` (${c.artista})` : ""} (cancion_id: ${c.id})`).join("\n");

  const system =
    "Eres el asistente de WorshipFlow, una app para armar cultos de una iglesia. Ayudas al administrador " +
    "a crear, editar, borrar y duplicar eventos (cultos), su setlist (bloques, canciones, versículos, " +
    "slides), asignaciones de personas reales a cargos, y recordatorios — conversando en español, de " +
    "forma breve y directa. Puedes combinar varias acciones en un mismo plan (ej. crear varios eventos " +
    "de una vez, o editar uno y borrar otro a la vez). " +
    "Cuando tengas todo lo necesario para un plan concreto, llama a la herramienta proponer_cambios — no " +
    "describas el plan en texto Y la llames a la vez, usa la herramienta directamente. Si falta información " +
    "clave, o no encuentras algo que te piden editar/borrar/duplicar, pregunta antes en vez de adivinar. " +
    "IMPORTANTE — nunca incluyas más de 15 acciones en un solo plan, sin importar cuántas te pidan: si te " +
    "piden algo grande (ej. \"todo octubre\", que puede ser 16-17 cultos), arma la primera tanda nada más, " +
    "dile al administrador en el resumen que es la primera parte y que puede pedirte \"continúa con el " +
    "resto\" para la siguiente tanda. Una respuesta con demasiadas acciones a la vez se corta a la mitad y " +
    "el plan entero se pierde — mejor repartido en varias tandas chicas y confiables que uno grande que " +
    "falla. Y SIEMPRE que el plan incluya borrar algo, dilo explícito y de entrada en el resumen — un " +
    "borrado es irreversible, el administrador tiene que verlo venir claro antes de confirmar.\n\n" +
    (reglas.trim()
      ? `Reglas y excepciones fijas que estableció el administrador — SIEMPRE aplícalas sin que te las repita, incluso si la conversación no las menciona:\n${reglas.trim()}\n\n`
      : "") +
    `Eventos ya existentes en la app, con sus ids reales de evento/ítem/asignación/recordatorio (úsalos para editar/borrar/duplicar con precisión, y para reconocer el patrón semanal al crear eventos nuevos):\n${contexto}\n\n` +
    `Personas reales registradas en la app (usa SIEMPRE estos usuario_id exactos, nunca inventes uno):\n${listaUsuarios || "(no hay usuarios cargados)"}\n\n` +
    `Canciones reales en el cancionero (usa SIEMPRE estos cancion_id exactos):\n${listaCanciones || "(no hay canciones cargadas)"}` +
    (imagen
      ? "\n\nEl administrador adjuntó una imagen en su último mensaje (ej. una foto de una lista de canciones escrita a mano, una nota, una captura). Léela y úsala como contexto — si es una lista de títulos de canciones, búscalos en el cancionero real de arriba por nombre (aunque estén mal escritos o abreviados) y usa su cancion_id real; si algún título no se parece a ninguna canción real, dilo en vez de inventar un id."
      : "");

  // El adjunto (si hay) va SOLO en el último mensaje del historial — los turnos anteriores ya se
  // guardaron como texto plano nada más (ver enviarMensajeAsistente), así que la imagen nunca se
  // vuelve a re-enviar en turnos futuros.
  const anthropicMessages = messages.map((m, i) => {
    const esUltimo = i === messages.length - 1;
    if (esUltimo && imagen && m.role === "user") {
      return {
        role: m.role,
        content: [
          { type: "image", source: { type: "base64", media_type: imagen.mediaType, data: imagen.data } },
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      // Un plan de varias acciones completas es bastante JSON — con un límite chico la respuesta se
      // corta a la mitad de generar el plan: el resumen en texto (que se genera primero) sale
      // completo y convincente, pero el arreglo "acciones" de verdad queda vacío o incompleto, sin
      // ningún aviso. Ver también el tope de "máximo 15 acciones por plan" en el system prompt —
      // ambos trabajan juntos para que esto no vuelva a pasar.
      max_tokens: 8192,
      system,
      messages: anthropicMessages,
      tools: [PROPONER_PLAN_TOOL],
      tool_choice: { type: "auto" },
    }),
  });
  if (!res.ok) {
    const texto = await res.text();
    throw new Error(`La API de Claude respondió ${res.status}: ${texto.slice(0, 300)}`);
  }
  const respuesta = await res.json();
  // Si se cortó por llegar al tope de tokens, cualquier plan que haya alcanzado a generar puede
  // estar incompleto (ej. el arreglo de acciones a medio llenar) — mejor avisar claro que dejar
  // pasar un plan roto que en "Aplicar" fallaría con un error críptico o, peor, se aplicaría a medias.
  if (respuesta.stop_reason === "max_tokens") {
    throw new Error("La respuesta del asistente se cortó por ser demasiado larga — pídele menos acciones a la vez (ej. una semana en vez de un mes completo).");
  }
  return respuesta;
}

async function crearItemsSetlist(admin: ReturnType<typeof createClient>, eventoId: string, itemsPlan: Accion[]): Promise<string[]> {
  const itemIds: string[] = [];
  for (let i = 0; i < itemsPlan.length; i++) {
    const it = itemsPlan[i];
    const id = crypto.randomUUID();
    const base = { id, evento_id: eventoId, orden: i, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false };
    let fila;
    if (it.tipo === "cancion") fila = { ...base, tipo: "cancion", cancion_id: it.cancion_id, tonalidad_override: null };
    else if (it.tipo === "biblia") fila = { ...base, tipo: "biblia", referencia: it.referencia_biblia || "", version_biblia: "RVR1960", texto_biblia: it.texto_biblia || "" };
    else if (it.tipo === "slide") fila = { ...base, tipo: "slide", titulo: it.titulo || "", subtitulo: "", fondo_color: "#1B2029", fondo_video_url: null, fondo_imagen_url: null };
    else fila = { ...base, tipo: "bloque", titulo: it.titulo || "Bloque", descripcion: it.descripcion || "", ministerio_id: null };
    const { error } = await admin.from("items_servicio").insert(fila);
    if (error) throw new Error(`No se pudo agregar un ítem del setlist: ${error.message}`);
    itemIds.push(id);
  }
  return itemIds;
}

// Ejecuta todas las acciones del plan, una por una — separado de Deno.serve a propósito para poder
// correrlo bajo EdgeRuntime.waitUntil (ver más abajo), es decir DESPUÉS de que la respuesta HTTP ya
// se le mandó al administrador, en vez de tenerlo esperando con la conexión abierta hasta que
// termine. Por eso lanza errores (throw) en vez de responder con json() directo — quien la llama
// decide qué hacer con el resultado (acá: mandar una notificación de éxito o de falla).
async function ejecutarAcciones(admin: ReturnType<typeof createClient>, callerId: string, acciones: Accion[]) {
  const notificadosTotal: string[] = [];
  const avisos: string[] = [];
  const eventosCreadosOTocados = new Set<string>();
  let totalAcciones = 0;

  for (const a of acciones) {
    if (a.tipo === "crear_evento") {
      if (!a.titulo || !a.fecha) throw new Error("Un evento del plan no trae título o fecha.");
      const eventoId = crypto.randomUUID();
      const { error: eErr } = await admin.from("eventos").insert({ id: eventoId, titulo: a.titulo, fecha: a.fecha, hora: a.hora || null, ubicacion: a.ubicacion || null, creado_por: callerId, es_plantilla: false });
      if (eErr) throw new Error(`No se pudo crear el evento "${a.titulo}": ${eErr.message}`);

      const itemsPlan = Array.isArray(a.items_setlist) ? a.items_setlist : [];
      const itemIds = await crearItemsSetlist(admin, eventoId, itemsPlan);

      const asignacionesPlan = Array.isArray(a.asignaciones) ? a.asignaciones : [];
      const rolesCreados = new Map<string, string>();
      let ordenRol = 0;
      for (const asig of asignacionesPlan) {
        const { data: usuarioRow } = await admin.from("usuarios").select("id, nombre").eq("id", asig.usuario_id).single();
        if (!usuarioRow) throw new Error(`usuario_id inválido en una asignación de "${a.titulo}": ${asig.usuario_id}`);
        if (asig.destino === "item_setlist") {
          const itemServicioId = itemIds[asig.item_setlist_indice];
          if (!itemServicioId) throw new Error(`Índice de ítem de setlist inválido en una asignación de "${a.titulo}".`);
          const { error } = await admin.from("miembros_rol").insert({ id: crypto.randomUUID(), item_servicio_id: itemServicioId, nombre: usuarioRow.nombre, usuario_id: usuarioRow.id, estado: "pendiente", lead: false, orden: 0 });
          if (error) throw new Error(`No se pudo asignar a ${usuarioRow.nombre}: ${error.message}`);
        } else {
          const nombreRol = asig.rol_alabanza_nombre || "Equipo de alabanza";
          let rolId = rolesCreados.get(nombreRol.toLowerCase());
          if (!rolId) {
            rolId = crypto.randomUUID();
            const { error } = await admin.from("roles_evento").insert({ id: rolId, evento_id: eventoId, nombre: nombreRol, orden: ordenRol++ });
            if (error) throw new Error(`No se pudo crear el rol ${nombreRol}: ${error.message}`);
            rolesCreados.set(nombreRol.toLowerCase(), rolId);
          }
          const { error } = await admin.from("miembros_rol").insert({ id: crypto.randomUUID(), rol_id: rolId, nombre: usuarioRow.nombre, usuario_id: usuarioRow.id, estado: "pendiente", lead: false, orden: 0 });
          if (error) throw new Error(`No se pudo asignar a ${usuarioRow.nombre}: ${error.message}`);
        }
        await notificar(admin, usuarioRow.id, "asignacion", `Te asignaron: ${a.titulo}`, `Quedaste a cargo de algo en "${a.titulo}".`, eventoId);
        notificadosTotal.push(usuarioRow.nombre);
      }

      const recordatoriosPlan = Array.isArray(a.recordatorios) ? a.recordatorios : [];
      for (const r of recordatoriosPlan) {
        const { error } = await admin.from("recordatorios_evento").insert({ id: crypto.randomUUID(), evento_id: eventoId, cantidad: r.cantidad, unidad: r.unidad, enviado: false });
        if (error) throw new Error(`No se pudo agregar un recordatorio a "${a.titulo}": ${error.message}`);
      }

      eventosCreadosOTocados.add(eventoId);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "editar_evento") {
      if (!a.evento_id) throw new Error("Falta evento_id en una acción editar_evento.");
      const patch: Record<string, unknown> = {};
      if (a.titulo) patch.titulo = a.titulo;
      if (a.fecha) patch.fecha = a.fecha;
      if (a.hora !== undefined) patch.hora = a.hora || null;
      if (a.ubicacion !== undefined) patch.ubicacion = a.ubicacion || null;
      const { error } = await admin.from("eventos").update(patch).eq("id", a.evento_id);
      if (error) throw new Error(`No se pudo editar el evento: ${error.message}`);
      eventosCreadosOTocados.add(a.evento_id);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "eliminar_evento") {
      if (!a.evento_id) throw new Error("Falta evento_id en una acción eliminar_evento.");
      const { error } = await admin.from("eventos").delete().eq("id", a.evento_id);
      if (error) throw new Error(`No se pudo eliminar el evento: ${error.message}`);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "duplicar_evento") {
      if (!a.evento_id || !a.titulo || !a.fecha) throw new Error("Falta evento_id (origen), título o fecha en una acción duplicar_evento.");
      const nuevoEventoId = crypto.randomUUID();
      const { error: eErr } = await admin.from("eventos").insert({ id: nuevoEventoId, titulo: a.titulo, fecha: a.fecha, hora: a.hora || null, ubicacion: a.ubicacion || null, creado_por: callerId, es_plantilla: false });
      if (eErr) throw new Error(`No se pudo crear el evento duplicado: ${eErr.message}`);

      const { data: itemsOrigen } = await admin.from("items_servicio").select("*").eq("evento_id", a.evento_id).order("orden");
      const mapaItemIds = new Map<string, string>();
      for (const it of itemsOrigen ?? []) {
        const nuevoId = crypto.randomUUID();
        mapaItemIds.set(it.id, nuevoId);
        const { id: _id, evento_id: _e, created_at: _c, ...resto } = it as Record<string, unknown>;
        const { error } = await admin.from("items_servicio").insert({ ...resto, id: nuevoId, evento_id: nuevoEventoId });
        if (error) throw new Error(`No se pudo clonar un ítem del setlist: ${error.message}`);
      }
      if (mapaItemIds.size) {
        const { data: encargadosOrigen } = await admin.from("miembros_rol").select("*").in("item_servicio_id", [...mapaItemIds.keys()]);
        for (const m of encargadosOrigen ?? []) {
          const { id: _id, item_servicio_id, ...resto } = m as Record<string, unknown>;
          const { error } = await admin.from("miembros_rol").insert({ ...resto, id: crypto.randomUUID(), item_servicio_id: mapaItemIds.get(item_servicio_id as string), estado: "pendiente" });
          if (error) throw new Error(`No se pudo clonar un encargado: ${error.message}`);
        }
      }
      const { data: rolesOrigen } = await admin.from("roles_evento").select("*").eq("evento_id", a.evento_id).order("orden");
      const mapaRolIds = new Map<string, string>();
      for (const r of rolesOrigen ?? []) {
        const nuevoId = crypto.randomUUID();
        mapaRolIds.set(r.id, nuevoId);
        const { id: _id, evento_id: _e, ...resto } = r as Record<string, unknown>;
        const { error } = await admin.from("roles_evento").insert({ ...resto, id: nuevoId, evento_id: nuevoEventoId });
        if (error) throw new Error(`No se pudo clonar un rol de alabanza: ${error.message}`);
      }
      if (mapaRolIds.size) {
        const { data: miembrosOrigen } = await admin.from("miembros_rol").select("*").in("rol_id", [...mapaRolIds.keys()]);
        for (const m of miembrosOrigen ?? []) {
          const { id: _id, rol_id, ...resto } = m as Record<string, unknown>;
          const { error } = await admin.from("miembros_rol").insert({ ...resto, id: crypto.randomUUID(), rol_id: mapaRolIds.get(rol_id as string), estado: "pendiente" });
          if (error) throw new Error(`No se pudo clonar un miembro del equipo: ${error.message}`);
        }
      }
      eventosCreadosOTocados.add(nuevoEventoId);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "agregar_item_setlist") {
      if (!a.evento_id || !a.item_tipo) throw new Error("Falta evento_id o item_tipo en una acción agregar_item_setlist.");
      const { count } = await admin.from("items_servicio").select("id", { count: "exact", head: true }).eq("evento_id", a.evento_id);
      const id = crypto.randomUUID();
      const base = { id, evento_id: a.evento_id, orden: count ?? 0, estructura: [], fondo_tipo: "color", es_punto_bosquejo: false };
      let fila;
      if (a.item_tipo === "cancion") fila = { ...base, tipo: "cancion", cancion_id: a.item_cancion_id, tonalidad_override: null };
      else if (a.item_tipo === "biblia") fila = { ...base, tipo: "biblia", referencia: a.item_referencia_biblia || "", version_biblia: "RVR1960", texto_biblia: a.item_texto_biblia || "" };
      else if (a.item_tipo === "slide") fila = { ...base, tipo: "slide", titulo: a.item_titulo || "", subtitulo: "", fondo_color: "#1B2029", fondo_video_url: null, fondo_imagen_url: null };
      else fila = { ...base, tipo: "bloque", titulo: a.item_titulo || "Bloque", descripcion: a.item_descripcion || "", ministerio_id: null };
      const { error } = await admin.from("items_servicio").insert(fila);
      if (error) throw new Error(`No se pudo agregar el ítem al setlist: ${error.message}`);
      eventosCreadosOTocados.add(a.evento_id);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "editar_item_setlist") {
      if (!a.item_id) throw new Error("Falta item_id en una acción editar_item_setlist.");
      const patch: Record<string, unknown> = {};
      if (a.item_titulo !== undefined) patch.titulo = a.item_titulo;
      if (a.item_descripcion !== undefined) patch.descripcion = a.item_descripcion;
      if (a.item_cancion_id !== undefined) patch.cancion_id = a.item_cancion_id;
      if (a.item_referencia_biblia !== undefined) patch.referencia = a.item_referencia_biblia;
      if (a.item_texto_biblia !== undefined) patch.texto_biblia = a.item_texto_biblia;
      const { data: itemRow, error } = await admin.from("items_servicio").update(patch).eq("id", a.item_id).select("evento_id").single();
      if (error) throw new Error(`No se pudo editar el ítem del setlist: ${error.message}`);
      if (itemRow) eventosCreadosOTocados.add(itemRow.evento_id);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "eliminar_item_setlist") {
      if (!a.item_id) throw new Error("Falta item_id en una acción eliminar_item_setlist.");
      const { error } = await admin.from("items_servicio").delete().eq("id", a.item_id);
      if (error) throw new Error(`No se pudo eliminar el ítem del setlist: ${error.message}`);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "reordenar_setlist") {
      if (!a.evento_id || !Array.isArray(a.item_ids_en_orden)) throw new Error("Falta evento_id o item_ids_en_orden en una acción reordenar_setlist.");
      for (let i = 0; i < a.item_ids_en_orden.length; i++) {
        const { error } = await admin.from("items_servicio").update({ orden: i }).eq("id", a.item_ids_en_orden[i]).eq("evento_id", a.evento_id);
        if (error) throw new Error(`No se pudo reordenar el setlist: ${error.message}`);
      }
      eventosCreadosOTocados.add(a.evento_id);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "asignar_persona") {
      if (!a.usuario_id || !a.destino) throw new Error("Falta usuario_id o destino en una acción asignar_persona.");
      const { data: usuarioRow } = await admin.from("usuarios").select("id, nombre").eq("id", a.usuario_id).single();
      if (!usuarioRow) throw new Error(`usuario_id inválido en asignar_persona: ${a.usuario_id}`);
      let eventoIdDeEsto: string | null = null;
      if (a.destino === "item_setlist") {
        if (!a.destino_item_id) throw new Error("Falta destino_item_id en asignar_persona con destino=item_setlist.");
        const { data: itemRow } = await admin.from("items_servicio").select("evento_id").eq("id", a.destino_item_id).single();
        if (!itemRow) throw new Error(`destino_item_id inválido en asignar_persona: ${a.destino_item_id}`);
        eventoIdDeEsto = itemRow.evento_id;
        const { error } = await admin.from("miembros_rol").insert({ id: crypto.randomUUID(), item_servicio_id: a.destino_item_id, nombre: usuarioRow.nombre, usuario_id: usuarioRow.id, estado: "pendiente", lead: false, orden: 0 });
        if (error) throw new Error(`No se pudo asignar a ${usuarioRow.nombre}: ${error.message}`);
      } else {
        if (!a.evento_id) throw new Error("Falta evento_id en asignar_persona con destino=equipo_alabanza.");
        eventoIdDeEsto = a.evento_id;
        const nombreRol = a.rol_alabanza_nombre || "Equipo de alabanza";
        const { data: rolExistente } = await admin.from("roles_evento").select("id").eq("evento_id", a.evento_id).ilike("nombre", nombreRol).maybeSingle();
        let rolId = rolExistente?.id as string | undefined;
        if (!rolId) {
          const { count } = await admin.from("roles_evento").select("id", { count: "exact", head: true }).eq("evento_id", a.evento_id);
          rolId = crypto.randomUUID();
          const { error } = await admin.from("roles_evento").insert({ id: rolId, evento_id: a.evento_id, nombre: nombreRol, orden: count ?? 0 });
          if (error) throw new Error(`No se pudo crear el rol ${nombreRol}: ${error.message}`);
        }
        const { error } = await admin.from("miembros_rol").insert({ id: crypto.randomUUID(), rol_id: rolId, nombre: usuarioRow.nombre, usuario_id: usuarioRow.id, estado: "pendiente", lead: false, orden: 0 });
        if (error) throw new Error(`No se pudo asignar a ${usuarioRow.nombre}: ${error.message}`);
      }
      const { data: eventoRow } = eventoIdDeEsto ? await admin.from("eventos").select("titulo").eq("id", eventoIdDeEsto).single() : { data: null };
      await notificar(admin, usuarioRow.id, "asignacion", `Te asignaron: ${eventoRow?.titulo || "un evento"}`, `Quedaste a cargo de algo en "${eventoRow?.titulo || "un evento"}".`, eventoIdDeEsto);
      notificadosTotal.push(usuarioRow.nombre);
      if (eventoIdDeEsto) eventosCreadosOTocados.add(eventoIdDeEsto);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "eliminar_asignacion") {
      if (!a.miembro_rol_id) throw new Error("Falta miembro_rol_id en una acción eliminar_asignacion.");
      const { data: filaVieja } = await admin.from("miembros_rol").select("usuario_id, nombre, item_servicio_id, rol_id").eq("id", a.miembro_rol_id).maybeSingle();
      const { error } = await admin.from("miembros_rol").delete().eq("id", a.miembro_rol_id);
      if (error) throw new Error(`No se pudo quitar la asignación: ${error.message}`);
      // Mismo aviso que removeEncargado/removeWorshipRoleMember en PrototipoWorshipFlow.jsx.
      if (filaVieja?.usuario_id) {
        let eventoId: string | null = null;
        if (filaVieja.item_servicio_id) {
          const { data: itemRow } = await admin.from("items_servicio").select("evento_id").eq("id", filaVieja.item_servicio_id).maybeSingle();
          eventoId = itemRow?.evento_id ?? null;
        } else if (filaVieja.rol_id) {
          const { data: rolRow } = await admin.from("roles_evento").select("evento_id").eq("id", filaVieja.rol_id).maybeSingle();
          eventoId = rolRow?.evento_id ?? null;
        }
        await notificar(admin, filaVieja.usuario_id, "general", "Te quitaron un encargo", "Ya no tienes ese encargo asignado.", eventoId);
      }
      totalAcciones++;
      continue;
    }

    if (a.tipo === "agregar_recordatorio") {
      if (!a.evento_id || !a.cantidad || !a.unidad) throw new Error("Falta evento_id, cantidad o unidad en una acción agregar_recordatorio.");
      const { error } = await admin.from("recordatorios_evento").insert({ id: crypto.randomUUID(), evento_id: a.evento_id, cantidad: a.cantidad, unidad: a.unidad, enviado: false });
      if (error) throw new Error(`No se pudo agregar el recordatorio: ${error.message}`);
      eventosCreadosOTocados.add(a.evento_id);
      totalAcciones++;
      continue;
    }

    if (a.tipo === "eliminar_recordatorio") {
      if (!a.recordatorio_id) throw new Error("Falta recordatorio_id en una acción eliminar_recordatorio.");
      const { error } = await admin.from("recordatorios_evento").delete().eq("id", a.recordatorio_id);
      if (error) throw new Error(`No se pudo eliminar el recordatorio: ${error.message}`);
      totalAcciones++;
      continue;
    }

    throw new Error(`Tipo de acción desconocido: ${a.tipo}`);
  }

  // Auto-verificación: revisa los eventos que este plan tocó (no accede a nada más) y avisa si algo
  // quedó incompleto en vez de asumir que salió bien.
  for (const eventoId of eventosCreadosOTocados) {
    const { count: totalRecordatorios } = await admin.from("recordatorios_evento").select("id", { count: "exact", head: true }).eq("evento_id", eventoId);
    const { data: eventoRow } = await admin.from("eventos").select("titulo").eq("id", eventoId).maybeSingle();
    if ((totalRecordatorios ?? 0) === 0) {
      avisos.push(`"${eventoRow?.titulo || eventoId}" quedó sin ningún recordatorio — nadie recibirá aviso antes del evento.`);
    }
    const { data: itemsDelEvento } = await admin.from("items_servicio").select("id").eq("evento_id", eventoId);
    const itemIds = (itemsDelEvento ?? []).map((i: { id: string }) => i.id);
    const { count: encargadosSinUsuario } = await admin
      .from("miembros_rol").select("id", { count: "exact", head: true })
      .in("item_servicio_id", itemIds.length ? itemIds : ["00000000-0000-0000-0000-000000000000"])
      .is("usuario_id", null);
    if ((encargadosSinUsuario ?? 0) > 0) {
      avisos.push(`En "${eventoRow?.titulo || eventoId}" algún encargado quedó sin cuenta de usuario vinculada — no le llegarán notificaciones.`);
    }
  }

  return { totalAcciones, notificadosTotal, avisos };
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

      // La imagen viaja en base64 desde el cliente, que ya la reduce antes de mandarla (ver
      // AsistenteChatScreen) — este tope es solo un segundo resguardo por si algo se coló sin reducir.
      const imagenBody = body.image && typeof body.image.data === "string" ? body.image : null;
      if (imagenBody && imagenBody.data.length > 6_000_000) {
        return json({ error: "La imagen es muy pesada — intenta con una foto más chica." }, 400);
      }

      const [{ data: usuarios }, { data: canciones }, { data: config }, contexto] = await Promise.all([
        admin.from("usuarios").select("id, nombre").order("nombre"),
        admin.from("canciones").select("id, titulo, artista").order("titulo"),
        admin.from("asistente_config").select("reglas").eq("id", "default").maybeSingle(),
        contextoEventos(admin),
      ]);

      const respuesta = await llamarClaude(
        messages, usuarios ?? [], canciones ?? [], config?.reglas || "", contexto,
        imagenBody ? { mediaType: imagenBody.mediaType, data: imagenBody.data } : null,
      );
      const bloques = respuesta.content ?? [];
      const toolUse = bloques.find((b: { type: string }) => b.type === "tool_use" && b.name === "proponer_cambios");
      if (toolUse) {
        return json({ tipo: "plan", plan: toolUse.input, resumen: toolUse.input?.resumen || "Plan propuesto." }, 200);
      }
      const texto = bloques.filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n").trim();
      return json({ tipo: "texto", texto: texto || "No entendí, ¿puedes reformular?" }, 200);
    }

    // ---- mode "apply": ejecuta el plan ya confirmado por el administrador, determinista, sin IA.
    // Corre en segundo plano (EdgeRuntime.waitUntil) en vez de dejar al cliente esperando con la
    // conexión abierta: si el administrador cierra la app o se le va la señal a mitad de camino, el
    // trabajo sigue solo del lado del servidor y se entera por una notificación normal cuando
    // termine (o si algo falló) — la misma campanita/push que ya usa el resto de la app.
    const plan = body.plan;
    const acciones: Accion[] = Array.isArray(plan?.acciones) ? plan.acciones : [];
    if (!acciones.length) return json({ error: "Plan inválido: no trae ninguna acción." }, 400);

    const callerId = caller.id;
    const tarea = ejecutarAcciones(admin, callerId, acciones)
      .then(async ({ totalAcciones, notificadosTotal, avisos }) => {
        const partes = [`Se aplicaron ${totalAcciones} acción(es) del plan del Asistente.`];
        if (notificadosTotal.length) partes.push(`Se notificó a: ${notificadosTotal.join(", ")}.`);
        if (avisos.length) partes.push(...avisos);
        await notificar(admin, callerId, "general", "Tu plan del Asistente ya se aplicó", partes.join(" "), null);
      })
      .catch(async (e) => {
        const msg = e instanceof Error ? e.message : String(e);
        await notificar(admin, callerId, "general", "El plan del Asistente falló", msg, null);
      });

    // EdgeRuntime.waitUntil (Deno Deploy / Supabase Edge Functions) mantiene la función corriendo
    // DESPUÉS de mandar la respuesta HTTP de abajo — así "Aplicar" no depende de que el administrador
    // se quede en la app esperando. Si por lo que sea no existiera en este entorno, se espera igual
    // (más lento para el cliente, pero nunca deja el plan a medio aplicar).
    const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(tarea);
    else await tarea;

    return json({
      success: true,
      enSegundoPlano: true,
      resumen: `Aplicando ${acciones.length} acción(es) en segundo plano — te llega una notificación cuando termine (o si algo falla), aunque cierres la app.`,
    }, 200);
  } catch (e) {
    return json({ error: "Error inesperado: " + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
