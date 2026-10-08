// Partir texto proyectado en pedazos que se lean bien de lejos — sin cortar a media frase.
//
// Dos usos:
// - Versículos largos (pedido de Eldin, 2026-10-07): uno largo pasa a 2 diapositivas, uno
//   exageradamente largo a 3, cada una con su "(1/2)" junto a la cita.
// - Letra de canciones en pantallas chicas: cada línea de la letra en su propia diapositiva, partida
//   en dos renglones (para que los estilos de letra tengan su primer y segundo renglón).

const PAUSA_FUERTE = /[.;:!?…]/;

// Parte `texto` en exactamente `n` pedazos (o menos, si no hay espacios suficientes), buscando cerca
// de cada punto ideal (la mitad, los tercios...) la mejor pausa: primero . ; : ! ?, después una coma,
// y si no hay nada, el espacio más cercano — que es lo que deja los pedazos más parejos.
export function partirEn(texto, n) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (n <= 1 || !t.includes(" ")) return t ? [t] : [];
  const cortes = [];
  let desde = 0;
  for (let k = 1; k < n; k++) {
    const ideal = Math.round((t.length * k) / n);
    const ventana = Math.max(6, Math.round((t.length / n) * 0.35));
    let mejor = -1;
    let mejorPuntaje = -Infinity;
    for (let i = Math.max(desde + 1, ideal - ventana); i <= Math.min(t.length - 2, ideal + ventana); i++) {
      if (t[i] !== " ") continue;
      const antes = t[i - 1];
      const prioridad = PAUSA_FUERTE.test(antes) ? 3 : antes === "," ? 2 : 1;
      // Evitar dejar una palabra sola en un pedazo ("Tu voz me / llama"), si hay otra opción.
      const izquierda = t.slice(desde, i).trim();
      const derecha = k === n - 1 ? t.slice(i).trim() : "x x";
      const sola = (p) => p && !p.includes(" ");
      const castigo = (sola(izquierda) ? 1500 : 0) + (sola(derecha) ? 1500 : 0);
      const puntaje = prioridad * 1000 - Math.abs(i - ideal) - castigo;
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = i; }
    }
    if (mejor === -1) {
      // Sin espacio en la ventana: el más cercano después del punto ideal (o antes, si no hay).
      mejor = t.indexOf(" ", Math.max(ideal, desde + 1));
      if (mejor === -1) mejor = t.lastIndexOf(" ", ideal);
    }
    if (mejor <= desde) break;
    cortes.push(mejor);
    desde = mejor;
  }
  const partes = [];
  let a = 0;
  for (const c of [...cortes, t.length]) {
    const p = t.slice(a, c).trim();
    if (p) partes.push(p);
    a = c;
  }
  return partes;
}

// Versículo → 1, 2 o 3 partes según cuántas palabras tenga. `palabrasPorParte` baja si la letra en
// vivo está más grande (ver fontScale), así con letra grande divide antes.
// Cuántas palabras caben por parte según el tamaño de letra en vivo: con la letra más grande caben
// menos y se divide antes. Una sola fórmula para la proyección y para la lista de la Biblia en vivo
// (que muestra cada parte como su propio versículo), así las dos siempre coinciden.
export function palabrasPorParteSegun(fontScale) {
  return Math.max(15, Math.round(40 / (fontScale || 1)));
}

