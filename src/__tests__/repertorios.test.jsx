// @vitest-environment jsdom
// Repertorios (2026-11-26): listas fijas de canciones para ensayar sin evento, y "Agregar repertorio"
// en el setlist de un culto.
import React, { useState } from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
vi.mock("../lib/supabaseClient.js", () => ({ supabase: { rpc: () => Promise.resolve({ data: null, error: null }), from: () => ({}), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} }, callUsersFunction: vi.fn() }));
import { CancionesList } from "../pantallas/canciones.jsx";
import { RepertoriosPane, ElegirRepertorio } from "../components/Repertorios.jsx";
import { idsDe, tonosDe, ponerTono, armarCanciones, entradasDe, quitarCancion } from "../lib/repertorios.js";

afterEach(cleanup);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};

const library = [
  { id: "a", title: "Agnus Dei", artist: "", key: "A", tempo: 70, category: "adoracion" },
  { id: "b", title: "Bueno es alabarte", artist: "", key: "G", tempo: 120, category: "alabanza" },
  { id: "c", title: "Cuán grande es Él", artist: "", key: "D", tempo: 72, category: "adoracion" },
];
const repertorios = [
  { id: "r1", nombre: "Lista 1 Alabanza", descripcion: "", canciones: ["b", "a"] },
  { id: "r2", nombre: "Lista 2 Adoración", descripcion: "", canciones: ["c", "borrada"] },
];

function Pantalla({ bloqueado = false, onAbrirCancion = vi.fn(), onBloqueado = vi.fn(), puedeEditar = false, onCambio = vi.fn(), reps = repertorios }) {
  const [vista, setVista] = useState("canciones");
  const [abierto, setAbierto] = useState(null);
  return (
    <CancionesList library={library} clasificaciones={[]} isAdminViewer={puedeEditar} onToggleFavorite={vi.fn()} onOpen={vi.fn()} onNew={vi.fn()} onDelete={vi.fn()}
      vista={vista} onVista={setVista} totalRepertorios={repertorios.length}
      repertoriosPane={<RepertoriosPane repertorios={reps} library={library} puedeEditar={puedeEditar} bloqueado={bloqueado} onBloqueado={onBloqueado}
        abiertoId={abierto} onAbrir={setAbierto} onCerrar={() => setAbierto(null)} onAbrirCancion={onAbrirCancion} onCambio={onCambio} />} />
  );
}

