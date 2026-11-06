// @vitest-environment jsdom
// Pruebas de "¿abre la pantalla?" (2026-11-02): abren la app completa con una iglesia de ejemplo (un evento
// con Setlist, una canción, un bosquejo) y recorren las pantallas principales confirmando que se dibujan
// sin errores. No prueban cada botón: son la red de seguridad para mover código entre archivos sin romper
// nada (si una pantalla deja de abrir, esta prueba falla).
import React from "react"; // eslint-disable-line no-unused-vars
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { crearSupabaseFalso } from "./apoyo/supabasePantallas.js";

const IG = "ig-1";
const U = "u-admin";
const HOY = new Date();
const fecha = (dias) => { const d = new Date(HOY); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
const EV = "ev-1";
const datos = {
  iglesias: [{ id: IG, nombre: "Iglesia de Prueba", slug: "prueba", activa: true }],
  usuarios: [
    { id: U, nombre: "Ana Admin", rol: "admin", rol_id: null, iglesia_id: IG, email: "admin@iglesia.org" },
    { id: "u-2", nombre: "Pedro Predicador", rol: "miembro", rol_id: null, iglesia_id: IG, email: "pedro@iglesia.org" },
  ],
  canciones: [{ id: "s1", titulo: "Grande es tu fidelidad", artista: "Tradicional", tonalidad: "D", tempo: 72, iglesia_id: IG }],
  secciones_cancion: [
    { id: "sc1", cancion_id: "s1", clave: "V1", etiqueta: "Verso 1", contenido: "[D]Oh Dios eterno, tu misericordia", compases: 8 },
    { id: "sc2", cancion_id: "s1", clave: "C", etiqueta: "Coro", contenido: "[G]Oh tu fidelidad, oh tu fidelidad", compases: 8 },
  ],
  estructura_cancion: [{ id: "e1", cancion_id: "s1", seccion_clave: "V1", multiplicador: 1, orden: 0 }, { id: "e2", cancion_id: "s1", seccion_clave: "C", multiplicador: 2, orden: 1 }],
  diapositivas_letra: [
    { id: "d1", cancion_id: "s1", seccion_clave: "V1", texto: "Oh Dios eterno\ntu misericordia", orden: 0 },
    { id: "d2", cancion_id: "s1", seccion_clave: "C", texto: "Oh tu fidelidad\noh tu fidelidad", orden: 0 },
  ],
  eventos: [{ id: EV, titulo: "Culto dominical", fecha: fecha(3), hora: "10:00:00", fecha_label: "", ubicacion: "Templo", es_plantilla: false, iglesia_id: IG }],
  items_servicio: [
    { id: "i1", evento_id: EV, orden: 0, tipo: "bloque", titulo: "Alabanza", descripcion: "", estructura: [] },
    { id: "i2", evento_id: EV, orden: 1, tipo: "cancion", cancion_id: "s1", estructura: [], canciones: { titulo: "Grande es tu fidelidad", artista: "Tradicional", tonalidad: "D", tempo: 72 } },
    { id: "i3", evento_id: EV, orden: 2, tipo: "bloque", titulo: "Predicación", descripcion: "", estructura: [] },
    { id: "i4", evento_id: EV, orden: 3, tipo: "slide", titulo: "La gracia que transforma", subtitulo: "Juan 3:16", es_punto_bosquejo: true, fondo_tipo: "color", estructura: { bosquejoDe: "i3" } },
    { id: "i5", evento_id: EV, orden: 4, tipo: "biblia", referencia: "Juan 3:16", version_biblia: "RVR1960", texto_biblia: "Porque de tal manera amó Dios al mundo", estructura: { bosquejoDe: "i3", punto: 1 } },
  ],
  miembros_rol: [{ id: "m1", item_servicio_id: "i3", nombre: "Pedro Predicador", usuario_id: "u-2", estado: "confirmado", lead: false, orden: 0 }],
  bosquejos: [{ item_servicio_id: "i3", evento_id: EV, titulo: "La gracia que transforma", puntos: [{ id: "p1", titulo: "Su amor", nota: "Nota privada", versiculos: [] }], enviado_at: new Date().toISOString() }],
  ministerios: [{ id: "min-1", nombre: "Alabanza", color: "#E8821E", lider_id: U, permisos_lider: {}, iglesia_id: IG }],
  roles_app: [],
};

const falso = crearSupabaseFalso(datos);
vi.mock("../lib/supabaseClient.js", () => ({
  supabase: falso,
  callUsersFunction: () => Promise.resolve({}),
}));

// Lo que el navegador tiene y jsdom no (antes de cargar la app: algunas cosas se leen al importarla).
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.scrollTo = () => {};
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function () {};
Element.prototype.scrollTo = Element.prototype.scrollTo || function () {};
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
HTMLCanvasElement.prototype.getContext = () => null;
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = () => {};
HTMLElement.prototype.requestFullscreen = HTMLElement.prototype.requestFullscreen || (() => Promise.resolve());
afterEach(() => {
  cleanup();
  // Cada prueba arranca de cero: la app recuerda la última pestaña y otras cosas en este dispositivo.
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* nada */ }
  window.history.replaceState(null, "", "/");
});

