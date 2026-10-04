import { describe, expect, it, beforeEach } from "vitest";
import { makeFakeSupabase } from "./fakeSupabase.js";

// La acción "duplicar_evento" del Asistente (supabase/functions/asistente-chat/index.ts) es código
// Deno — no se puede importar ni correr dentro de Vitest/Node. Esta prueba replica, PASO A PASO, la
// misma secuencia de lecturas/inserciones que esa función hace hoy (ver el bloque "if (a.tipo ===
// 'duplicar_evento')" en ese archivo), contra la misma base simulada que usan las pruebas de
// eventos.js — así queda fijado como contrato lo que esa acción DEBE hacer: copiar los bloques del
// Setlist con su ministerio_id, el equipo de alabanza completo (roles_evento + sus miembros) y los
// recordatorios, igual que crearEventoCompleto hace para "crear desde plantilla" en la app.
//
// Si alguien edita el archivo real y dejar de copiar algo de esto, esta prueba NO lo detecta sola
// (son dos copias independientes de la misma lógica) — pero si Eldin reporta otro caso como el de
// octubre, el primer lugar para mirar es si el archivo real todavía hace exactamente esto.
function duplicarEventoComoElAsistente(db, { eventoOrigenId, nuevoEventoId, iglesiaId, titulo, fecha }) {
  db.eventos.push({ id: nuevoEventoId, iglesia_id: iglesiaId, titulo, fecha, es_plantilla: false });

  const itemsOrigen = (db.items_servicio || []).filter((i) => i.evento_id === eventoOrigenId);
  const mapaItemIds = new Map();
  for (const it of itemsOrigen) {
    const nuevoId = `${it.id}-clon`;
    mapaItemIds.set(it.id, nuevoId);
    const { id: _id, evento_id: _e, created_at: _c, ...resto } = it;
    db.items_servicio.push({ ...resto, iglesia_id: iglesiaId, id: nuevoId, evento_id: nuevoEventoId });
  }
  if (mapaItemIds.size) {
    const encargadosOrigen = (db.miembros_rol || []).filter((m) => mapaItemIds.has(m.item_servicio_id));
    for (const m of encargadosOrigen) {
      const { id: _id, item_servicio_id, ...resto } = m;
      db.miembros_rol.push({ ...resto, iglesia_id: iglesiaId, id: `${m.id}-clon`, item_servicio_id: mapaItemIds.get(item_servicio_id), estado: "pendiente" });
    }
  }

  const rolesOrigen = (db.roles_evento || []).filter((r) => r.evento_id === eventoOrigenId);
  const mapaRolIds = new Map();
  for (const r of rolesOrigen) {
    const nuevoId = `${r.id}-clon`;
    mapaRolIds.set(r.id, nuevoId);
    const { id: _id, evento_id: _e, ...resto } = r;
    db.roles_evento.push({ ...resto, iglesia_id: iglesiaId, id: nuevoId, evento_id: nuevoEventoId });
  }
  if (mapaRolIds.size) {
    const miembrosOrigen = (db.miembros_rol || []).filter((m) => mapaRolIds.has(m.rol_id));
    for (const m of miembrosOrigen) {
      const { id: _id, rol_id, ...resto } = m;
      db.miembros_rol.push({ ...resto, iglesia_id: iglesiaId, id: `${m.id}-clon2`, rol_id: mapaRolIds.get(rol_id), estado: "pendiente" });
    }
  }

  const recOrigen = (db.recordatorios_evento || []).filter((r) => r.evento_id === eventoOrigenId);
  for (const r of recOrigen) {
    db.recordatorios_evento.push({ iglesia_id: iglesiaId, id: `${r.id}-clon`, evento_id: nuevoEventoId, cantidad: r.cantidad, unidad: r.unidad, enviado: false });
  }
}

