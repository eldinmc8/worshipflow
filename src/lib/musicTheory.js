// Utilidades de acordes/teoría musical — misma lógica que el prototipo (PrototipoWorshipFlow.jsx),
// factorizada aquí para poder reusarla también en el editor real de Canciones.

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_TO_SHARP = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

export function normalizeRoot(root) {
  return FLAT_TO_SHARP[root] || root;
}

// Acordes diatónicos (triadas + con séptima) de una tonalidad, con su grado en números romanos.
export function diatonicChords(keyStr) {
  if (!keyStr) return [];
  const isMinor = keyStr.endsWith("m");
  const root = isMinor ? keyStr.slice(0, -1) : keyStr;
  const rootIdx = NOTES.indexOf(root);
  if (rootIdx === -1) return [];
  const intervals = isMinor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const qualities = isMinor ? ["min", "dim", "maj", "min", "min", "maj", "maj"] : ["maj", "min", "min", "maj", "dom", "min", "dim"];
  const romans = isMinor ? ["i", "ii°", "III", "iv", "v", "VI", "VII"] : ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
  return intervals.map((iv, i) => {
    const note = NOTES[(rootIdx + iv) % 12];
    const q = qualities[i];
    const triadSuffix = q === "min" ? "m" : q === "dim" ? "dim" : "";
    const sevenSuffix = q === "maj" ? "maj7" : q === "min" ? "m7" : q === "dom" ? "7" : "m7b5";
    return { roman: romans[i], chord: `${note}${triadSuffix}`, chord7: `${note}${sevenSuffix}` };
  });
}

// Diferencia en semitonos (0-11) entre la raíz de dos tonalidades; ignora si son mayor/menor.
export function semitoneShift(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const fromIdx = NOTES.indexOf(normalizeRoot(fromKey.replace(/m$/, "")));
  const toIdx = NOTES.indexOf(normalizeRoot(toKey.replace(/m$/, "")));
  if (fromIdx === -1 || toIdx === -1) return 0;
  return ((toIdx - fromIdx) % 12 + 12) % 12;
}

function transposeChordToken(chord, semitones) {
  if (!semitones) return chord;
  const match = chord.match(/^([A-G])(#|b)?(.*)$/);
  if (!match) return chord;
  const [, letter, accidental, rest] = match;
  const idx = NOTES.indexOf(normalizeRoot(`${letter}${accidental || ""}`));
  if (idx === -1) return chord;
  const shifted = NOTES[((idx + semitones) % 12 + 12) % 12];
  const bassMatch = rest.match(/^([^/]*)\/([A-G])(#|b)?(.*)$/);
  if (bassMatch) {
    const [, suffix, bLetter, bAccidental, bRest] = bassMatch;
    const bIdx = NOTES.indexOf(normalizeRoot(`${bLetter}${bAccidental || ""}`));
    const bShifted = bIdx === -1 ? `${bLetter}${bAccidental || ""}` : NOTES[((bIdx + semitones) % 12 + 12) % 12];
    return `${shifted}${suffix}/${bShifted}${bRest}`;
  }
  return `${shifted}${rest}`;
}

export function transposeLine(raw, semitones) {
  if (!semitones) return raw;
  return raw.replace(/\[([^\]]+)\]/g, (_, chord) => `[${transposeChordToken(chord, semitones)}]`);
}

export function stripChords(line) {
  return line.replace(/\[[^\]]+\]/g, "");
}

// Separa una línea "[G]Letra [D]aquí" en texto plano + posiciones de acorde, para dibujar los
// acordes arriba de la letra alineados por carácter (como en la vista de solo lectura del prototipo).
export function parseChordLine(raw) {
  let plain = "";
  const positions = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0, match;
  while ((match = regex.exec(raw)) !== null) {
    plain += raw.slice(lastIndex, match.index);
    positions.push({ index: plain.length, chord: match[1] });
    lastIndex = regex.lastIndex;
  }
  plain += raw.slice(lastIndex);
  return { plain, positions };
}

export function buildChordRow(positions) {
  let row = "";
  positions.forEach(({ index, chord }) => {
    while (row.length < index) row += " ";
    row += `${chord} `;
  });
  return row;
}
