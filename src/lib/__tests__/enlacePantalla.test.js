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
