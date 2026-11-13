import { describe, expect, it, vi } from "vitest";

// Base de mentira: una tabla de órdenes y un canal Realtime que el test dispara a mano.
const tabla = [];
let alInsertar = null;
const consulta = () => {
  let filas = [...tabla]; let asc = true; let tope = 1000;
  const q = {
    select: () => q, eq: () => q,
    gte: (_c, v) => { filas = filas.filter((f) => f.creado_at >= v); return q; },
    order: (_c, o) => { asc = o.ascending; return q; },
    limit: (n) => { tope = n; return q; },
    then: (ok) => ok({ data: filas.sort((a, b) => (asc ? 1 : -1) * a.creado_at.localeCompare(b.creado_at)).slice(0, tope), error: null }),
  };
  return q;
};
const canal = { on: (_t, _f, cb) => { alInsertar = cb; return canal; }, subscribe: () => canal };
vi.mock("../supabaseClient.js", () => ({ supabase: { from: consulta, channel: () => canal, removeChannel: () => { alInsertar = null; } } }));
const { resolverComando, itemDeDiapositiva, suscribirComandos, limpiarVersiculo, REVISAR_MS } = await import("../controlRemoto.js");

// Un culto: canción (2 diapositivas) → bosquejo del bloque P (título + versículo partido en 2) → video.
const serviceOrder = [
  { id: "A", type: "seccion", title: "Alabanza" },
  { id: "c1", type: "cancion" },
  { id: "P", type: "seccion", title: "Predicación" },
  { id: "t1", type: "slide", bosquejoDe: "P" },
  { id: "v1", type: "biblia", bosquejoDe: "P" },
  { id: "vid", type: "slide" },
];
const slides = [{ slideId: "c1-0-0" }, { slideId: "c1-0-1" }, { slideId: "t1" }, { slideId: "v1~0" }, { slideId: "v1~1" }, { slideId: "vid" }];
const ctx = (activeIdx, extra = {}) => ({ slides, activeIdx, serviceOrder, adHoc: null, fijada: null, ...extra });

