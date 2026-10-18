import { describe, it, expect } from "vitest";
import { ANIMACIONES, GRUPOS_ANIMACION, animacionActiva, armarLineasAnimadas } from "../../components/LetrasAnimadas.jsx";

describe("letras animadas", () => {
  it("cada estilo pertenece a un grupo y trae fuente, fondo y muestra", () => {
    for (const [k, a] of Object.entries(ANIMACIONES)) {
      expect(GRUPOS_ANIMACION, k).toContain(a.grupo);
      expect(a.fuente?.family, k).toBeTruthy();
      expect(a.fondo, k).toBeTruthy();
      expect(a.muestra, k).toBeTruthy();
    }
  });

  it("sin animación o con una clave que no existe, la letra queda como siempre", () => {
    expect(animacionActiva({})).toBe(null);
    expect(animacionActiva({ animacion: "noexiste" })).toBe(null);
    expect(animacionActiva({ animacion: "neon" })).toBe("neon");
  });

  it("parte las líneas en palabras sin perder ni cambiar el texto", () => {
    const lineas = ["¡Santo! ¡Santo! ¡Santo!", "Señor omnipotente"];
    const { lineas: nodos, vars } = armarLineasAnimadas("cinetico", lineas, "s1");
    expect(vars["--n"]).toBe(5);
    const texto = (n) => (typeof n === "string" ? n : Array.isArray(n) ? n.map(texto).join("") : n?.props ? texto(n.props.children) : "");
    expect(nodos.map(texto)).toEqual(lineas);
  });

  it("los estilos letra por letra conservan el texto", () => {
    const { lineas: nodos } = armarLineasAnimadas("ola", ["Dios es amor"], "s2");
    const texto = (n) => (typeof n === "string" ? n : Array.isArray(n) ? n.map(texto).join("") : n?.props ? texto(n.props.children) : "");
    expect(texto(nodos[0])).toBe("Dios es amor");
  });
});
