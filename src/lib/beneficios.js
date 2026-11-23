// Beneficios de lanzamiento por grupo (pedido de Eldin, 2026-11-23).
//
// Cada iglesia puede tener un `grupo_beneficio` (fase_1 | fase_2 | lista_espera) con un plazo para activarlo
// (`beneficio_plazo_hasta`). Mientras el plazo no venza y no lo haya activado, el pago en /web/pagar abre Paddle con
// el precio y el descuento de su grupo (el descuento va con discountId, sin código visible). Lo activa el aviso de
// Paddle (Edge Function paddle-webhook), que guarda `beneficio_activado_en`, `beneficio_gratis_hasta` y
// `beneficio_precio_hasta`. Una sola vez por iglesia. Iglesias sin grupo: el flujo de siempre, sin cambios.
//
// Los ids de Paddle son públicos (modo Live). Si cambian, cambiarlos también en
// supabase/functions/paddle-webhook/beneficio.ts (una prueba revisa que coincidan).

export const BENEFICIOS = {
  fase_1: { nombre: "Fase 1", precio: "pri_01m8550jkvw6knwnp44jb444x2", descuento: "dsc_01m855casnfv0hsnf33bmt7tdd", mesesGratis: 6, mesesPrecio: null },
  fase_2: { nombre: "Fase 2", precio: "pri_01m85528sbaq8syzzk1t6nb314", descuento: "dsc_01m855jk1be461vfk333b0qa6w", mesesGratis: 3, mesesPrecio: 6 },
  lista_espera: { nombre: "Lista de espera", precio: "pri_01m7pbervbwqyafheyppmyn6pk", descuento: "dsc_01m855mkdcshmcac7k2nwt0bj8", mesesGratis: 1, mesesPrecio: 3 },
};

// WhatsApp de WorshipFlow para pedir prórroga del beneficio.
export const WHATSAPP_BENEFICIO = "50239816407";
export const WHATSAPP_BENEFICIO_TEXTO = "+502 3981 6407";

export const beneficioPorGrupo = (grupo) => (grupo && Object.prototype.hasOwnProperty.call(BENEFICIOS, grupo) ? BENEFICIOS[grupo] : null);

// Estado del beneficio a partir de lo que devuelve mi_plan().beneficio (o las columnas de la iglesia).
// "ninguno" (sin grupo) · "disponible" (puede activarlo) · "vencido" (pasó el plazo sin activar) · "activo" (ya lo usó).
export function estadoBeneficio(b, ahora = Date.now()) {
  if (!b || !beneficioPorGrupo(b.grupo)) return "ninguno";
  if (b.activado_en) return "activo";
  if (b.plazo_hasta && new Date(b.plazo_hasta).getTime() < ahora) return "vencido";
  return "disponible";
}

const fecha = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
};
export const fechaBeneficio = fecha;

// Textos para "Tu plan": qué dura lo gratis y cuándo sube a precio normal.
export function resumenBeneficio(grupo) {
  const b = beneficioPorGrupo(grupo);
  if (!b) return "";
  const gratis = `${b.mesesGratis} ${b.mesesGratis === 1 ? "mes" : "meses"} gratis del plan Iglesia`;
  return b.mesesPrecio == null ? `${gratis} y después precio especial para siempre` : `${gratis} y después ${b.mesesPrecio} meses con precio especial`;
}

export function enlaceProrroga(nombreIglesia) {
  const texto = `Hola, se venció el plazo para activar el beneficio de lanzamiento de ${nombreIglesia || "mi iglesia"} en WorshipFlow. ¿Me pueden dar una prórroga?`;
  return `https://wa.me/${WHATSAPP_BENEFICIO}?text=${encodeURIComponent(texto)}`;
}
