import { describe, it, expect, vi } from "vitest";
import { normalizarAnimCancion, animacionEfectiva, estiloDeParte, efectosDePalabra, efectoPantallaDe } from "../animacionCancion.js";
import { armarLineasAnimadas, ANIMACIONES } from "../../components/LetrasAnimadas.jsx";

describe("animación por canción", () => {
  const song = { animacion: { general: "aura", porParte: { C: "estadio", P: "ninguna" }, momentos: [{ palabra: "Santo", efecto: "gigante" }, { palabra: "Rey de reyes", efecto: "pantalla:puertas" }, { palabra: "", efecto: "brillo" }], compas: true } };

  it("limpia lo guardado (momentos vacíos o efectos que no existen fuera) y vacío es null", () => {
    const c = normalizarAnimCancion({ ...song.animacion, momentos: [...song.animacion.momentos, { palabra: "x", efecto: "noexiste" }] });
    expect(c.momentos).toHaveLength(2);
    expect(normalizarAnimCancion({ general: null, porParte: {}, momentos: [], compas: false })).toBeNull();
    expect(normalizarAnimCancion(null)).toBeNull();
  });

  it("cada parte usa su estilo o el de la canción; ninguna = letra normal", () => {
    const c = animacionEfectiva(song, null);
    expect(estiloDeParte(c, "V1")).toBe("aura");
    expect(estiloDeParte(c, "C")).toBe("estadio");
    expect(estiloDeParte(c, "P")).toBe("ninguna");
    expect(estiloDeParte(animacionEfectiva({}, null), "V1")).toBeNull();
  });

  it("en un evento se puede cambiar el estilo de toda la canción, conservando momentos y latido", () => {
    const c = animacionEfectiva(song, { animacion: { general: "neon" } });
    expect(estiloDeParte(c, "C")).toBe("neon");
    expect(c.momentos).toHaveLength(2);
    expect(c.compas).toBe(true);
    expect(animacionEfectiva(song, { animacion: null }).general).toBe("aura");
  });

  it("encuentra los momentos sin importar mayúsculas, acentos ni signos", () => {
    const m = normalizarAnimCancion(song.animacion).momentos;
    expect(efectosDePalabra(m, "¡SANTO!")).toEqual(["gigante"]);
    expect(efectosDePalabra(m, "señor")).toEqual([]);
    expect(efectoPantallaDe(m, ["Él es el Rey de reyes,", "Señor de señores"])).toBe("pantalla:puertas");
    expect(efectoPantallaDe(m, ["Santo es el Señor"])).toBeNull();
  });

  it("la palabra del momento sale con su clase en la letra animada", () => {
    const { lineas } = armarLineasAnimadas(ANIMACIONES.suave, ["Santo, santo es el Señor"], "s1", 1, { momentos: [{ palabra: "santo", efecto: "gigante" }] });
    const clases = [];
    const buscar = (n) => { if (Array.isArray(n)) n.forEach(buscar); else if (n?.props) { if (n.props.className) clases.push(n.props.className); buscar(n.props.children); } };
    buscar(lineas);
    expect(clases.filter((c) => c.includes("wfm-gigante"))).toHaveLength(2);
  });
});

describe("guardado de la animación de la canción", () => {
  it("se guarda limpia y, si la base aún no tiene la columna, se guarda la canción sin ella", async () => {
    vi.resetModules();
    const llamadas = [];
    let faltaColumna = true;
    vi.doMock("../supabaseClient.js", () => ({
      supabase: {
        from: () => ({
          update: (datos) => ({ eq: () => { llamadas.push(datos); if (faltaColumna && "animacion" in datos) return Promise.resolve({ error: { code: "PGRST204", message: "Could not find the 'animacion' column of 'canciones'" } }); return Promise.resolve({ error: null }); } }),
        }),
      },
    }));
    const { updateCancion } = await import("../canciones.js");
    await updateCancion("c1", { titulo: "X", animacion: { general: "aura" } });
    expect(llamadas).toHaveLength(2);
    expect("animacion" in llamadas[1]).toBe(false);
    faltaColumna = false;
    await updateCancion("c1", { titulo: "X", animacion: { general: "aura" } });
    expect(llamadas.at(-1).animacion).toEqual({ general: "aura" });
  });
});
