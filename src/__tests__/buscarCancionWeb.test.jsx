// @vitest-environment jsdom
// Buscar canción en internet (2026-11-11): buscar → elegir → revisar → agregar a la biblioteca. La
// función del servidor se reemplaza por páginas reales de LaCuerda guardadas en fixtures.
import React from "react"; // eslint-disable-line no-unused-vars
import fs from "fs";
import path from "path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const fixture = (n) => fs.readFileSync(path.join(process.cwd(), "src/lib/__tests__/fixtures", n), "utf8");
const llamadas = [];
const servidor = { falla: null };
vi.mock("../lib/supabaseClient.js", () => ({
  supabase: {},
  callUsersFunction: vi.fn(async (nombre, body) => {
    llamadas.push({ nombre, body });
    if (servidor.falla) throw new Error(servidor.falla);
    if (body.accion === "buscar") return { html: fixture("lacuerda-busqueda.html") };
    return { html: fixture(body.version === 2 ? "lacuerda-cancion-v2.html" : "lacuerda-cancion.html") };
  }),
}));
const guardadas = [];
vi.mock("../lib/canciones.js", () => ({ guardarCancionDesdeEditor: vi.fn(async (draft) => { guardadas.push(draft); return "id-nuevo"; }) }));
vi.mock("../lib/adjuntosCancion.js", () => ({ subirAdjunto: vi.fn() }));
vi.mock("../lib/importarCancionesPdf.js", () => ({ cancionesDePdf: vi.fn() }));
afterEach(() => { cleanup(); llamadas.length = 0; guardadas.length = 0; servidor.falla = null; });

const { default: BuscarCancionWeb } = await import("../components/BuscarCancionWeb.jsx");

async function buscar(texto) {
  fireEvent.change(screen.getByLabelText("Buscar canción"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

describe("buscar canción en internet", () => {
  it("busca, abre una canción, deja revisarla y la guarda con acordes, partes y diapositivas", async () => {
    const onImportadas = vi.fn();
    render(<BuscarCancionWeb library={[{ title: "Cuán grande es Dios" }]} clasificaciones={[{ clave: "himno", nombre: "Himno" }]} userId="u1" onCerrar={() => {}} onImportadas={onImportadas} />);
    await buscar("cuan grande es el");
    fireEvent.click((await screen.findByText(/^Marcos Witt/)).closest("button"));
    expect(llamadas[0]).toEqual({ nombre: "buscar-cancion-web", body: { accion: "buscar", q: "cuan grande es el" } });
    // La que ya está en la biblioteca (mismo título, sin contar tildes ni mayúsculas) se marca.
    expect(screen.getAllByText(/Ya la tienes/).length).toBeGreaterThan(0);

    expect((await screen.findByLabelText("Título")).value).toBe("Cuan grande es El");
    expect(llamadas[1].body).toEqual({ accion: "cancion", ruta: "marcos_witt/cuan_grande_es_el", version: 1 });
    expect(screen.getByLabelText("Autor").value).toBe("Marcos Witt");
    expect(screen.getByLabelText("Tono").value).toBe("D");

    // Cambiar de versión trae la otra.
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(await screen.findByText("Estrofa 1")).toBeTruthy();
    expect(screen.getByLabelText("Tono").value).toBe("E");

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Cuán grande es Él" } });
    fireEvent.click(screen.getByRole("button", { name: "Agregar a la biblioteca" }));
    expect(await screen.findByText("1 canción agregada a tu biblioteca")).toBeTruthy();
    expect(onImportadas).toHaveBeenCalledTimes(1);
    const [g] = guardadas;
    expect(g).toMatchObject({ title: "Cuán grande es Él", artist: "Marcos Witt", key: "E", category: "himno" });
    expect(Object.values(g.blocks).map((b) => b.label)).toEqual(["Estrofa 1", "Coro"]);
    expect(Object.values(g.blocks)[0].lines[0]).toBe("[E]Señor mi [A]Dios al c[Em]ontemp[A7]lar los ci[D]elos");
    expect(Object.values(g.letra)[0][0]).toEqual(["Señor mi Dios al contemplar los cielos", "El firmamento y las estrellas mil"]);
  });

  it("si el servidor falla lo dice, y ofrece buscar en otros sitios para pegar la letra", async () => {
    render(<BuscarCancionWeb onCerrar={() => {}} />);
    servidor.falla = "LaCuerda no respondió. Intenta de nuevo en un momento.";
    await buscar("renuevame");
    expect((await screen.findByRole("alert")).textContent).toContain("LaCuerda no respondió");
    const enlace = (await screen.findByText("Cifra Club")).closest("a");
    expect(enlace.href).toBe("https://www.cifraclub.com/?q=renuevame");
    expect(enlace.target).toBe("_blank");
  });
});
