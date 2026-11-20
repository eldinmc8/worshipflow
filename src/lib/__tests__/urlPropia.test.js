import { describe, it, expect } from "vitest";
import { urlPropia, urlsPropias } from "../urlPropia.js";

describe("urlPropia", () => {
  it("convierte la dirección vieja de las imágenes de WorshipFlow", () => {
    expect(urlPropia("https://worshipflow-pearl.vercel.app/diapositivas/gloria-a-dios.jpg")).toBe("/diapositivas/gloria-a-dios.jpg");
    expect(urlPropia("https://app.worshipflowapp.com/diapositivas/x.jpg")).toBe("/diapositivas/x.jpg");
  });
  it("no toca otras direcciones", () => {
    expect(urlPropia("https://otro.com/diapositivas/x.jpg")).toBe("https://otro.com/diapositivas/x.jpg");
    expect(urlPropia("https://worshipflow-pearl.vercel.app/otra/x.jpg")).toBe("https://worshipflow-pearl.vercel.app/otra/x.jpg");
    expect(urlPropia(null)).toBe(null);
  });
  it("en estructuras: copia solo si cambia algo", () => {
    const igual = { a: [{ url: "/x.jpg" }] };
    expect(urlsPropias(igual)).toBe(igual);
    expect(urlsPropias({ d: [{ fondo: { url: "https://worshipflow-pearl.vercel.app/diapositivas/b.jpg" } }] })).toEqual({ d: [{ fondo: { url: "/diapositivas/b.jpg" } }] });
  });
});
