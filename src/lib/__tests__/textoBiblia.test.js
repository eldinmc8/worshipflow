import { describe, it, expect } from "vitest";
import { stripBibleSearchMarkup } from "../textoBiblia.js";

describe("texto de la Biblia sin etiquetas", () => {
  it("no parte una palabra cuando una etiqueta cae en medio", () => {
    expect(stripBibleSearchMarkup("Muéstrame tu fe sin tu<i>s</i> obras")).toBe("Muéstrame tu fe sin tus obras");
    expect(stripBibleSearchMarkup("la <mark>fe</mark> sin obras")).toBe("la fe sin obras");
  });
  it("los saltos de línea de poesía siguen siendo un espacio", () => {
    expect(stripBibleSearchMarkup("Jehová es mi pastor;<br/>nada me faltará.")).toBe("Jehová es mi pastor; nada me faltará.");
    expect(stripBibleSearchMarkup("uno</br>dos")).toBe("uno dos");
  });
});
