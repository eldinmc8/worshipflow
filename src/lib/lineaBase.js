// "Línea base" de guardado por diferencias.
//
// Problema que resuelve (pérdida de datos real, octubre 2026): los guardados de un evento mandaban el
// estado COMPLETO que este dispositivo tenía en memoria y después borraban de la base todo lo que no
// estuviera en ese estado. Si otro dispositivo, el Asistente o alguien directo en Supabase había
// agregado algo después de que este dispositivo cargó el evento, el siguiente guardado de aquí lo
// borraba sin que nadie lo hubiera pedido (se perdieron encargados de Escuelita y Ventas al editar
// "Orden y limpieza").
//
// Regla nueva: solo se borra lo que este dispositivo CONOCÍA (estaba en su línea base) y el usuario
// quitó. Una fila que este dispositivo nunca vio no está en la línea base, así que nunca se borra.
//
// La línea base de cada clave (ej. "items:<eventoId>") es un conjunto de ids:
// - se fija cuando la app adopta datos traídos de la base (carga inicial, refresco en tiempo real,
//   copia sin conexión), con los ids de ESOS datos, que son los mismos que quedan en pantalla;
// - se actualiza al terminar cada guardado, con los ids que quedaron en la base Y que este
//   dispositivo tiene en su estado (ver actualizarTrasGuardar). No se usan todos los ids de la base:
//   incluiría filas agregadas por fuera que este dispositivo todavía no tiene en pantalla, y el
//   guardado siguiente las borraría, que es justo el bug que se quiere evitar.

const bases = new Map();

export function fijarLineaBase(clave, ids) {
  bases.set(clave, new Set(ids.filter((id) => id != null)));
}

// Ids que hay que borrar: los que estaban en la línea base y ya no están en el estado local. Sin
// línea base (ej. un evento recién creado en este dispositivo) no se borra nada.
export function idsABorrar(clave, idsLocales) {
  const base = bases.get(clave);
  if (!base) return [];
  const locales = new Set(idsLocales);
  return [...base].filter((id) => !locales.has(id));
}

// Tras un guardado: línea base = ids que siguen en la base ∩ ids que este dispositivo tiene.
export function actualizarTrasGuardar(clave, idsEnBase, idsLocales) {
  const locales = new Set(idsLocales);
  fijarLineaBase(clave, idsEnBase.filter((id) => locales.has(id)));
}
