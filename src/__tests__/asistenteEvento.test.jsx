// @vitest-environment jsdom
// Nueva plantilla y Nuevo evento por pasos.
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import AsistenteEvento from "../components/AsistenteEvento.jsx";

afterEach(cleanup);
const library = [{ id: "s2", title: "Way Maker", artist: "Sinach", key: "E" }, { id: "s1", title: "Al que está sentado", artist: "Unknown", key: "G" }];
const usuarios = [{ id: "u1", nombre: "Ana" }, { id: "u2", nombre: "Beto" }];
const siguiente = () => fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

describe("AsistenteEvento", () => {
  it("arma una plantilla paso a paso: nombre, momentos, contenido, encargados", async () => {
    const onCrear = vi.fn(async (d) => ({ id: "nueva", ...d }));
    const onPublicarVarias = vi.fn();
    render(<AsistenteEvento modo="plantilla" library={library} usuarios={usuarios} onCrear={onCrear} onPublicarVarias={onPublicarVarias} onCerrar={() => {}} />);
    expect(screen.getByRole("button", { name: /Siguiente/ }).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/Culto de oración/), { target: { value: "Culto de oración" } });
    fireEvent.change(document.querySelector('input[type="time"]'), { target: { value: "19:00" } });
    siguiente();
    fireEvent.click(screen.getByRole("button", { name: /Bienvenida/ }));
    fireEvent.click(screen.getByRole("button", { name: /Alabanza/ }));
    siguiente();
    // Contenido (computadora): cuenta regresiva y una canción en Alabanza
    fireEvent.click(screen.getByRole("button", { name: "Hasta la hora del culto" }));
    fireEvent.click(screen.getAllByRole("button", { name: /Canción/ })[1]);
    fireEvent.click(screen.getByText("Way Maker"));
    siguiente();
    // Encargados
    fireEvent.click(screen.getAllByRole("button", { name: "Ana" })[0]);
    siguiente();
    expect(screen.getByText("¡Tu plantilla está lista!")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Guardar y publicar en varias fechas/ })); });
    const [datos, opciones] = onCrear.mock.calls[0];
    expect(datos).toMatchObject({ title: "Culto de oración", hora: "19:00", esPlantilla: true, date: null });
    expect(datos.serviceOrder.map((o) => o.type === "seccion" ? o.title : o.type)).toEqual(["slide", "Bienvenida", "Alabanza", "cancion"]);
    expect(datos.serviceOrder[1].encargados[0]).toMatchObject({ usuarioId: "u1", status: "pendiente" });
    expect(opciones).toEqual({ abrir: false });
    expect(onPublicarVarias).toHaveBeenCalledWith(expect.objectContaining({ id: "nueva" }));
  });

  it("en el celular solo se agregan canciones (sin cuenta regresiva ni diapositivas)", () => {
    render(<AsistenteEvento modo="plantilla" library={library} usuarios={usuarios} isCompact onCrear={vi.fn()} onCerrar={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText(/Culto de oración/), { target: { value: "X" } });
    siguiente();
    fireEvent.click(screen.getByRole("button", { name: /Alabanza/ }));
    siguiente();
    expect(screen.queryByText(/Cuenta regresiva antes de iniciar/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Versículo/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Canción/ })).toBeTruthy();
  });

  it("evento desde una plantilla: elige la plantilla y el título sale de la fecha y la hora", async () => {
    const onCrear = vi.fn(async (d) => d);
    const plantillas = [{ id: "p1", title: "Culto de oración", serviceOrder: [{}, {}], hora: "19:00:00" }];
    render(<AsistenteEvento modo="evento" plantillas={plantillas} library={library} usuarios={usuarios} onCrear={onCrear} onCerrar={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Desde una plantilla/ }));
    fireEvent.click(screen.getByRole("button", { name: /Culto de oración/ }));
    siguiente();
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-11-25" } });
    expect(screen.getByDisplayValue("Miércoles 25 de noviembre · 7:00 pm")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Crear evento/ })); });
    expect(onCrear.mock.calls[0][0]).toMatchObject({ templateId: "p1", date: "2026-11-25", hora: "19:00", title: "Miércoles 25 de noviembre · 7:00 pm", esPlantilla: false });
  });

  it("evento especial: tiene los pasos de momentos, contenido y encargados", () => {
    render(<AsistenteEvento modo="evento" plantillas={[]} library={library} usuarios={usuarios} onCrear={vi.fn()} onCerrar={() => {}} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["1¿Cómo?", "2Datos", "3Momentos", "4Contenido", "5Encargados", "6Listo"]);
  });
});