export function partesDeVersiculo(texto, palabrasPorParte = 40, maxPartes = 3) {
  const t = String(texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const palabras = t.split(" ").length;
  const n = Math.min(maxPartes, Math.max(1, Math.ceil(palabras / Math.max(1, palabrasPorParte))));
  return partirEn(t, n);
}

// Toma la lista de diapositivas en vivo y reemplaza cada versículo largo por sus partes. Cada parte
// guarda de dónde salió (baseSlideId, baseReference, baseText) para que editar o avanzar al siguiente
// versículo siga trabajando sobre el versículo completo, nunca sobre un pedazo.
export function expandirVersiculosLargos(slides, palabrasPorParte = 40) {
  const out = [];
  (slides || []).forEach((s) => {
    if (!s || s.type !== "biblia" || !s.text) { out.push(s); return; }
    const partes = partesDeVersiculo(s.text, palabrasPorParte);
    if (partes.length <= 1) { out.push(s); return; }
    partes.forEach((texto, k) => {
      out.push({
        ...s,
        slideId: `${s.slideId}~${k}`,
        baseSlideId: s.slideId, baseReference: s.reference, baseText: s.text,
        text: texto, parte: k, partes: partes.length,
        reference: `${s.reference} (${k + 1}/${partes.length})`,
      });
    });
  });
  return out;
}

// ---- Letra de canciones según la pantalla de cada iglesia (iglesias.formato_letra) ----
// "dos_lineas": como siempre, cada diapositiva con sus líneas tal cual (pantallas grandes).
// "una_linea_dos_renglones": siempre DOS renglones por diapositiva, para que se lea grande en pantallas
//   chicas y los estilos de letra (mayúscula, acento, editorial...) tengan su primer y segundo renglón:
//   dos líneas cortas seguidas van juntas (una por renglón — "Hallé un buen amigo," / "mi amado
//   Salvador"), y una línea larga va sola, partida en dos renglones. Así no quedan pedazos sueltos
//   ("Dame de beber de tu" en una diapositiva y "manantial;" en la otra).
// "una_linea": cada línea en su propia diapositiva, en un solo renglón.
// Se calcula al proyectar: la canción guardada no cambia, así que cambiar el ajuste no obliga a rehacer
// ninguna canción. Cada diapositiva nueva recuerda la original (baseLines) para que "Corregir letra"
// en vivo siga editando la diapositiva guardada completa, nunca solo un pedazo.
export const FORMATOS_LETRA = [
  { value: "dos_lineas", label: "2 líneas por diapositiva", ayuda: "Para pantallas grandes o proyectores." },
  { value: "una_linea_dos_renglones", label: "2 renglones cortos", ayuda: "Para pantallas chicas o TVs: líneas cortas juntas, las largas partidas en dos. Letra mucho más grande." },
  { value: "una_linea", label: "1 línea en 1 renglón", ayuda: "Lo más simple, sin contraste entre renglones." },
];

// Hasta cuántas letras cabe cómodo un renglón grande en una pantalla chica.
export const MAX_RENGLON = 30;

export function reorganizarLetra(slides, formato) {
  if (!formato || formato === "dos_lineas") return slides || [];
  const out = [];
  const lista = slides || [];
  let i = 0;
  while (i < lista.length) {
    const s = lista[i];
    if (!s || s.type !== "cancion") { out.push(s); i++; continue; }
    // Grupo = diapositivas seguidas de la MISMA aparición de una sección (mismo prefijo de slideId).
    const grupoDe = (x) => `${x.songId}|${x.blockKey}|${String(x.slideId).replace(/-\d+$/, "")}`;
    const clave = grupoDe(s);
    const grupo = [];
    while (i < lista.length && lista[i]?.type === "cancion" && grupoDe(lista[i]) === clave) { grupo.push(lista[i]); i++; }
    // Las líneas se juntan SOLO dentro de la misma diapositiva guardada, nunca con la de al lado
    // (2026-10-08): una diapositiva agregada en vivo con una sola línea se pegaba a la primera línea de
    // la siguiente y nunca aparecía como diapositiva propia. hastaLinea = cuántas líneas (no vacías) de
    // la original van hasta este pedazo inclusive — sirve para insertar una diapositiva nueva JUSTO
    // después de este pedazo (ver aplicarCambioLetra, cortarDespuesDeLinea).
    const piezas = [];
    grupo.forEach((orig) => {
      const lineas = (orig.lines || []).filter((l) => l && l.trim()).map((l) => l.replace(/\s+/g, " ").trim());
      if (formato === "una_linea_dos_renglones") {
        const corta = (t) => t !== undefined && t.length <= MAX_RENGLON;
        for (let j = 0; j < lineas.length; ) {
          if (corta(lineas[j]) && corta(lineas[j + 1])) {
            piezas.push({ orig, renglones: [lineas[j], lineas[j + 1]], desdeLinea: j, hastaLinea: j + 2 });
            j += 2;
          } else {
            piezas.push({ orig, renglones: partirEn(lineas[j], 2), desdeLinea: j, hastaLinea: j + 1 });
            j += 1;
          }
        }
      } else {
        lineas.forEach((texto, j) => piezas.push({ orig, renglones: [texto], desdeLinea: j, hastaLinea: j + 1 }));
      }
    });
    if (piezas.length === 0) { out.push(...grupo); continue; }
    const base = grupo[0].sectionLabel || String(grupo[0].blockLabel || "").replace(/\s*\(\d+\/\d+\)$/, "");
    piezas.forEach(({ orig, renglones, desdeLinea, hastaLinea }, k) => {
      const totalOrig = (orig.lines || []).filter((l) => l && l.trim()).length;
      out.push({
        ...orig,
        slideId: `${orig.slideId}~l${k}`,
        lines: renglones,
        baseLines: orig.baseLines || orig.lines,
        // null en el último pedazo de la original: ahí "agregar después" ya es simplemente después de ella.
        cortarDespuesDeLinea: hastaLinea < totalOrig ? hastaLinea : null,
        // Qué líneas de la diapositiva guardada muestra este pedazo — para borrarlo o moverlo solo a él.
        segmento: { desde: desdeLinea, hasta: hastaLinea },
        blockLabel: piezas.length > 1 ? `${base} (${k + 1}/${piezas.length})` : base,
      });
    });
  }
  return out;
}
