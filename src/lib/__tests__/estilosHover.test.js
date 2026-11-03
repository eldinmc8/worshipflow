import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// En el celular, después de un toque el navegador deja el botón "con el mouse encima". Si una regla
// :hover cambia el color de fondo, el botón recién elegido se ve sin marcar (video de Eldin,
// 2026-11-03, ventana de tonalidad). Estas reglas deben vivir dentro de @media (hover: hover) y nunca
// cambiar background/background-color.
const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const leer = (f) => fs.readFileSync(path.join(raiz, f), "utf8");

describe("efecto al pasar el mouse", () => {
  it("ninguna regla :hover cambia el color de fondo", () => {
    for (const f of ["index.css", "PrototipoWorshipFlow.jsx"]) {
      const reglas = leer(f).match(/:hover[^{]*\{[^}]*\}/g) || [];
      reglas.forEach((r) => expect(r, `${f}: ${r}`).not.toMatch(/background(-color)?\s*:/));
    }
  });
  it("el realce de .hoverable solo aplica en dispositivos con mouse", () => {
    const css = leer("index.css");
    const i = css.indexOf(".hoverable:hover {");
    const media = css.lastIndexOf("@media (hover: hover)", i);
    expect(i).toBeGreaterThan(-1);
    expect(media).toBeGreaterThan(-1);
    expect(css.slice(media, i)).not.toMatch(/\n\}/); // la regla está dentro de ese @media, no después
  });
});
