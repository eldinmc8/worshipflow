// Beneficios de lanzamiento por grupo (pedido de Eldin, 2026-11-23). Lógica pura para poder probarla.
//
// - Al llegar la suscripción creada o activada (o actualizada, de respaldo) de una iglesia con grupo que todavía no lo activó, se guarda
//   beneficio_activado_en y se calculan beneficio_gratis_hasta y beneficio_precio_hasta.
// - Si esa suscripción se cancela o el pago falla, la iglesia pasa a Gratis (plan_vence = ahora). Nada se borra y
//   el beneficio no se puede volver a usar (beneficio_activado_en ya quedó guardado).
// - Iglesias sin grupo: aquí no pasa nada; siguen con la lógica de siempre (logica.ts).
//
// Mismos ids que src/lib/beneficios.js (una prueba revisa que coincidan).

export const BENEFICIOS: Record<string, { precio: string; descuento: string; mesesGratis: number; mesesPrecio: number | null }> = {
  fase_1: { precio: "pri_01m8550jkvw6knwnp44jb444x2", descuento: "dsc_01m855casnfv0hsnf33bmt7tdd", mesesGratis: 6, mesesPrecio: null },
  fase_2: { precio: "pri_01m85528sbaq8syzzk1t6nb314", descuento: "dsc_01m855jk1be461vfk333b0qa6w", mesesGratis: 3, mesesPrecio: 6 },
  lista_espera: { precio: "pri_01m7pbervbwqyafheyppmyn6pk", descuento: "dsc_01m855mkdcshmcac7k2nwt0bj8", mesesGratis: 1, mesesPrecio: 3 },
};

// Precios propios de los grupos → plan Iglesia (el periodo sale del ciclo de cobro del precio).
// El de lista_espera es el mismo "Iglesia con 1 mes gratis" que ya está mapeado en logica.ts.
export const PRECIOS_BENEFICIO: Record<string, { plan: string; periodo: string | null }> = {
  pri_01m8550jkvw6knwnp44jb444x2: { plan: "iglesia", periodo: null },
  pri_01m85528sbaq8syzzk1t6nb314: { plan: "iglesia", periodo: null },
};

export type IglesiaBeneficio = {
  grupo_beneficio?: string | null;
  beneficio_activado_en?: string | null;
  beneficio_plazo_hasta?: string | null;
};

// Suma meses de calendario (31 de enero + 1 mes = 28/29 de febrero, no 3 de marzo).
export function sumarMeses(iso: string, meses: number): string {
  const d = new Date(iso);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.toISOString();
}

export function fechasBeneficio(grupo: string, activadoEn: string) {
  const b = BENEFICIOS[grupo];
  if (!b) return null;
  const gratis = sumarMeses(activadoEn, b.mesesGratis);
  return {
    beneficio_activado_en: new Date(activadoEn).toISOString(),
    beneficio_gratis_hasta: gratis,
    beneficio_precio_hasta: b.mesesPrecio == null ? null : sumarMeses(gratis, b.mesesPrecio),
  };
}

// ¿Esta suscripción es la del beneficio del grupo? Se reconoce por el descuento del grupo, por la marca que pone la
// página de pago (custom_data.beneficio) o, en fase 1 y 2, por su precio propio. (El precio de lista_espera es el
// mismo de la prueba normal de 1 mes, así que solo cuenta con el descuento o la marca.)
// deno-lint-ignore no-explicit-any
export function esSuscripcionDelBeneficio(sub: any, grupo: string): boolean {
  const b = BENEFICIOS[grupo];
  if (!b || !sub) return false;
  if (sub.discount?.id && sub.discount.id === b.descuento) return true;
  if (sub.custom_data?.beneficio === grupo) return true;
  // deno-lint-ignore no-explicit-any
  const precios = (sub.items ?? []).map((i: any) => i?.price?.id);
  return grupo !== "lista_espera" && precios.includes(b.precio);
}

// Cambios extra por el beneficio, que se suman a los de cambiosPorSuscripcion. null = nada que cambiar.
// deno-lint-ignore no-explicit-any
export function cambiosPorBeneficio(iglesia: IglesiaBeneficio | null, tipo: string, sub: any, cuando: string): Record<string, unknown> | null {
  const grupo = iglesia?.grupo_beneficio ?? "";
  if (!iglesia || !BENEFICIOS[grupo] || !sub) return null;

  // 1) Activación: suscripción creada o activada, viva (activa o en prueba), de una iglesia que no lo ha usado.
  if (!iglesia.beneficio_activado_en) {
    // (También "updated", por si el aviso de alta llega tarde o se pierde.)
    const esAlta = tipo === "subscription.created" || tipo === "subscription.activated" || tipo === "subscription.updated";
    const viva = sub.status === "active" || sub.status === "trialing";
    if (esAlta && viva && esSuscripcionDelBeneficio(sub, grupo)) return fechasBeneficio(grupo, cuando);
    return null;
  }

  // 2) Ya activado: si la suscripción del beneficio se cancela o el pago falla, la iglesia pasa a Gratis ya
  //    (sin los 3 días de gracia). No se borra nada y el beneficio no vuelve a estar disponible.
  //    Una suscripción normal que la iglesia pague después sigue la lógica de siempre.
  if (!esSuscripcionDelBeneficio(sub, grupo)) return null;
  if (sub.status === "canceled" || sub.status === "past_due") {
    return { plan_vence: sub.canceled_at ?? cuando, en_prueba: false };
  }
  return null;
}
