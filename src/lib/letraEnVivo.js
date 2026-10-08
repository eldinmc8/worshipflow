// Corregir o agregar diapositivas de letra de una canción desde la pantalla en vivo (Multimedia).
//
// Antes esto tocaba UNA fila de diapositivas_letra a la vez (agregar al final / corregir por índice).
// Eso fallaba en un caso muy común: canciones que nunca pasaron por la pestaña Letra no tienen NINGUNA
// fila guardada — lo que se proyecta se arma al vuelo desde el Contenido (ver
// cancionCompletaAFormatoEditor). Corregir ahí no encontraba fila ("No se encontró esa diapositiva"),
// y AGREGAR una creaba la primera fila de la canción: al recargar, como la canción ya "tenía
// diapositivas", todas las demás secciones quedaban vacías y la canción entera desaparecía de la
// proyección salvo esa diapositiva nueva.
//
// Ahora el cambio se aplica sobre la letra COMPLETA tal como se está viendo (incluidas las secciones
// armadas desde el Contenido) y se guarda la canción entera de una — igual que el editor de Letra de
// Canciones (guardarDiapositivas). Así nada que se veía antes desaparece después.

const quitarAcordes = (linea) => (linea || "").replace(/\[[^\]]+\]/g, "");

// La letra tal como se proyecta hoy: las diapositivas guardadas de cada sección, o — si esa sección no
// tiene clave en song.letra — la sección completa desde el Contenido, como una sola diapositiva (mismo
// respaldo que usa la proyección). Una clave con [] a propósito (sección sin proyectar) se respeta.
export function letraEfectiva(song) {
  const letra = song.letra || {};
  const out = {};
  Object.keys(song.blocks || {}).forEach((clave) => {
    out[clave] = clave in letra
      ? (letra[clave] || []).map((lineas) => [...(lineas || [])])
      : [(song.blocks[clave].lines || []).map(quitarAcordes)];
  });
  // Secciones que solo existan en la letra (no deberían, pero no se pierden).
  Object.keys(letra).forEach((clave) => {
    if (!(clave in out)) out[clave] = (letra[clave] || []).map((lineas) => [...(lineas || [])]);
  });
  return out;
}

// tipo "editar": reemplaza la diapositiva `indice` de la sección. tipo "agregar": inserta una nueva
// justo DESPUÉS de la diapositiva `indice` (o al final si no se indica). El texto viene del cuadro de
// texto: una diapositiva por cambio, líneas separadas por salto de línea.
export function aplicarCambioLetra(song, { tipo, blockKey, indice, texto }) {
  const letra = letraEfectiva(song);
  const grupo = [...(letra[blockKey] || [])];
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
  if (tipo === "editar") {
    if (indice == null || indice < 0 || indice >= grupo.length) throw new Error("No se encontró esa diapositiva — recarga e intenta de nuevo.");
    grupo[indice] = lineas;
  } else if (tipo === "agregar") {
    if (!lineas.some((l) => l.trim())) throw new Error("Escribe el texto de la diapositiva nueva.");
    const pos = indice == null ? grupo.length : Math.min(Math.max(indice + 1, 0), grupo.length);
    grupo.splice(pos, 0, lineas);
  } else {
    throw new Error(`Cambio desconocido: ${tipo}`);
  }
  letra[blockKey] = grupo;
  return letra;
}

// Mismo formato de filas que guarda el editor de Canciones (guardarCancionDesdeEditor).
export function letraADiapositivas(letra) {
  const filas = [];
  Object.entries(letra || {}).forEach(([clave, slides]) => {
    (slides || []).forEach((lineas) => filas.push({ seccion_clave: clave, orden_en_seccion: 0, texto: (lineas || []).join("\n") }));
  });
  return filas;
}
