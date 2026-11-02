import { describe, expect, it } from "vitest";
import { datosManifestPantalla, manifestDePantalla } from "../manifestPantalla.js";

describe("manifest de la pantalla", () => {
  it("el ícono abre la misma pantalla y la misma iglesia desde donde se agregó", () => {
    const m = datosManifestPantalla("escenario", "https://x.app/e/buen-pastor", "https://x.app");
    expect(m.start_url).toBe("https://x.app/e/buen-pastor");
    expect(m.short_name).toBe("Escenario");
    expect(m.icons.every((i) => i.src.startsWith("https://x.app/"))).toBe(true);
    expect(datosManifestPantalla("proyeccion", "https://x.app/p/fe-y-amor", "https://x.app").short_name).toBe("Pantalla");
  });
  it("se arma como data: URL", () => {
    const url = manifestDePantalla("proyeccion", { href: "https://x.app/p/a", origin: "https://x.app" });
    expect(url.startsWith("data:application/manifest+json,")).toBe(true);
    expect(JSON.parse(decodeURIComponent(url.split(",")[1])).start_url).toBe("https://x.app/p/a");
  });
});
