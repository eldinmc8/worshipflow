// Beneficio de lanzamiento por correo (pedido de Eldin, 2026-11-26).
//
// La tabla beneficios_por_correo (migración 20261127000000) guarda qué correos son de qué grupo (fase_1, fase_2,
// lista_espera) y hasta cuándo pueden activarlo. Cuando alguien crea su iglesia con uno de esos correos, la
// función crear-iglesia le pone a la iglesia ese grupo y ese plazo. Lo usan crear-iglesia y las pruebas.

export const GRUPOS_BENEFICIO = ["fase_1", "fase_2", "lista_espera"];

// Fila de la lista → columnas para la iglesia nueva, o null si no aplica (sin fila, grupo raro o ya usado).
export function datosBeneficioDeLista(fila) {
  if (!fila || fila.usado_en || !GRUPOS_BENEFICIO.includes(fila.grupo)) return null;
  return { grupo_beneficio: fila.grupo, beneficio_plazo_hasta: fila.plazo_hasta || null };
}
