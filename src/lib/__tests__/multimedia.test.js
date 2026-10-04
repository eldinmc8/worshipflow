import { describe, expect, it, vi, beforeEach } from "vitest";

// subirFondo valida tipo/tamaño ANTES de llamar a Supabase Storage -- estas pruebas cubren esa parte
// (pura, sin red) con un cliente simulado mínimo, para no depender de una subida real.
let fake;
let multimedia;

beforeEach(async () => {
  vi.resetModules();
  const subidas = [];
  fake = {
    subidas,
    storage: {
      from: () => ({
        upload: async (ruta, file) => { subidas.push({ ruta, file }); return { error: null }; },
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/fondos-en-vivo/${ruta}` } }),
      }),
    },
  };
  vi.doMock("../supabaseClient.js", () => ({ supabase: fake, callUsersFunction: vi.fn() }));
  multimedia = await import("../multimedia.js");
});

function archivoFalso({ type, size }) {
  return { name: "fondo.bin", type, size };
}

describe("subirFondo", () => {
  it("rechaza un tipo de archivo que no es imagen cuando se pide imagen", async () => {
    await expect(multimedia.subirFondo("igl-1", "imagen", archivoFalso({ type: "video/mp4", size: 1000 }))).rejects.toThrow(/imagen/i);
    expect(fake.subidas).toHaveLength(0);
  });

  it("rechaza un tipo de archivo que no es video cuando se pide video", async () => {
    await expect(multimedia.subirFondo("igl-1", "video", archivoFalso({ type: "image/png", size: 1000 }))).rejects.toThrow(/video/i);
    expect(fake.subidas).toHaveLength(0);
  });

  it("rechaza una imagen más pesada que el límite", async () => {
    await expect(multimedia.subirFondo("igl-1", "imagen", archivoFalso({ type: "image/png", size: multimedia.FONDO_MAX_BYTES.imagen + 1 }))).rejects.toThrow(/pesar/i);
    expect(fake.subidas).toHaveLength(0);
  });

  it("rechaza un video más pesado que el límite", async () => {
    await expect(multimedia.subirFondo("igl-1", "video", archivoFalso({ type: "video/mp4", size: multimedia.FONDO_MAX_BYTES.video + 1 }))).rejects.toThrow(/pesar/i);
    expect(fake.subidas).toHaveLength(0);
  });

  it("una imagen válida se sube bajo <iglesia>/imagen/... y devuelve una URL pública", async () => {
    const url = await multimedia.subirFondo("igl-1", "imagen", archivoFalso({ type: "image/webp", size: 1000 }));
    expect(fake.subidas).toHaveLength(1);
    expect(fake.subidas[0].ruta).toMatch(/^igl-1\/imagen\//);
    expect(url).toContain("igl-1/imagen/");
  });

  it("un video de una iglesia no se mezcla con la ruta de otra ni con la carpeta de imágenes", async () => {
    await multimedia.subirFondo("igl-2", "video", archivoFalso({ type: "video/webm", size: 1000 }));
    expect(fake.subidas[0].ruta).toMatch(/^igl-2\/video\//);
  });
});
