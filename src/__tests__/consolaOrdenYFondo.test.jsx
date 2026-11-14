// @vitest-environment jsdom
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) };
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; }, send: async () => {} }), removeChannel: () => {}, storage: { from: () => ({ list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }, auth: { getSession: async () => ({ data: { session: null } }) } }, callUsersFunction: async () => ({}) };
});
const { MultimediaControl } = await import("../pantallas/envivo.jsx");
afterEach(cleanup);
beforeEach(() => { localStorage.clear(); });
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };

// Bienvenida (con un aviso) y Predicación (vacía), como en un culto real.
const orden = [
  { id: "b1", type: "seccion", title: "Bienvenida" },
  { id: "t1", type: "slide", title: "Aviso de ayuno", subtitle: "", bg: "#1B2029", bgType: "color" },
  { id: "b2", type: "seccion", title: "Predicación" },
];
const aviso = { slideId: "t1", type: "slide", title: "Aviso de ayuno", subtitle: "", bg: "#1B2029", bgType: "color" };

function Consola({ onReordenar = () => {}, onAgregar = () => {}, onEstilo = () => {} }) {
  const [liveStyle, setLiveStyle] = useState({ theme: "stage", font: "elegante" });
  onEstilo(liveStyle);
  return <MultimediaControl eventTitle="Culto" serviceOrder={orden} library={[]} slides={[aviso]} activeIdx={0} adHocIdx={0} goto={() => {}} gotoPlanSlide={() => {}} blanked={false} setBlanked={() => {}} current={aviso} next={null} onEnd={() => {}} canEnd liveOwner="yo" liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={false} myIglesiaId="igl" onOpenPublicScreen={() => {}} onReordenarOrden={onReordenar} onAddLiveSlide={onAgregar} onEditLiveSlide={() => {}} onOcultar={() => {}} />;
}
const modoCompleto = () => fireEvent.click(screen.getByText("Más herramientas"));
// jsdom no mide anchos: la cinta manda casi todo a "Más opciones", así que se abre antes de buscar un botón.
const enLaCinta = (titulo) => { const mas = screen.queryByText("Más opciones"); if (mas) fireEvent.click(mas); return screen.getByTitle(titulo); };

describe("Orden del culto en la consola", () => {
  it("una parte del culto vacía se ve (para poder soltarle algo) y la fila no usa el cursor de agarrar", () => {
    render(<Consola />);
    const lista = screen.getByLabelText("Orden del culto");
    expect(within(lista).getByText("Predicación")).toBeTruthy();
    expect(within(lista).getByText("vacío")).toBeTruthy();
    const fila = within(lista).getByText("Aviso de ayuno").closest(".orden-fila");
    expect(fila.style.cursor).toBe("pointer");
  });
  it("'Mover a otra parte del culto' lleva el elemento a una parte vacía", () => {
    const onReordenar = vi.fn();
    render(<Consola onReordenar={onReordenar} />);
    fireEvent.click(screen.getByLabelText("Mover a otra parte del culto"));
    const menu = screen.getByRole("menu", { name: "Mover a otra parte del culto" });
    expect(within(menu).getByText("Bienvenida").closest("button").disabled).toBe(true); // ahí está
    fireEvent.click(within(menu).getByText("Predicación"));
    expect(onReordenar).toHaveBeenCalledWith(1, 2); // queda después del bloque "Predicación"
  });
});

describe("Fondo e imágenes a la mano", () => {
  it("Estilo → Imagen abre la biblioteca de una vez, sin cambiar el fondo hasta elegir", () => {
    let estilo = null;
    render(<Consola onEstilo={(s) => { estilo = s; }} />);
    modoCompleto();
    fireEvent.click(screen.getByText("Estilo"));
    // Estilo ya no usa cuadros flotantes: la biblioteca se abre dentro del mismo panel, bajo la fila de fondos.
    fireEvent.click(screen.getByTitle(/^Imagen de fondo/));
    const panel = screen.getByRole("region", { name: "Biblioteca de fondos" });
    expect(within(panel).getByTestId("biblioteca-fondos")).toBeTruthy();
    expect(screen.getByLabelText("Oscurecer la imagen o el video")).toBeTruthy();
    expect(estilo.theme).toBe("stage");
  });
  it("Estilo tiene el interlineado a la vista, con − y + (antes estaba dentro de 'Sombra y más')", () => {
    let estilo = null;
    render(<Consola onEstilo={(s) => { estilo = s; }} />);
    modoCompleto();
    fireEvent.click(screen.getByText("Estilo"));
    expect(screen.getByLabelText("Interlineado")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Más interlineado"));
    expect(estilo.interlineado).toBeCloseTo(1.4);
    fireEvent.click(screen.getByLabelText("Menos interlineado"));
    fireEvent.click(screen.getByLabelText("Menos interlineado"));
    expect(estilo.interlineado).toBeCloseTo(1.3);
    expect(screen.getByRole("group", { name: "Alineación" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Sombra de la letra" })).toBeTruthy();
  });
  it("el texto rápido puede llevar un color liso propio y el siguiente empieza igual", () => {
    const onAgregar = vi.fn();
    render(<Consola onAgregar={onAgregar} />);
    modoCompleto();
    fireEvent.click(screen.getByText("Insertar"));
    fireEvent.click(enLaCinta(/^Texto rápido/));
    expect(screen.getByTestId("vista-previa-diapositiva")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "El de Estilo" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Color liso" }));
    fireEvent.click(screen.getByLabelText("Color #000000"));
    fireEvent.change(screen.getByPlaceholderText(/Escribe el texto que se va a proyectar/), { target: { value: "Bienvenidos" } });
    fireEvent.click(screen.getByText("Agregar al culto"));
    expect(onAgregar.mock.calls[0][0]).toMatchObject({ title: "Bienvenidos", bgType: "color", bg: "fijo:#000000" });
    fireEvent.click(enLaCinta(/^Texto rápido/));
    expect(screen.getByRole("radio", { name: "Color liso" }).getAttribute("aria-checked")).toBe("true");
  });
  it("la diapositiva de texto que se ve al centro tiene 'Texto y fondo' a un clic", () => {
    render(<Consola />);
    fireEvent.click(screen.getByText("Texto y fondo"));
    expect(screen.getByText("Editar diapositiva")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Fondo de la diapositiva" })).toBeTruthy();
  });
});

describe("Colores de la Biblia desde la pestaña Biblia", () => {
  it("cambia el color del versículo y el de la cita solo en el estilo de la Biblia", () => {
    let estilo = null;
    render(<Consola onEstilo={(s) => { estilo = s; }} />);
    modoCompleto();
    fireEvent.click(screen.getByText("Biblia"));
    const abrirMas = () => { if (screen.queryByLabelText("Color del versículo: Amarillo suave")) return; const mas = screen.queryByText("Más opciones"); if (mas) fireEvent.click(mas); };
    abrirMas();
    fireEvent.click(screen.getByLabelText("Color del versículo: Amarillo suave"));
    abrirMas();
    fireEvent.click(screen.getByLabelText("Color de la cita: Naranja"));
    expect(estilo.biblia.bibliaTextColor).toBe("#F5D67B");
    expect(estilo.biblia.bibliaReferenciaColor).toBe("#E8821E");
    expect(estilo.textColor).toBeUndefined(); // las canciones no se tocan
  });
});
