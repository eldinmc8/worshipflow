// @vitest-environment jsdom
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const importarBiblia = vi.fn(async ({ onProgreso }) => { onProgreso?.(1, 1); return "nueva"; });
vi.mock("../lib/supabaseClient.js", () => ({ supabase: {}, callUsersFunction: vi.fn() }));
vi.mock("../lib/bibliasIglesia.js", async (orig) => ({ ...(await orig()), importarBiblia: (...a) => importarBiblia(...a) }));
const { default: BibliasIglesia } = await import("../components/BibliasIglesia.jsx");
afterEach(cleanup);

const XML = `<XMLBIBLE biblename="Ixil"><INFORMATION><language>Ixil</language></INFORMATION><BIBLEBOOK bnumber="43" bname="Juan"><CHAPTER cnumber="3"><VERS vnumber="16">Ye' Kub'aal</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`;

describe("Ajustes → Biblias de la iglesia", () => {
  it("lee el archivo, muestra un versículo de muestra y guarda con la abreviatura elegida", async () => {
    render(<BibliasIglesia iglesiaId="igl" usuarioId="u" />);
    expect(screen.getByText(/Todavía no han importado/)).toBeTruthy();
    const archivo = new File([XML], "ixil.xml", { type: "text/xml" });
    if (!archivo.arrayBuffer) archivo.arrayBuffer = async () => new TextEncoder().encode(XML).buffer;
    fireEvent.change(screen.getByLabelText("Archivo de la Biblia (.xml)"), { target: { files: [archivo] } });
    await waitFor(() => expect(screen.getByText("Juan 3:16")).toBeTruthy());
    expect(screen.getByText("Ye' Kub'aal")).toBeTruthy();
    const codigo = screen.getByLabelText(/Abreviatura/);
    expect(codigo.value).toBe("IXIL");
    fireEvent.change(codigo, { target: { value: "rv1960" } });
    expect(screen.getByRole("alert").textContent).toMatch(/Ya hay una versión con la abreviatura RV1960/);
    fireEvent.change(codigo, { target: { value: "ixl" } });
    fireEvent.click(screen.getByText("Guardar Biblia"));
    await waitFor(() => expect(importarBiblia).toHaveBeenCalled());
    expect(importarBiblia.mock.calls[0][0]).toMatchObject({ iglesiaId: "igl", codigo: "IXL", idioma: "Ixil", reemplazaId: null });
  });
});
