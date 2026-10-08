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
//
// cortarDespuesDeLinea (opcional, solo "agregar"): en pantallas chicas una diapositiva guardada se ve
// en varios pedazos (ver reorganizarLetra). Si se pide agregar después de un pedazo que NO es el
// último, la diapositiva guardada se parte ahí en dos — después de esa cantidad de líneas no vacías —
// y la nueva queda en medio, justo donde se pidió (no al final de todos sus pedazos).
export function aplicarCambioLetra(song, { tipo, blockKey, indice, texto, cortarDespuesDeLinea }) {
  const letra = letraEfectiva(song);
  const grupo = [...(letra[blockKey] || [])];
  const lineas = String(texto ?? "").replace(/\r/g, "").split("\n");
  if (tipo === "editar") {
    if (indice == null || indice < 0 || indice >= grupo.length) throw new Error("No se encontró esa diapositiva — recarga e intenta de nuevo.");
    grupo[indice] = lineas;
  } else if (tipo === "agregar") {
    if (!lineas.some((l) => l.trim())) throw new Error("Escribe el texto de la diapositiva nueva.");
    const original = indice != null ? grupo[indice] : null;
    if (original && cortarDespuesDeLinea > 0) {
      // Posición (en las líneas crudas, con vacías incluidas) justo después de la N-ésima no vacía.
      let vistas = 0, corte = original.length;
      for (let i = 0; i < original.length; i++) {
        if (original[i] && original[i].trim()) vistas++;
        if (vistas === cortarDespuesDeLinea) { corte = i + 1; break; }
      }
      const antes = original.slice(0, corte);
      const despues = original.slice(corte);
      if (despues.some((l) => l && l.trim())) {
        grupo.splice(indice, 1, antes, lineas, despues);
        letra[blockKey] = grupo;
        return letra;
      }
    }
    const pos = indice == null ? grupo.length : Math.min(Math.max(indice + 1, 0), grupo.length);
    grupo.splice(pos, 0, lineas);
  } else {
    throw new Error(`Cambio desconocido: ${tipo}`);
  }
  letra[blockKey] = grupo;
  return letra;
}

// Borrar y mover diapositivas desde la consola En vivo (pedido de Eldin, 2026-10-08). Lo que se ve en
// pantalla puede ser un PEDAZO de una diapositiva guardada (pantallas chicas, ver reorganizarLetra), así
// que la sección se rearma desde "segmentos": { indice, desde, hasta } = las líneas no vacías
// [desde, hasta) de la diapositiva guardada `indice` (hasta null = hasta el final). La sección queda con
// exactamente esos segmentos, en ese orden, cada uno como su propia diapositiva guardada — lo que no se
// nombre se borra. Un segmento siempre guarda las líneas ORIGINALES (no los renglones partidos para la
// pantalla), así que al proyectar de nuevo se ven igual que antes.
export function rearmarSeccion(song, blockKey, segmentos) {
  return rearmarSecciones(song, { [blockKey]: segmentos });
}

// Varias secciones a la vez, para mover una diapositiva de una sección a OTRA de la misma canción: un
// segmento puede traer su propio `blockKey` (de qué sección sale); si no trae, es de la misma sección
// que se está rearmando. Todo se lee de la letra de ANTES del cambio, así el orden en que se rearman
// las secciones no importa.
export function rearmarSecciones(song, seccionesNuevas) {
  const antes = letraEfectiva(song);
  const letra = letraEfectiva(song);
  const noVacias = (lineas) => (lineas || []).filter((l) => l && l.trim());
  Object.entries(seccionesNuevas).forEach(([destino, segmentos]) => {
    letra[destino] = segmentos
      .map(({ blockKey: origen = destino, indice, desde = 0, hasta = null }) => {
        const grupo = antes[origen] || [];
        if (indice == null || indice < 0 || indice >= grupo.length) throw new Error("No se encontró esa diapositiva — recarga e intenta de nuevo.");
        return noVacias(grupo[indice]).slice(desde, hasta == null ? undefined : hasta);
      })
      .filter((lineas) => lineas.length > 0);
  });
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
