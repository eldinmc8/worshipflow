// @vitest-environment jsdom
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) };
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; }, send: async () => {} }), removeChannel: () => {}, storage: { from: () => ({ list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }, auth: { getSession: async () => ({ data: { session: null } }) } }, callUsersFunction: async () => ({}) };
});
const { MultimediaControl } = await import("../pantallas/envivo.jsx");
afterEach(cleanup);
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };

const cancion = { slideId: "c1", type: "cancion", songId: "s1", songTitle: "Cuán grande", blockLabel: "Verso 1", blockKey: "V1", lines: ["Señor mi Dios"] };
const versiculo = { slideId: "b1", type: "biblia", reference: "Juan 3:16", text: "Porque de tal manera…", version: "RVR1960" };

function Consola({ alAire, onEstilo }) {
  const [liveStyle, setLiveStyle] = useState({ theme: "stage", font: "elegante", animacion: "aurora" });
  onEstilo(liveStyle);
  return <MultimediaControl eventTitle="Culto" serviceOrder={[]} library={[]} slides={[alAire]} activeIdx={0} adHocIdx={0} goto={() => {}} gotoPlanSlide={() => {}} blanked={false} setBlanked={() => {}} current={alAire} next={null} onEnd={() => {}} canEnd liveOwner="yo" liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact myIglesiaId="igl" onOpenPublicScreen={() => {}} />;
}

describe("Estilo para Canciones o Biblia en la consola", () => {
  it("con un versículo al aire edita la Biblia: sin letra animada y sin tocar las canciones", () => {
    let estilo = null;
    render(<Consola alAire={versiculo} onEstilo={(s) => { estilo = s; }} />);
    fireEvent.click(screen.getByTitle("Estilo"));
    expect(screen.getByRole("radio", { name: /Biblia/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText("LETRA ANIMADA")).toBeNull();
    expect(screen.getByText("VERSÍCULOS")).toBeTruthy();
    const temas = screen.getAllByRole("button").filter((b) => /Azul|Noche|Escenario|Cálido|Bosque/i.test(b.textContent || ""));
    const otroTema = temas.find((b) => !/Escenario/i.test(b.textContent));
    fireEvent.click(otroTema);
    expect(estilo.theme).toBe("stage"); // las canciones siguen igual
    expect(estilo.animacion).toBe("aurora");
    expect(estilo.biblia.theme).not.toBe("stage");
    expect(estilo.biblia).not.toHaveProperty("animacion");
  });
  it("con una canción al aire edita Canciones (con letra animada), y se puede cambiar a Biblia a mano", () => {
    render(<Consola alAire={cancion} onEstilo={() => {}} />);
    fireEvent.click(screen.getByTitle("Estilo"));
    expect(screen.getByRole("radio", { name: /Canciones/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("LETRA ANIMADA")).toBeTruthy();
    expect(screen.queryByText("VERSÍCULOS")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Biblia/ }));
    expect(screen.queryByText("LETRA ANIMADA")).toBeNull();
    expect(screen.getByText("VERSÍCULOS")).toBeTruthy();
  });
  it("con una canción al aire, el fondo elegido para la Biblia se guarda y se ve en una muestra", () => {
    let estilo = null;
    render(<Consola alAire={cancion} onEstilo={(s) => { estilo = s; }} />);
    fireEvent.click(screen.getByTitle("Estilo"));
    expect(screen.queryByTestId("muestra-estilo")).toBeNull(); // editando lo mismo que está al aire
    fireEvent.click(screen.getByRole("radio", { name: /Biblia/ }));
    expect(screen.getByTestId("muestra-estilo").textContent).toMatch(/ASÍ SE VERÁ LA BIBLIA/);
    fireEvent.click(screen.getAllByRole("button").find((b) => /Azul noche/i.test(b.textContent || "")));
    expect(estilo.biblia.theme).toBe("azul");
    expect(estilo.theme).toBe("stage");
  });
  it("cambiar el fondo de las canciones no le cambia el fondo a la Biblia", () => {
    let estilo = null;
    render(<Consola alAire={cancion} onEstilo={(s) => { estilo = s; }} />);
    fireEvent.click(screen.getByTitle("Estilo"));
    fireEvent.click(screen.getAllByRole("button").find((b) => (b.textContent || "").trim() === "Cálido"));
    expect(estilo.theme).toBe("calido");
    expect(estilo.biblia.theme).toBe("stage");
  });
  it("lo elegido a mano en 'Estilo para' no se cambia solo al pasar de versículo a canción", () => {
    const { rerender } = render(<Consola alAire={versiculo} onEstilo={() => {}} />);
    fireEvent.click(screen.getByTitle("Estilo"));
    fireEvent.click(screen.getByRole("radio", { name: /Biblia/ }));
    rerender(<Consola alAire={cancion} onEstilo={() => {}} />);
    expect(screen.getByRole("radio", { name: /Biblia/ }).getAttribute("aria-checked")).toBe("true");
  });
});