describe("control remoto: qué hace la computadora con cada orden", () => {
  it("Multimedia: siguiente/anterior avanzan como el teclado; negro alterna; ir_item salta al inicio de esa parte", () => {
    expect(resolverComando({ accion: "siguiente" }, ctx(0))).toEqual({ tipo: "avanzar", dir: 1, soltar: false });
    expect(resolverComando({ accion: "anterior" }, ctx(3))).toEqual({ tipo: "avanzar", dir: -1, soltar: false });
    expect(resolverComando({ accion: "negro" }, ctx(0))).toEqual({ tipo: "negro" });
    expect(resolverComando({ accion: "ir_item", item_id: "v1" }, ctx(0))).toEqual({ tipo: "ir", indice: 3 });
    expect(resolverComando({ accion: "ir_item", item_id: "no-existe" }, ctx(0)).tipo).toBe("ignorar");
  });
  it("con la pantalla fijada, la orden de Multimedia la suelta para que se vea el cambio", () => {
    expect(resolverComando({ accion: "siguiente" }, ctx(0, { fijada: slides[0] })).soltar).toBe(true);
  });

  it("predicador: solo dentro de su bosquejo y solo mientras está al aire", () => {
    const p = (accion) => ({ accion, bloque_id: "P" });
    expect(resolverComando(p("siguiente"), ctx(0)).tipo).toBe("ignorar"); // al aire una canción
    expect(resolverComando(p("siguiente"), ctx(2))).toEqual({ tipo: "avanzar", dir: 1 }); // título → versículo
    expect(resolverComando(p("siguiente"), ctx(3))).toEqual({ tipo: "avanzar", dir: 1 }); // parte 1 → parte 2
    // Al final de su bosquejo no puede pasar al video de Multimedia (solo revelar pasos de esa diapositiva).
    expect(resolverComando(p("siguiente"), ctx(4))).toEqual({ tipo: "avanzar", dir: 1, soloPasos: true });
    // Al principio no puede retroceder a la canción.
    expect(resolverComando(p("anterior"), ctx(2))).toEqual({ tipo: "avanzar", dir: -1, soloPasos: true });
  });
  it("predicador: nada de pantalla en negro ni saltos; y si Multimedia puso algo aparte o fijó la pantalla, no obedece", () => {
    expect(resolverComando({ accion: "negro", bloque_id: "P" }, ctx(2)).tipo).toBe("ignorar");
    expect(resolverComando({ accion: "ir_item", item_id: "c1", bloque_id: "P" }, ctx(2)).tipo).toBe("ignorar");
    expect(resolverComando({ accion: "siguiente", bloque_id: "P" }, ctx(2, { adHoc: { slides: [] } })).tipo).toBe("ignorar");
    expect(resolverComando({ accion: "siguiente", bloque_id: "P" }, ctx(2, { fijada: slides[2] })).tipo).toBe("ignorar");
    expect(resolverComando({ accion: "siguiente", bloque_id: "OTRO" }, ctx(2)).tipo).toBe("ignorar");
  });
  it("órdenes desconocidas se ignoran", () => {
    expect(resolverComando({ accion: "terminar" }, ctx(0)).tipo).toBe("ignorar");
    expect(resolverComando(null, ctx(0)).tipo).toBe("ignorar");
  });
  it("itemDeDiapositiva reconoce las partes de un ítem (canción, versículo partido)", () => {
    expect(itemDeDiapositiva(serviceOrder, { slideId: "v1~1" }).id).toBe("v1");
    expect(itemDeDiapositiva(serviceOrder, { slideId: "c1-0-1" }).id).toBe("c1");
    expect(itemDeDiapositiva(serviceOrder, null)).toBeNull();
  });
  it("biblia: pone al aire el versículo que mandó el celular; incompleto o del predicador, no", () => {
    const datos = { ref: "Juan 3:16", version: "RVR1960", text: "Porque de tal manera amó Dios al mundo", bookId: 43, bookName: "Juan", chapter: 3, verseStart: 16, verseEnd: 16, otra: "cosa" };
    const r = resolverComando({ accion: "biblia", datos }, ctx(0));
    expect(r).toEqual({ tipo: "biblia", versiculo: { ref: "Juan 3:16", version: "RVR1960", text: datos.text, bookId: 43, bookName: "Juan", chapter: 3, verseStart: 16, verseEnd: 16 } });
    expect(resolverComando({ accion: "biblia", datos: { ref: "Juan 3:16" } }, ctx(0)).tipo).toBe("ignorar");
    expect(resolverComando({ accion: "biblia", datos, bloque_id: "P" }, ctx(2)).tipo).toBe("ignorar");
    // Escrito a mano (sin libro/capítulo): se proyecta, sin "siguiente versículo".
    expect(limpiarVersiculo({ ref: "Salmo 23", text: "Jehová es mi pastor" })).toEqual({ ref: "Salmo 23", text: "Jehová es mi pastor", version: "RVR1960" });
  });
});

describe("control remoto: la computadora recibe las órdenes aunque Realtime no las entregue", () => {
  it("revisa la tabla cada rato, ejecuta cada orden una sola vez y nunca una que ya estaba", async () => {
    vi.useFakeTimers();
    tabla.length = 0;
    tabla.push({ id: "vieja", accion: "siguiente", creado_at: "2026-11-13T05:00:00Z" });
    const recibidas = [];
    const dejar = suscribirComandos("igl", (c) => recibidas.push(c.id));
    await vi.advanceTimersByTimeAsync(REVISAR_MS * 2);
    expect(recibidas).toEqual([]); // la que ya estaba no mueve nada

    // Llega por Realtime y además está en la tabla: una sola vez.
    const a = { id: "a", accion: "siguiente", creado_at: "2026-11-13T05:00:01Z" };
    tabla.push(a); alInsertar({ new: a });
    await vi.advanceTimersByTimeAsync(REVISAR_MS * 2);
    expect(recibidas).toEqual(["a"]);

    // Realtime no la entrega: la encuentra la revisión.
    tabla.push({ id: "b", accion: "negro", creado_at: "2026-11-13T05:00:02Z" });
    await vi.advanceTimersByTimeAsync(REVISAR_MS + 50);
    expect(recibidas).toEqual(["a", "b"]);

    dejar();
    tabla.push({ id: "c", accion: "negro", creado_at: "2026-11-13T05:00:03Z" });
    await vi.advanceTimersByTimeAsync(REVISAR_MS * 2);
    expect(recibidas).toEqual(["a", "b"]);
    vi.useRealTimers();
  });
});
