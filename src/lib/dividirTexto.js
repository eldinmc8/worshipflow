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
      const puntaje = prioridad * 1000 - Math.abs(i - ideal);
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
