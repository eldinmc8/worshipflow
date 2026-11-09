import { describe, expect, it } from "vitest";
import { ZONAS_PAISES, esZonaValida, textoUTC, etiquetaZona, opcionesZonas, nombreZona } from "../zonasHorarias.js";

const enero = new Date("2026-01-15T12:00:00Z");
const julio = new Date("2026-07-15T12:00:00Z");

describe("zonas horarias", () => {
  it("Venezuela y los demás países de la lista son zonas válidas", () => {
    for (const z of ZONAS_PAISES) expect(esZonaValida(z.value), z.value).toBe(true);
    expect(ZONAS_PAISES.find((z) => z.value === "America/Caracas").label).toBe("Venezuela");
    expect(esZonaValida("America/Atlantida")).toBe(false);
    expect(esZonaValida("")).toBe(false);
  });
  it("muestra la hora respecto a UTC, con horario de verano cuando aplica", () => {
    expect(textoUTC("America/Caracas", enero)).toBe("UTC-4");
    expect(textoUTC("Etc/GMT+6", enero)).toBe("UTC-6");
    expect(textoUTC("Asia/Kolkata", enero)).toBe("UTC+5:30");
    expect(textoUTC("Europe/London", enero)).toBe("UTC");
    expect(textoUTC("Europe/Madrid", enero)).toBe("UTC+1");
    expect(textoUTC("Europe/Madrid", julio)).toBe("UTC+2");
    expect(etiquetaZona("America/Caracas", enero)).toBe("Venezuela (UTC-4)");
    expect(etiquetaZona("Etc/GMT+6", enero)).toBe("Guatemala / El Salvador / Honduras (UTC-6)");
    expect(nombreZona("America/Port_of_Spain")).toBe("America / Port of Spain");
  });
  it("ofrece todas las zonas del mundo, los países primero, y busca sin acentos ni mayúsculas", () => {
    const { paises, otras } = opcionesZonas({ fecha: enero });
    expect(paises.length).toBe(ZONAS_PAISES.length);
    expect(paises.length + otras.length).toBeGreaterThan(400);
    expect(otras.some((o) => o.value === "America/Caracas")).toBe(false); // no se repite
    expect(opcionesZonas({ busqueda: "venezuela", fecha: enero }).paises.map((o) => o.value)).toEqual(["America/Caracas"]);
    expect(opcionesZonas({ busqueda: "PANAMA", fecha: enero }).paises.map((o) => o.value)).toEqual(["America/Panama"]);
    expect(opcionesZonas({ busqueda: "utc-4", fecha: enero }).paises.some((o) => o.value === "America/Caracas")).toBe(true);
    expect(opcionesZonas({ busqueda: "tokyo", fecha: enero }).otras.map((o) => o.value)).toEqual(["Asia/Tokyo"]);
  });
  it("las otras zonas van ordenadas de UTC-12 a UTC+14", () => {
    const { otras } = opcionesZonas({ fecha: enero });
    const i = (v) => otras.findIndex((o) => o.value === v);
    expect(i("Pacific/Pago_Pago")).toBeLessThan(i("Africa/Lagos"));
    expect(i("Africa/Lagos")).toBeLessThan(i("Asia/Tokyo"));
  });
});
