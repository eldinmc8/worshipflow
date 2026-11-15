// @vitest-environment jsdom
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen, within } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => {
  const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, in: () => q, maybeSingle: async () => ({ data: null, error: null }), single: async () => ({ data: null, error: null }), then: (r) => r({ data: [], error: null }) };
  return { supabase: { from: () => q, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; }, send: async () => {} }), removeChannel: () => {}, storage: { from: () => ({ list: async () => ({ data: [] }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) }, auth: { getSession: async () => ({ data: { session: null } }) } }, callUsersFunction: async () => ({}) };
});
const { MultimediaControl } = await import("../pantallas/envivo.jsx");
const { ProjectionPanel } = await import("../pantallas/proyeccion.jsx");
const { estiloDeBiblia } = await import("../lib/estiloBiblia.js");
afterEach(cleanup);
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };

const cancion = { slideId: "c1", type: "cancion", songId: "s1", songTitle: "Cuán grande", blockLabel: "Verso 1", blockKey: "V1", lines: ["Señor mi Dios", "al contemplar los cielos"] };

function Consola({ inicial, onEstilo }) {
  const [liveStyle, setLiveStyle] = useState(inicial);
  onEstilo(liveStyle);
  return <MultimediaControl eventTitle="Culto" serviceOrder={[]} library={[]} slides={[cancion]} activeIdx={0} adHocIdx={0} goto={() => {}} gotoPlanSlide={() => {}} blanked={false} setBlanked={() => {}} current={cancion} next={null} onEnd={() => {}} canEnd liveOwner="yo" liveStyle={liveStyle} setLiveStyle={setLiveStyle} isCompact={false} myIglesiaId="igl" onOpenPublicScreen={() => {}} />;
}
// La letra de la canción proyectada (el bloque que lleva la familia de letra).
const letraProyectada = (container) => [...container.querySelectorAll("[style]")].find((el) => el.style.fontFamily && el.textContent.includes("Señor mi Dios"));

describe("Letra animada: el panel de Estilo también la cambia", () => {
  it("con letra animada, tipografía, color, espacio y sombra van a la letra animada (y 'Del estilo' la deja como venía)", () => {
    let estilo = null;
    render(<Consola inicial={{ theme: "stage", font: "elegante", animacion: "suave" }} onEstilo={(s) => { estilo = s; }} />);
    fireEvent.click(screen.getByText("Estilo"));
    expect(screen.getByText(/lo que elijas aquí cambia la letra animada/)).toBeTruthy();
    const tipo = screen.getByLabelText("Tipografía");
    expect(tipo.value).toBe(""); // Del estilo animado
    fireEvent.change(tipo, { target: { value: "moderna" } });
    fireEvent.click(screen.getByLabelText("Letra Amarillo suave"));
    fireEvent.click(screen.getByLabelText("Más espacio entre letras"));
    fireEvent.click(within(screen.getByRole("group", { name: "Sombra de la letra" })).getByText("Fuerte"));
    expect(estilo.animLetra).toMatchObject({ font: "moderna", textColor: "#F5D67B", espaciado: 0.01, sombra: "fuerte" });
    expect(estilo.font).toBe("elegante"); // la letra normal no se toca
    expect(estilo.textColor).toBeUndefined();
    expect(estiloDeBiblia(estilo)).not.toHaveProperty("animLetra"); // es solo de canciones
    fireEvent.change(screen.getByLabelText("Tipografía"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Color de letra: el del estilo animado"));
    expect(estilo.animLetra).not.toHaveProperty("font");
    expect(estilo.animLetra).not.toHaveProperty("textColor");
    expect(screen.queryByLabelText("Diseño de la letra")).toBeNull(); // no aplica con letra animada
  });
  it("sin letra animada, el panel sigue cambiando la letra de siempre", () => {
    let estilo = null;
    render(<Consola inicial={{ theme: "stage", font: "elegante" }} onEstilo={(s) => { estilo = s; }} />);
    fireEvent.click(screen.getByText("Estilo"));
    fireEvent.change(screen.getByLabelText("Tipografía"), { target: { value: "moderna" } });
    expect(estilo.font).toBe("moderna");
    expect(estilo.animLetra).toBeUndefined();
  });
  it("la proyección usa la tipografía y el color elegidos para la letra animada", () => {
    const base = { theme: "stage", animacion: "suave" };
    const { container, rerender } = render(<ProjectionPanel slide={cancion} blanked={false} split={false} liveStyle={base} />);
    expect(letraProyectada(container).style.fontFamily).toContain("Fraunces"); // la del estilo "Suave"
    rerender(<ProjectionPanel slide={cancion} blanked={false} split={false} liveStyle={{ ...base, animLetra: { font: "moderna", textColor: "#F5D67B" } }} />);
    const el = letraProyectada(container);
    expect(el.style.fontFamily).toContain("Poppins");
    expect(el.style.color).toBe("rgb(245, 214, 123)");
    // El color elegido también tiene que ganarles a los colores que el estilo pinta palabra por palabra
    // (palabras clave, segunda línea, multicolor, karaoke): para eso va la clase wf-color-propio (index.css).
    expect(el.className).toContain("wf-color-propio");
    expect(el.style.getPropertyValue("--wf-letra")).toBe("#F5D67B");
  });
  it("sin color elegido, el estilo animado conserva sus colores", () => {
    const { container } = render(<ProjectionPanel slide={cancion} blanked={false} split={false} liveStyle={{ theme: "stage", animacion: "impacto", animLetra: { font: "moderna" } }} />);
    expect(letraProyectada(container).className).not.toContain("wf-color-propio");
  });
});
