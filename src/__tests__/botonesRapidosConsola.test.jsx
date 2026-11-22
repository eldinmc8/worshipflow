// @vitest-environment jsdom
// Botones de un solo toque y diapositiva de audio en la consola (pedido de Eldin, 2026-11-22).
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) };
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; }, send: async () => {} }), removeChannel: () => {}, storage: { from: () => ({ list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }, auth: { getSession: async () => ({ data: { session: null } }) } }, callUsersFunction: async () => ({}) };
});
vi.mock("../lib/confirm.js", () => ({ confirmDialog: vi.fn(async () => true) }));
const audio = vi.hoisted(() => ({ reproducirAudio: vi.fn(), bajarAudio: vi.fn() }));
vi.mock("../lib/audioCulto.js", async (orig) => ({ ...(await orig()), reproducirAudio: audio.reproducirAudio, bajarAudio: audio.bajarAudio }));
globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => [] }));
const { MultimediaControl } = await import("../pantallas/envivo.jsx");
const { guardarBotones } = await import("../lib/botonesRapidos.js");
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };

const orden = [
  { id: "t1", type: "slide", title: "Bienvenidos", subtitle: "", bg: "#1B2029", bgType: "color" },
  { id: "c1", type: "cancion", songId: "s1" },
];
const bienvenida = { slideId: "t1", type: "slide", title: "Bienvenidos", subtitle: "", bg: "#1B2029", bgType: "color" };
const canto = { slideId: "c1-0-0", type: "cancion", songTitle: "Santo", blockLabel: "Coro", lines: ["Santo", "Santo"] };

let estilo;
function Consola({ gotoPlanSlide = () => {}, setBlanked = () => {}, onStartAdHocCuenta = () => {}, onAddLiveSlide = () => {} }) {
  const [liveStyle, setLiveStyle] = useState({ theme: "azul", font: "elegante" });
  estilo = liveStyle;
  return <MultimediaControl eventTitle="Culto" serviceOrder={orden} library={[]} slides={[bienvenida, canto]} activeIdx={0} adHocIdx={0} goto={() => {}} gotoPlanSlide={gotoPlanSlide} blanked={false} setBlanked={setBlanked} current={bienvenida} next={canto} onEnd={() => {}} canEnd liveOwner="yo" liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={false} myIglesiaId="igl" onOpenPublicScreen={() => {}} onReordenarOrden={() => {}} onAddLiveSlide={onAddLiveSlide} onEditLiveSlide={() => {}} onOcultar={() => {}} onQuitarDelOrden={() => {}} onInsertarItems={() => {}} onStartAdHocCuenta={onStartAdHocCuenta} onMensajeEscenario={() => {}} />;
}

beforeEach(() => { localStorage.clear(); audio.reproducirAudio.mockClear(); audio.bajarAudio.mockClear(); });
afterEach(cleanup);

