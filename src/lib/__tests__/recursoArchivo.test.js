import { describe, expect, it, vi, beforeEach } from "vitest";

// subirArchivoRecurso (src/lib/ministerios.js) adjunta un archivo a un recurso de ministerio, ademas
// de poder pegar un enlace a mano -- mismo patrón que src/lib/multimedia.js, pero sin restricción de
// tipo (un recurso puede ser cualquier cosa) y con la ruta "<iglesia>/..." directo, sin subcarpeta por
// tipo.
let fake;
let ministerios;

beforeEach(async () => {
  vi.resetModules();
  const subidas = [];
  fake = {
    subidas,
    storage: {
      from: () => ({
        upload: async (ruta, file) => { subidas.push({ ruta, file }); return { error: null }; },
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/recursos-ministerio/${ruta}` } }),
      }),
    },
  };
  vi.doMock("../supabaseClient.js", () => ({ supabase: fake, callUsersFunction: vi.fn() }));
  ministerios = await import("../ministerios.js");
});

describe("subirArchivoRecurso", () => {
  it("rechaza un archivo más pesado que el límite (20MB)", async () => {
    await expect(ministerios.subirArchivoRecurso("igl-1", { name: "grande.zip", type: "application/zip", size: 21 * 1024 * 1024 })).rejects.toThrow(/pesar/i);
    expect(fake.subidas).toHaveLength(0);
  });

  it("sube cualquier tipo de archivo (sin restricción de mime) bajo <iglesia>/... y devuelve una URL pública", async () => {
    const url = await ministerios.subirArchivoRecurso("igl-1", { name: "acordes.pdf", type: "application/pdf", size: 1000 });
    expect(fake.subidas).toHaveLength(1);
    expect(fake.subidas[0].ruta).toMatch(/^igl-1\//);
    expect(url).toContain("recursos-ministerio/igl-1/");
  });

  it("dos iglesias distintas no se mezclan en la misma ruta", async () => {
    await ministerios.subirArchivoRecurso("igl-1", { name: "a.pdf", type: "application/pdf", size: 100 });
    await ministerios.subirArchivoRecurso("igl-2", { name: "b.pdf", type: "application/pdf", size: 100 });
    expect(fake.subidas[0].ruta).toMatch(/^igl-1\//);
    expect(fake.subidas[1].ruta).toMatch(/^igl-2\//);
  });
});
