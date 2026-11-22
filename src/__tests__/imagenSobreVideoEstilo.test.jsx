// @vitest-environment jsdom
// Video de Eldin (2026-11-22): con un VIDEO de fondo en Estilo, la diapositiva "Imagen" (Agregar →
// Imagen) salía con el video y la imagen elegida nunca se veía, ni en la vista previa ni al proyectar.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("../lib/supabaseClient.js", () => ({ supabase: { from: () => ({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} }, callUsersFunction: async () => ({}) }));
const { ProjectionPanel } = await import("../pantallas/proyeccion.jsx");
afterEach(cleanup);
globalThis.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };

const estiloConVideo = { theme: "custom", customBgType: "video", customVideo: "https://ejemplo.org/fondo.mp4", font: "elegante" };

describe("Imagen propia de la diapositiva con video de fondo en Estilo", () => {
  it("se ve la imagen de la diapositiva, no el video de Estilo", () => {
    const slide = { slideId: "i1", type: "slide", title: "", subtitle: "", bg: "#1B2029", bgType: "imagen", imageUrl: "https://ejemplo.org/renovacion.png" };
    const { container } = render(<ProjectionPanel slide={slide} blanked={false} split={false} liveStyle={estiloConVideo} />);
    // jsdom no entiende el "background" abreviado: se revisa que no se monte el video de Estilo.
    expect(container.innerHTML).not.toContain("fondo.mp4");
  });
  it("una diapositiva sin fondo propio sigue con el video de Estilo", () => {
    const slide = { slideId: "t1", type: "slide", title: "Bienvenidos", subtitle: "", bg: "#1B2029", bgType: "color" };
    const { container } = render(<ProjectionPanel slide={slide} blanked={false} split={false} liveStyle={estiloConVideo} />);
    expect(container.innerHTML).toContain("fondo.mp4");
  });
});