describe("duplicar_evento del Asistente (replica su algoritmo)", () => {
  let fake;
  beforeEach(() => { fake = makeFakeSupabase(); });

  it("copia bloques con su ministerio_id, el equipo de alabanza completo y los recordatorios", () => {
    const IGLESIA = "igl-1";
    fake.db.eventos = [{ id: "plantilla-1", iglesia_id: IGLESIA, titulo: "Domingo AM (plantilla)", es_plantilla: true }];
    fake.db.items_servicio = [
      { id: "item-escuelita-infantil", evento_id: "plantilla-1", tipo: "bloque", titulo: "Escuelita Infantil", orden: 0, ministerio_id: "min-infantil", iglesia_id: IGLESIA },
      { id: "item-escuelita-adolescentes", evento_id: "plantilla-1", tipo: "bloque", titulo: "Escuelita Adolescentes", orden: 1, ministerio_id: "min-adolescentes", iglesia_id: IGLESIA },
      { id: "item-orden-limpieza", evento_id: "plantilla-1", tipo: "bloque", titulo: "Orden y limpieza", orden: 2, ministerio_id: "min-limpieza", iglesia_id: IGLESIA },
    ];
    fake.db.roles_evento = [{ id: "rol-guitarra", evento_id: "plantilla-1", nombre: "Guitarra", orden: 0, iglesia_id: IGLESIA }];
    fake.db.miembros_rol = [
      { id: "m-rol", rol_id: "rol-guitarra", item_servicio_id: null, nombre: "Gerardo", usuario_id: "u-gerardo", estado: "confirmado", orden: 0, iglesia_id: IGLESIA },
      { id: "m-item", rol_id: null, item_servicio_id: "item-orden-limpieza", nombre: "Flor", usuario_id: "u-flor", estado: "confirmado", orden: 0, iglesia_id: IGLESIA },
    ];
    fake.db.recordatorios_evento = [{ id: "rec-1", evento_id: "plantilla-1", cantidad: 1, unidad: "dias", enviado: true, iglesia_id: IGLESIA }];

    duplicarEventoComoElAsistente(fake.db, { eventoOrigenId: "plantilla-1", nuevoEventoId: "evento-nuevo", iglesiaId: IGLESIA, titulo: "Domingo 12 de octubre", fecha: "2026-10-12" });

    // Los tres bloques, cada uno con SU ministerio_id — el bug real de octubre fue justo este.
    const nuevos = fake.db.items_servicio.filter((i) => i.evento_id === "evento-nuevo");
    expect(nuevos).toHaveLength(3);
    expect(nuevos.find((i) => i.titulo === "Escuelita Infantil").ministerio_id).toBe("min-infantil");
    expect(nuevos.find((i) => i.titulo === "Escuelita Adolescentes").ministerio_id).toBe("min-adolescentes");
    expect(nuevos.find((i) => i.titulo === "Orden y limpieza").ministerio_id).toBe("min-limpieza");

    // El rol del equipo de alabanza y su integrante, vinculado al rol NUEVO (no al de la plantilla).
    const rolNuevo = fake.db.roles_evento.find((r) => r.evento_id === "evento-nuevo");
    expect(rolNuevo).toMatchObject({ nombre: "Guitarra" });
    const miembroRolNuevo = fake.db.miembros_rol.find((m) => m.rol_id === rolNuevo.id);
    expect(miembroRolNuevo).toMatchObject({ nombre: "Gerardo", estado: "pendiente" }); // reinicia la confirmación

    // El encargado del bloque de limpieza, vinculado al ítem NUEVO.
    const itemLimpiezaNuevo = nuevos.find((i) => i.titulo === "Orden y limpieza");
    const encargadoNuevo = fake.db.miembros_rol.find((m) => m.item_servicio_id === itemLimpiezaNuevo.id);
    expect(encargadoNuevo).toMatchObject({ nombre: "Flor", estado: "pendiente" });

    // El recordatorio, reiniciado a enviado:false aunque en la plantilla ya estuviera en true.
    const recNuevo = fake.db.recordatorios_evento.find((r) => r.evento_id === "evento-nuevo");
    expect(recNuevo).toMatchObject({ cantidad: 1, unidad: "dias", enviado: false });

    // Nada de la plantilla original se tocó.
    expect(fake.db.items_servicio.filter((i) => i.evento_id === "plantilla-1")).toHaveLength(3);
  });
});