const { default: App } = await import("../PrototipoWorshipFlow.jsx");
const { CLAVES_TUTORIAL } = await import("../lib/tutoriales.js");
const ErrorPantalla = (await import("../ErrorPantalla.jsx")).default;

function abrirApp() {
  const perfil = { id: U, nombre: "Ana Admin", rol: "admin", iglesia_id: IG, email: "admin@iglesia.org", tutoriales_vistos: Object.values(CLAVES_TUTORIAL), iglesias: datos.iglesias[0] };
  const myIglesia = { slug: "prueba", nombre: "Iglesia de Prueba", logoUrl: null, colorPrimario: null, colorAcento: null, categoriasCanciones: null, formatoLetra: "dos_lineas", dividirVersiculos: false };
  return render(
    <ErrorPantalla>
      <App userId={U} perfil={perfil} myIglesia={myIglesia} onIglesiaActualizada={() => {}} onGoToUsuarios={() => {}} onGoToRoles={() => {}} onGoToPlataforma={null} />
    </ErrorPantalla>,
  );
}

// Si alguna pantalla se rompe, ErrorPantalla muestra su aviso con "Recargar".
function sinPantallaDeError() {
  expect(screen.queryByRole("button", { name: /recargar/i })).toBeNull();
}

const navegacion = () => screen.getAllByRole("button").filter((b) => /^(Inicio|Canciones|Eventos|Grupos|Ajustes)$/.test(b.textContent.trim()));
async function irA(nombre) {
  const boton = navegacion().find((b) => b.textContent.trim() === nombre);
  expect(boton, `botón de navegación "${nombre}"`).toBeTruthy();
  fireEvent.click(boton);
  await new Promise((r) => setTimeout(r, 50));
}

