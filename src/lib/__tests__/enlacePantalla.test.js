import { describe, it, expect } from "vitest";
import { enlacePantalla, leerPantallaDeUrl } from "../enlacePantalla.js";

describe("enlace de la pantalla en otro equipo", () => {
  it("arma el enlace corto con el nombre de la iglesia", () => {
    expect(enlacePantalla("buen-pastor", "https://x.app")).toBe("https://x.app/p/buen-pastor");
  });
  it("reconoce el enlace corto y el largo de siempre", () => {
    expect(leerPantallaDeUrl("/p/buen-pastor", "")).toEqual({ slug: "buen-pastor" });
    expect(leerPantallaDeUrl("/p/buen-pastor/", "")).toEqual({ slug: "buen-pastor" });
    expect(leerPantallaDeUrl("/", "?screen=publico&igl=buen-pastor&iid=1")).toEqual({ slug: "buen-pastor" });
    expect(leerPantallaDeUrl("/", "")).toBe(null);
    expect(leerPantallaDeUrl("/canciones", "")).toBe(null);
  });
});

import { enlaceEscenario, leerEscenarioDeUrl } from "../enlacePantalla.js";
describe("pantalla de escenario", () => {
  it("arma y reconoce el enlace /e/<iglesia>", () => {
    expect(enlaceEscenario("buen-pastor", "https://x.app")).toBe("https://x.app/e/buen-pastor");
    expect(leerEscenarioDeUrl("/e/buen-pastor", "")).toEqual({ slug: "buen-pastor" });
    expect(leerEscenarioDeUrl("/", "?screen=escenario&igl=buen-pastor")).toEqual({ slug: "buen-pastor" });
    expect(leerEscenarioDeUrl("/p/buen-pastor", "")).toBe(null);
    expect(leerPantallaDeUrl("/e/buen-pastor", "")).toBe(null);
  });
});

describe("enlace con código que vence", () => {
  it("arma y lee el código en el enlace corto y en el largo", () => {
    expect(enlacePantalla("buen-pastor", "https://x.app", "a1b2c3d4e5f6")).toBe("https://x.app/p/buen-pastor/a1b2c3d4e5f6");
    expect(enlaceEscenario("buen-pastor", "https://x.app", "a1b2c3d4e5f6")).toBe("https://x.app/e/buen-pastor/a1b2c3d4e5f6");
    expect(leerPantallaDeUrl("/p/buen-pastor/a1b2c3d4e5f6", "")).toEqual({ slug: "buen-pastor", codigo: "a1b2c3d4e5f6" });
    expect(leerEscenarioDeUrl("/e/buen-pastor/a1b2c3d4e5f6/", "")).toEqual({ slug: "buen-pastor", codigo: "a1b2c3d4e5f6" });
    expect(leerPantallaDeUrl("/", "?screen=publico&igl=buen-pastor&k=zz")).toEqual({ slug: "buen-pastor", codigo: "zz" });
    expect(leerPantallaDeUrl("/p/buen-pastor/a/b", "")).toBe(null);
  });
});
