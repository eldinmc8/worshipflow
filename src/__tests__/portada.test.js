import { describe, it, expect } from "vitest";
import { mostrarPortada, direccionApp } from "../lib/portada.js";

const base = { hostname: "worshipflowapp.com", pathname: "/", search: "", hash: "" };

// Dominio propio estilo OnStage (2026-11-13): la página web en worshipflowapp.com, la app en app.worshipflowapp.com.
describe("portada en worshipflowapp.com", () => {
  it("en / siempre muestra la página web", () => {
    expect(mostrarPortada(base)).toBe(true);
    expect(mostrarPortada({ ...base, hostname: "www.worshipflowapp.com" })).toBe(true);
  });
  it("app.worshipflowapp.com y la dirección vieja abren la app", () => {
    expect(mostrarPortada({ ...base, hostname: "app.worshipflowapp.com" })).toBe(false);
    expect(mostrarPortada({ ...base, hostname: "worshipflow-pearl.vercel.app" })).toBe(false);
    expect(mostrarPortada({ ...base, hostname: "localhost" })).toBe(false);
  });
  it("al volver de un inicio de sesión se abre la app, no la portada", () => {
    expect(mostrarPortada({ ...base, search: "?code=abc" })).toBe(false);
    expect(mostrarPortada({ ...base, hash: "#access_token=x&refresh_token=y" })).toBe(false);
  });
  it("otras direcciones (pantallas, crear iglesia, /tv) no se tocan", () => {
    expect(mostrarPortada({ ...base, search: "?screen=publico" })).toBe(false);
    expect(mostrarPortada({ ...base, search: "?crear-iglesia&codigo=1" })).toBe(false);
    expect(mostrarPortada({ ...base, pathname: "/tv" })).toBe(false);
    expect(mostrarPortada({ ...base, pathname: "/p/mi-iglesia" })).toBe(false);
  });
});

describe("Abrir la app web", () => {
  it("desde el dominio propio lleva a app.worshipflowapp.com", () => {
    expect(direccionApp("worshipflowapp.com")).toBe("https://app.worshipflowapp.com/");
    expect(direccionApp("www.worshipflowapp.com")).toBe("https://app.worshipflowapp.com/");
  });
  it("desde la dirección vieja o la app se queda en el mismo sitio", () => {
    expect(direccionApp("worshipflow-pearl.vercel.app")).toBe("/");
    expect(direccionApp("app.worshipflowapp.com")).toBe("/");
  });
});
