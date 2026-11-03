// @vitest-environment jsdom
// Tonalidad (2026-11-03, video de Eldin): al elegir otra tonalidad, el botón elegido queda marcado en
// naranja y el anterior se desmarca. (El error real venía del estilo "al pasar el mouse", que en el
// celular quedaba pegado; eso lo vigila estilosHover.test.js.) Base de datos de ejemplo igual que
// pantallas.test.jsx. (2026-11-02): abren la app completa con una iglesia de ejemplo (un evento
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


describe("ventana de tonalidad", () => {
  it("marca en naranja la tonalidad que se toca", async () => {
    abrirApp();
    await screen.findByText(/Miembros del equipo/, {}, { timeout: 4000 });
    await irA("Canciones");
    fireEvent.click((await screen.findAllByText(/Grande es tu fidelidad/))[0]);
    await screen.findByText(/Auto-avance/);
    fireEvent.click(screen.getByTitle("Cambiar tonalidad"));
    const dialogo = await screen.findByText(/Original/);
    const caja = dialogo.parentElement;
    const btn = (t) => within(caja).getAllByRole("button").find((b) => b.textContent.trim() === t);
    const fondo = (t) => btn(t).style.background;
    expect(fondo("D")).toContain("brand-accent");
    fireEvent.click(btn("B"));
    await new Promise((r) => setTimeout(r, 100));
    expect({ D: fondo("D"), B: fondo("B") }).toEqual({ D: "var(--wf-hover)", B: "var(--wf-brand-accent)" });
  });
});