describe("Repertorios", () => {
  it("un músico abre un repertorio y ensaya sus canciones en orden", () => {
    const onAbrirCancion = vi.fn();
    render(<Pantalla onAbrirCancion={onAbrirCancion} />);
    fireEvent.click(screen.getByRole("tab", { name: /Repertorios/ }));
    expect(screen.getByText("Lista 1 Alabanza")).toBeTruthy();
    expect(screen.getByText("1 canción")).toBeTruthy(); // la canción borrada no cuenta
    expect(screen.queryByRole("button", { name: /Nuevo/ })).toBeNull(); // el músico no crea repertorios
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    const titulos = screen.getAllByText(/Bueno es alabarte|Agnus Dei/).map((n) => n.textContent);
    expect(titulos).toEqual(["Bueno es alabarte", "Agnus Dei"]);
    fireEvent.click(screen.getByRole("button", { name: /Ensayar desde el inicio/ }));
    expect(onAbrirCancion).toHaveBeenCalledWith(repertorios[0], "b");
    fireEvent.click(screen.getByText("Agnus Dei"));
    expect(onAbrirCancion).toHaveBeenLastCalledWith(repertorios[0], "a");
  });

  it("en el plan Gratis el repertorio pide plan", () => {
    const onBloqueado = vi.fn();
    render(<Pantalla bloqueado onBloqueado={onBloqueado} />);
    fireEvent.click(screen.getByRole("tab", { name: /Repertorios/ }));
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    expect(onBloqueado).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Ensayar/ })).toBeNull();
  });

  it("Agregar repertorio mete sus canciones al culto, menos las que se desmarcan", () => {
    const onAgregar = vi.fn();
    render(<ElegirRepertorio repertorios={repertorios} library={library} onCerrar={vi.fn()} onAgregar={onAgregar} />);
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    fireEvent.click(screen.getByText("Agnus Dei")); // desmarcar
    fireEvent.click(screen.getByRole("button", { name: /Agregar 1 canción a este culto/ }));
    expect(onAgregar).toHaveBeenCalledWith(["b"], repertorios[0]);
  });

  it("Modo Músico abre la primera canción del repertorio con el avance automático", () => {
    const onAbrirCancion = vi.fn();
    render(<Pantalla onAbrirCancion={onAbrirCancion} />);
    fireEvent.click(screen.getByRole("tab", { name: /Repertorios/ }));
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    fireEvent.click(screen.getByRole("button", { name: /Modo Músico/ }));
    expect(onAbrirCancion).toHaveBeenCalledWith(repertorios[0], "b", { modoMusico: true });
  });

  it("el músico ve el tono del repertorio; quien administra lo cambia sin abrir la canción", () => {
    const conTono = [{ ...repertorios[0], canciones: [{ id: "b", tono: "A" }, "a"] }];
    render(<Pantalla reps={conTono} />);
    fireEvent.click(screen.getByRole("tab", { name: /Repertorios/ }));
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    expect(screen.getByTitle("Original G").textContent).toBe("A");
    cleanup();
    const onAbrirCancion = vi.fn();
    render(<Pantalla reps={conTono} puedeEditar onAbrirCancion={onAbrirCancion} />);
    fireEvent.click(screen.getByRole("tab", { name: /Repertorios/ }));
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    const sel = screen.getByLabelText("Tono de Bueno es alabarte en este repertorio");
    expect(sel.value).toBe("A");
    fireEvent.change(sel, { target: { value: "D" } });
    expect(onAbrirCancion).not.toHaveBeenCalled(); // cambiar el tono no abre la canción
  });

  it("Agregar repertorio entrega el repertorio con sus tonos", () => {
    const onAgregar = vi.fn();
    const conTono = [{ ...repertorios[0], canciones: [{ id: "b", tono: "A" }, "a"] }];
    render(<ElegirRepertorio repertorios={conTono} library={library} onCerrar={vi.fn()} onAgregar={onAgregar} />);
    fireEvent.click(screen.getByText("Lista 1 Alabanza"));
    fireEvent.click(screen.getByRole("button", { name: /Agregar 2 canciones a este culto/ }));
    expect(onAgregar).toHaveBeenCalledWith(["b", "a"], conTono[0]);
    expect(tonosDe(onAgregar.mock.calls[0][1])).toEqual({ b: "A" });
  });
});

describe("Tono propio de una canción en el repertorio", () => {
  const rep = { canciones: ["a", { id: "b", tono: "A" }, { id: "x" }, 5, null] };
  it("lee ids y tonos de las dos formas", () => {
    expect(idsDe(rep)).toEqual(["a", "b", "x"]);
    expect(tonosDe(rep)).toEqual({ b: "A" });
    expect(entradasDe(rep)).toEqual(["a", { id: "b", tono: "A" }, "x"]);
  });
  it("poner el tono original lo quita; otro tono lo guarda", () => {
    expect(ponerTono(rep, "a", "D", "C")).toEqual([{ id: "a", tono: "D" }, { id: "b", tono: "A" }, "x"]);
    expect(ponerTono(rep, "b", "G", "G")).toEqual(["a", "b", "x"]);
  });
  it("ordenar o quitar canciones no pierde los tonos", () => {
    expect(armarCanciones(quitarCancion(idsDe(rep), "a"), tonosDe(rep))).toEqual([{ id: "b", tono: "A" }, "x"]);
  });
});
