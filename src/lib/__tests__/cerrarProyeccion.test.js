import { describe, expect, it, vi } from "vitest";

vi.mock("../supabaseClient.js", () => ({ supabase: { channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: () => {} } }));
const { pedirCerrarProyeccion, alPedirCerrarProyeccion, subscribeLiveBroadcast } = await import("../liveSession.js");
const esperar = () => new Promise((r) => setTimeout(r, 30));

describe("cerrar la proyección al finalizar el evento", () => {
  it("la proyección de esta computadora recibe el aviso y no lo toma como una diapositiva", async () => {
    const otraVentana = new BroadcastChannel("worshipflow-live-broadcast-igl-1"); // como si fuera la proyección
    const cerrar = vi.fn();
    const filas = vi.fn();
    otraVentana.addEventListener("message", (e) => { if (e.data?.__cerrarProyeccion) cerrar(); else filas(e.data); });
    pedirCerrarProyeccion("igl-1");
    await esperar();
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(filas).not.toHaveBeenCalled();
    otraVentana.close();
  });
  it("alPedirCerrarProyeccion avisa, y subscribeLiveBroadcast lo ignora", async () => {
    const fn = vi.fn();
    const onFila = vi.fn();
    const quitar = alPedirCerrarProyeccion("igl-2", fn);
    const quitarFilas = subscribeLiveBroadcast("igl-2", onFila);
    const consola = new BroadcastChannel("worshipflow-live-broadcast-igl-2");
    consola.postMessage({ __cerrarProyeccion: true });
    consola.postMessage({ evento_id: "e", slide_actual: { title: "Hola" } });
    await esperar();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onFila).toHaveBeenCalledTimes(1);
    expect(onFila.mock.calls[0][0].evento_id).toBe("e");
    quitar(); quitarFilas(); consola.close();
  });
});
