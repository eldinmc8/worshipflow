import { describe, expect, it, vi, beforeEach } from "vitest";
import { makeFakeSupabase } from "./fakeSupabase.js";
import { traerTodas, TAMANO_PAGINA } from "../traerTodas.js";

// Supabase corta en 1000 filas por consulta sin avisar — las diapositivas de una canción que quedaban
// después de ese corte desaparecían (y una diapositiva agregada en vivo se "esfumaba" al recargar).
describe("traerTodas", () => {
  it("junta todas las páginas aunque haya más filas que el límite de una consulta", async () => {
    const total = TAMANO_PAGINA * 2 + 37;
    const fake = makeFakeSupabase({ t: Array.from({ length: total }, (_, i) => ({ id: `r${i}`, n: i })) });
    const { data, error } = await traerTodas(() => fake.client.from("t").select("*").order("id"));
    expect(error).toBeNull();
    expect(data).toHaveLength(total);
    expect(new Set(data.map((f) => f.n)).size).toBe(total);
  });

  it("devuelve el error de la consulta en vez de una lista a medias", async () => {
    const err = new Error("falló");
    const construir = () => ({ range: () => Promise.resolve({ data: null, error: err }) });
    expect(await traerTodas(construir)).toEqual({ data: null, error: err });
  });
});

describe("listCancionesCompletas con más de 1000 diapositivas", () => {
  let fake, canciones;
  beforeEach(async () => {
    vi.resetModules();
    fake = makeFakeSupabase();
    vi.doMock("../supabaseClient.js", () => ({ supabase: fake.client, callUsersFunction: vi.fn() }));
    canciones = await import("../canciones.js");
  });

  it("no pierde las diapositivas de la última canción", async () => {
    const nCanciones = 60, porCancion = 20; // 1200 diapositivas
    fake.db.canciones = Array.from({ length: nCanciones }, (_, c) => ({ id: `c${c}`, titulo: `Canción ${c}`, tonalidad: "G", categoria: "himno" }));
    fake.db.secciones_cancion = fake.db.canciones.map((c) => ({ id: `s-${c.id}`, cancion_id: c.id, clave: "v1", etiqueta: "Estrofa 1", contenido: "" }));
    fake.db.estructura_cancion = [];
    fake.db.diapositivas_letra = fake.db.canciones.flatMap((c) =>
      Array.from({ length: porCancion }, (_, i) => ({ id: `d-${c.id}-${i}`, cancion_id: c.id, seccion_clave: "v1", orden_en_seccion: 0, texto: `línea ${i}`, orden: i })));
    const lista = await canciones.listCancionesCompletas();
    expect(lista).toHaveLength(nCanciones);
    lista.forEach((cancion) => expect(cancion.letra.v1).toHaveLength(porCancion));
  });
});