describe("Botones de un solo toque", () => {
  it("la consola trae los 3 listos", () => {
    render(<Consola />);
    const fila = screen.getByTestId("fila-botones-rapidos");
    expect(within(fila).getByText("Inicio del culto")).toBeTruthy();
    expect(within(fila).getByText("Empezar alabanza")).toBeTruthy();
    expect(within(fila).getByText("Final del culto")).toBeTruthy();
  });

  it("un toque hace todo: fondo, cuenta regresiva, música y mensaje", () => {
    guardarBotones([{ id: "x", nombre: "Inicio", color: "#E8821E", pasos: [
      { tipo: "fondo", fondo: { theme: "calido" } },
      { tipo: "cuenta", modo: "minutos", minutos: 10 },
      { tipo: "musica", url: "https://a.com/fondo.mp3", nombre: "fondo", repetir: true },
      { tipo: "mensaje", texto: "Bienvenidos", segundos: 15 },
    ] }]);
    const onStartAdHocCuenta = vi.fn();
    render(<Consola onStartAdHocCuenta={onStartAdHocCuenta} />);
    fireEvent.click(within(screen.getByTestId("fila-botones-rapidos")).getByText("Inicio"));
    expect(estilo.theme).toBe("calido");
    expect(onStartAdHocCuenta).toHaveBeenCalledWith(expect.objectContaining({ modo: "minutos", minutos: 10, fondo: "estilo" }));
    expect(audio.reproducirAudio).toHaveBeenCalledWith(expect.objectContaining({ url: "https://a.com/fondo.mp3", origen: "musica", repetir: true }));
    expect(estilo.avisoCongregacion).toMatchObject({ texto: "Bienvenidos", duracionSeg: 15 });
  });

  it("'Empezar alabanza' baja la música y va al primer canto", () => {
    const gotoPlanSlide = vi.fn();
    render(<Consola gotoPlanSlide={gotoPlanSlide} />);
    fireEvent.click(within(screen.getByTestId("fila-botones-rapidos")).getByText("Empezar alabanza"));
    expect(audio.bajarAudio).toHaveBeenCalled();
    expect(gotoPlanSlide).toHaveBeenCalledWith(1);
  });

  it("los pasos sin completar se saltan (el fondo y la música de fábrica)", () => {
    const onStartAdHocCuenta = vi.fn();
    render(<Consola onStartAdHocCuenta={onStartAdHocCuenta} />);
    fireEvent.click(within(screen.getByTestId("fila-botones-rapidos")).getByText("Inicio del culto"));
    expect(estilo.theme).toBe("azul");
    expect(audio.reproducirAudio).not.toHaveBeenCalled();
    expect(onStartAdHocCuenta).toHaveBeenCalled();
  });

  it("en Editar se toma el fondo puesto, se agrega un paso y se guarda", () => {
    render(<Consola />);
    fireEvent.click(within(screen.getByTestId("fila-botones-rapidos")).getByText("Editar"));
    const editor = screen.getByTestId("editor-boton");
    fireEvent.click(within(editor).getByText("Usar el fondo que está puesto ahora"));
    fireEvent.click(within(editor).getByText("Agregar paso"));
    fireEvent.click(within(editor).getByText("Pantalla en negro"));
    fireEvent.change(within(editor).getByLabelText("Nombre del botón"), { target: { value: "Bienvenida" } });
    fireEvent.click(screen.getByText("Guardar"));
    const guardados = JSON.parse(localStorage.getItem("wf_botones_rapidos"));
    expect(guardados[0].nombre).toBe("Bienvenida");
    expect(guardados[0].pasos[0]).toEqual({ tipo: "fondo", fondo: { theme: "azul" } });
    expect(guardados[0].pasos.at(-1)).toEqual({ tipo: "negro", valor: true });
    expect(within(screen.getByTestId("fila-botones-rapidos")).getByText("Bienvenida")).toBeTruthy();
  });
});

describe("Diapositiva de audio", () => {
  it("+ Agregar → Audio pide el audio y lo deja en el orden con su texto", () => {
    const onAddLiveSlide = vi.fn();
    render(<Consola onAddLiveSlide={onAddLiveSlide} />);
    fireEvent.click(within(screen.getByLabelText("Orden del culto")).getByText("Agregar"));
    fireEvent.click(screen.getByText("Audio"));
    const seccion = screen.getByTestId("seccion-audio");
    fireEvent.click(within(seccion).getByText("Mejor pegar un enlace directo a un audio"));
    fireEvent.change(within(seccion).getByPlaceholderText(/Pega el enlace de un .mp3/), { target: { value: "https://a.com/Pista_ofrenda.mp3" } });
    fireEvent.click(within(seccion).getByText("Pasar a lo siguiente"));
    fireEvent.change(screen.getByPlaceholderText(/Un título, la letra o un aviso/), { target: { value: "Tiempo de ofrenda" } });
    fireEvent.click(screen.getByText("Agregar al culto"));
    expect(onAddLiveSlide).toHaveBeenCalledWith(expect.objectContaining({
      title: "Tiempo de ofrenda", name: "Audio: Pista ofrenda",
      audio: expect.objectContaining({ url: "https://a.com/Pista_ofrenda.mp3", alTerminar: "avanzar" }),
    }), expect.anything());
  });
});
