import { describe, it, expect, beforeEach } from "vitest";
import { datosBeneficioDeLista, GRUPOS_BENEFICIO } from "../../../supabase/functions/_shared/beneficioPorCorreo.js";
import { BENEFICIOS } from "../beneficios.js";
import { guardarPedidoCrear, pedidoCrear, olvidarPedidoCrear, nombreSugerido, VIGENCIA_MS } from "../crearIglesiaGoogle.js";

describe("beneficio por correo al crear la iglesia", () => {
  it("los grupos son los mismos que conoce la app", () => {
    expect([...GRUPOS_BENEFICIO].sort()).toEqual(Object.keys(BENEFICIOS).sort());
  });
  it("pone grupo y plazo de la lista", () => {
    expect(datosBeneficioDeLista({ grupo: "lista_espera", plazo_hasta: "2026-12-31T00:00:00Z" }))
      .toEqual({ grupo_beneficio: "lista_espera", beneficio_plazo_hasta: "2026-12-31T00:00:00Z" });
    expect(datosBeneficioDeLista({ grupo: "fase_1" })).toEqual({ grupo_beneficio: "fase_1", beneficio_plazo_hasta: null });
  });
  it("no aplica sin fila, con grupo raro o si ya se usó", () => {
    expect(datosBeneficioDeLista(null)).toBeNull();
    expect(datosBeneficioDeLista({ grupo: "vip" })).toBeNull();
    expect(datosBeneficioDeLista({ grupo: "fase_2", usado_en: "2026-11-30T00:00:00Z" })).toBeNull();
  });
});

describe("crear la iglesia con Google", () => {
  beforeEach(() => {
    const datos = {};
    globalThis.localStorage = {
      getItem: (k) => (k in datos ? datos[k] : null),
      setItem: (k, v) => { datos[k] = String(v); },
      removeItem: (k) => { delete datos[k]; },
    };
  });
  it("guarda el pedido con su código y lo olvida", () => {
    guardarPedidoCrear(" ABC123 ", 1000);
    expect(pedidoCrear(1000 + 60_000)).toEqual({ codigo: "ABC123" });
    olvidarPedidoCrear();
    expect(pedidoCrear(1000)).toBeNull();
  });
  it("un pedido viejo ya no abre el formulario", () => {
    guardarPedidoCrear("", 1000);
    expect(pedidoCrear(1000 + VIGENCIA_MS)).toBeNull();
  });
  it("sugiere el nombre de Google", () => {
    expect(nombreSugerido({ user_metadata: { full_name: " Ana Pérez " } })).toBe("Ana Pérez");
    expect(nombreSugerido({ user_metadata: { nombre: "Luis", full_name: "X" } })).toBe("Luis");
    expect(nombreSugerido(null)).toBe("");
  });
});
