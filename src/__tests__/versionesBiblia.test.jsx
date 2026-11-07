// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
const { BIBLE_VERSIONS, SelectorVersionBiblia } = await import("../pantallas/compartido.jsx");
const { stripBibleSearchMarkup } = await import("../lib/textoBiblia.js");
afterEach(cleanup);

// Más versiones de la Biblia, también en inglés (pedido de Eldin, 2026-11-07).
describe("versiones de la Biblia", () => {
  it("trae español e inglés, sin códigos repetidos y sin la familia NIV (devuelve una protesta en vez del texto)", () => {
    const codigos = BIBLE_VERSIONS.map((v) => v.code);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(BIBLE_VERSIONS[0].code).toBe("RV1960");
    expect(BIBLE_VERSIONS.filter((v) => v.idioma === "es").length).toBeGreaterThanOrEqual(6);
    expect(BIBLE_VERSIONS.filter((v) => v.idioma === "en").length).toBeGreaterThanOrEqual(25);
    for (const prohibida of ["NVI", "NIV", "NIV2011", "NIVUK", "NIRV", "TNIV"]) expect(codigos).not.toContain(prohibida);
  });

  it("quita los números de Strong (KJV/ASV) y las notas al pie (CSB/NABRE) sin partir palabras", () => {
    expect(stripBibleSearchMarkup("For<S>1063</S> God<S>2316</S> so<S>3779</S> loved<S>25</S> the world")).toBe("For God so loved the world");
    expect(stripBibleSearchMarkup("For God loved <sup>ⓜ</sup>the world in this way: <sup>[5]</sup>He gave")).toBe("For God loved the world in this way: He gave");
    expect(stripBibleSearchMarkup("gave <sup>[7]</sup> his only Son. <sup>[AK]</sup>")).toBe("gave his only Son.");
    expect(stripBibleSearchMarkup("tu<i>s</i> obras")).toBe("tus obras");
  });

  it("el selector agrupa por idioma y avisa la versión elegida", () => {
    const onChange = vi.fn();
    render(<SelectorVersionBiblia value="RV1960" onChange={onChange} />);
    const select = screen.getByLabelText("Versión de la Biblia");
    expect(select.querySelectorAll("optgroup")).toHaveLength(2);
    fireEvent.change(select, { target: { value: "ESV" } });
    expect(onChange).toHaveBeenCalledWith("ESV");
  });
});