describe("¿abre la pantalla?", () => {
  it("abre la app e Inicio", async () => {
    abrirApp();
    expect(await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 })).toBeTruthy();
    sinPantallaDeError();
  });

  it("recorre Canciones, Eventos, Grupos y Ajustes", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Canciones");
    expect(await screen.findAllByText(/Grande es tu fidelidad/)).not.toHaveLength(0);
    sinPantallaDeError();
    await irA("Eventos");
    expect(await screen.findAllByText(/Culto dominical/)).not.toHaveLength(0);
    sinPantallaDeError();
    await irA("Grupos");
    expect(await screen.findAllByText(/Alabanza/)).not.toHaveLength(0);
    sinPantallaDeError();
    await irA("Ajustes");
    expect(await screen.findByText(/Pantallas y TV/)).toBeTruthy();
    sinPantallaDeError();
  });

  it("abre una canción", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Canciones");
    fireEvent.click((await screen.findAllByText(/Grande es tu fidelidad/))[0]);
    // Vista de la canción (letra con acordes, tempo y auto-avance del Modo Músico).
    expect(await screen.findByText(/Auto-avance/)).toBeTruthy();
    expect(document.body.textContent.replace(/\s+/g, " ")).toMatch(/Oh Dios eterno, tu misericordia/);
    sinPantallaDeError();
  });

  it("en el editor de la canción se pueden mover las partes en Contenido", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Canciones");
    fireEvent.click((await screen.findAllByText(/Grande es tu fidelidad/))[0]);
    fireEvent.click(await screen.findByRole("button", { name: /^Editar$/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Contenido" }));
    const orden = () => [...document.querySelectorAll("[data-parte]")].map((el) => el.getAttribute("data-parte"));
    expect(orden()).toEqual(["V1", "C"]);
    fireEvent.click(screen.getByRole("button", { name: "Subir Coro" }));
    expect(orden()).toEqual(["C", "V1"]);
    fireEvent.click(screen.getByRole("button", { name: "Bajar Coro" }));
    expect(orden()).toEqual(["V1", "C"]);
    // En el celular, mantener presionado dentro de la letra debe abrir el menú de Copiar/Pegar/Seleccionar
    // todo (en Android sale con el evento contextmenu): la parte arrastrable no lo puede bloquear.
    const letra = document.querySelector('[data-parte="V1"] textarea');
    expect(fireEvent.contextMenu(letra)).toBe(true);
    expect(fireEvent.contextMenu(document.querySelector('[data-parte="V1"] input'))).toBe(true);
    // Fuera de los campos (la barra de la parte) sí se bloquea, para poder arrastrar.
    expect(fireEvent.contextMenu(document.querySelector('[data-parte="V1"]'))).toBe(false);
    sinPantallaDeError();
  });

  it("abre el evento con su Setlist y el bosquejo", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Eventos");
    fireEvent.click((await screen.findAllByText(/Culto dominical/))[0]);
    expect(await screen.findAllByText(/Predicación/)).not.toHaveLength(0);
    expect(await screen.findAllByText(/La gracia que transforma/)).not.toHaveLength(0);
    sinPantallaDeError();
  });

  it("el bloque de Predicación trae marcado \"Este bloque es la predicación\" y se puede desmarcar", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Eventos");
    fireEvent.click((await screen.findAllByText(/Culto dominical/))[0]);
    await screen.findAllByText(/Predicación/);
    const fila = document.querySelector('[data-item-id="i3"]');
    fireEvent.click(within(fila).getByTitle("Encargados"));
    const casilla = within(fila).getByRole("checkbox", { name: /Este bloque es la predicación/ });
    expect(casilla.checked).toBe(true);
    expect(within(fila).getByText(/Agregar bosquejo|Ver bosquejo|Bosquejo/)).toBeTruthy();
    fireEvent.click(casilla);
    expect(within(fila).getByRole("checkbox", { name: /Este bloque es la predicación/ }).checked).toBe(false);
    expect(within(fila).queryByText(/Agregar bosquejo|Ver bosquejo|Bosquejo/)).toBeNull();
    // Otro bloque cualquiera empieza sin marcar.
    const alabanza = document.querySelector('[data-item-id="i1"]');
    fireEvent.click(within(alabanza).getByTitle("Encargados"));
    expect(within(alabanza).getByRole("checkbox", { name: /Este bloque es la predicación/ }).checked).toBe(false);
    sinPantallaDeError();
  });

  it("inicia la transmisión y abre la consola en vivo y el panel Escenario", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Eventos");
    fireEvent.click((await screen.findAllByText(/Culto dominical/))[0]);
    await screen.findAllByText(/Predicación/);
    const iniciar = screen.getAllByRole("button").find((b) => /iniciar (evento|transmisi)/i.test(b.textContent));
    expect(iniciar, "botón para iniciar la transmisión").toBeTruthy();
    fireEvent.click(iniciar);
    await new Promise((r) => setTimeout(r, 300));
    sinPantallaDeError();
    // Consola en vivo abierta (diapositivas de la canción y el bosquejo en el orden del culto).
    expect(screen.getAllByRole("button").some((b) => /Finalizar evento/.test(b.textContent))).toBe(true);
    const mas = screen.getAllByRole("button").find((b) => /Más herramientas/.test(b.textContent));
    if (mas) fireEvent.click(mas);
    await new Promise((r) => setTimeout(r, 100));
    // Sin espacio (la cinta se adapta al ancho), los grupos quedan en "Más opciones".
    const masOpciones = screen.getAllByRole("button").find((b) => /^Más opciones/.test(b.textContent.trim()));
    if (masOpciones) fireEvent.click(masOpciones);
    const escenario = await screen.findAllByRole("button", { name: /escenario/i });
    fireEvent.click(escenario[0]);
    const panel = await screen.findByRole("dialog", { name: /escenario/i });
    expect(within(panel).getByText(/Temporizador del mensaje/i)).toBeTruthy();
    sinPantallaDeError();
  });

  it("agrega una cuenta regresiva al Setlist y se proyecta al iniciar", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Eventos");
    fireEvent.click((await screen.findAllByText(/Culto dominical/))[0]);
    await screen.findAllByText(/Predicación/);
    fireEvent.click(document.querySelector('[data-tour="evento-editar-setlist"]'));
    fireEvent.click(await screen.findByText("Cuenta regresiva"));
    const ventana = await screen.findByRole("dialog", { name: "Cuenta regresiva" });
    fireEvent.click(within(ventana).getByRole("button", { name: "Por minutos" }));
    fireEvent.click(within(ventana).getByRole("button", { name: "3 min" }));
    fireEvent.click(within(ventana).getByTitle("Pizarra"));
    fireEvent.click(within(ventana).getByRole("button", { name: "Agregar al Setlist" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getAllByText(/3 min · Pizarra/).length).toBeGreaterThan(0);
    sinPantallaDeError();
    // Va primero en el culto: al iniciar la transmisión es lo que sale al aire.
    // (Si la prueba anterior dejó la transmisión andando, basta con ir a En vivo.)
    const iniciar = screen.getAllByRole("button").find((b) => /iniciar (evento|transmisi)/i.test(b.textContent))
      || screen.getAllByRole("button").find((b) => b.textContent.trim() === "En vivo");
    fireEvent.click(iniciar);
    await new Promise((r) => setTimeout(r, 300));
    expect(document.querySelector('[aria-label^="Cuenta regresiva: 03:00"], [aria-label^="Cuenta regresiva: 02:5"]')).toBeTruthy();
    expect(screen.getAllByRole("button").some((b) => /Reiniciar cuenta regresiva/.test(b.textContent))).toBe(true);
    sinPantallaDeError();
  });
});
