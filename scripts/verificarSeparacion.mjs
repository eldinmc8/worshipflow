// Verifica que una separación no perdió ni duplicó código: cada declaración del archivo original
// (antes de separar) aparece exactamente una vez, idéntica, entre los archivos de después.
// Uso: node scripts/verificarSeparacion.mjs <original-antes.jsx> <archivo1> <archivo2> ...
import fs from "node:fs";
import { analizar } from "./mapaArchivo.mjs";
const [antes, ...despues] = process.argv.slice(2);
const { codigo, decls } = analizar(antes);
const textos = despues.map((f) => fs.readFileSync(f, "utf8").replace(/^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*)export (?!default)/gm, "$1"));
let mal = 0;
for (const d of decls) {
  const t = codigo.slice(d.inicio, d.fin).replace(/^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*)export (?!default)/, "$1");
  const veces = textos.reduce((n, x) => n + x.split(t).length - 1, 0);
  if (veces !== 1) { mal++; console.log(`✗ ${d.nombres.join(",") || d.tipo}: aparece ${veces} veces`); }
}
console.log(mal ? `${mal} problemas` : `OK: las ${decls.length} piezas están, una vez cada una`);
process.exit(mal ? 1 : 0);
