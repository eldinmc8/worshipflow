// Separa pantallas de src/PrototipoWorshipFlow.jsx en archivos propios SIN cambiar el código: corta y pega
// cada declaración tal cual (con sus comentarios) y arma los import/export necesarios.
//
//   node scripts/separar.mjs <archivo-config.json>
//
// config: { "principal": "src/PrototipoWorshipFlow.jsx", "compartido": "src/pantallas/compartido.jsx",
//           "grupos": { "src/pantallas/biblia.jsx": ["BibleLivePanel", ...], ... } }
//
// Reglas:
// - Las raíces de un grupo van a su archivo.
// - Una declaración que solo usan cosas de UN grupo se va con ese grupo.
// - Lo que usan varios archivos (o el principal y algún grupo) va al archivo compartido.
// - Lo que solo usa el principal se queda en el principal.
// - Una variable y la función que la reasigna nunca se separan.
// - Si el compartido necesitara algo de un grupo (dependencia circular), se avisa y no se escribe nada.
import fs from "node:fs";
import path from "node:path";
import { analizar } from "./mapaArchivo.mjs";

const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const PRINCIPAL = config.principal;
const COMPARTIDO = config.compartido;
const { codigo, decls, deps, usaImports, imports, nombreADecl, reasignaciones } = analizar(PRINCIPAL);

// Inseparables (variable + quien la reasigna): unión.
const padre = new Map(decls.map((d) => [d, d]));
const raiz = (d) => (padre.get(d) === d ? d : raiz(padre.get(d)));
for (const r of reasignaciones) if (r.en) padre.set(raiz(r.en), raiz(nombreADecl.get(r.nombre)));
const grupoInseparable = (d) => decls.filter((x) => raiz(x) === raiz(d));

const usuarios = new Map(decls.map((d) => [d, new Set()]));
decls.forEach((d) => deps.get(d).forEach((x) => usuarios.get(x).add(d)));

const destino = new Map(); // decl -> archivo
for (const [archivo, raices] of Object.entries(config.grupos)) {
  for (const n of raices) {
    const d = nombreADecl.get(n);
    if (!d) throw new Error(`No existe la declaración ${n}`);
    grupoInseparable(d).forEach((x) => destino.set(x, archivo));
  }
}
const principalDecl = decls.find((d) => d.esDefault);
// Asignación: si todos los que usan D están en el mismo grupo, D va a ese grupo.
let cambio = true;
while (cambio) {
  cambio = false;
  for (const d of decls) {
    if (destino.has(d) || d === principalDecl) continue;
    const juntos = grupoInseparable(d);
    const usos = new Set();
    juntos.forEach((x) => usuarios.get(x).forEach((u) => { if (!juntos.includes(u)) usos.add(u); }));
    if (usos.size === 0) continue;
    const archivos = new Set([...usos].map((u) => destino.get(u) || null));
    if (archivos.size === 1 && !archivos.has(null)) {
      const [a] = archivos;
      juntos.forEach((x) => destino.set(x, a));
      cambio = true;
    }
  }
}
// Lo que necesita algún grupo y no tiene destino → compartido (con todo lo que a su vez necesita).
const enCompartido = new Set();
const agregarCompartido = (d) => {
  if (enCompartido.has(d) || destino.has(d) || d === principalDecl) return;
  grupoInseparable(d).forEach((x) => { enCompartido.add(x); deps.get(x).forEach(agregarCompartido); });
};
for (const d of decls) if (destino.has(d)) deps.get(d).forEach(agregarCompartido);
enCompartido.forEach((d) => destino.set(d, COMPARTIDO));
// El resto, en el principal.
decls.forEach((d) => { if (!destino.has(d)) destino.set(d, PRINCIPAL); });

// Ciclos peligrosos: el compartido no puede depender de un grupo.
const problemas = [];
for (const d of decls) {
  if (destino.get(d) !== COMPARTIDO) continue;
  deps.get(d).forEach((x) => { const a = destino.get(x); if (a !== COMPARTIDO) problemas.push(`${d.nombres[0]} (compartido) usa ${x.nombres[0]} (${a})`); });
}
if (problemas.length) { console.error("Dependencias circulares:\n" + problemas.join("\n")); process.exit(1); }

// ---------- Escribir ----------
const archivos = [...new Set([...destino.values()])];
const relativo = (desde, hacia) => {
  let r = path.relative(path.dirname(desde), hacia).replace(/\\/g, "/");
  if (!r.startsWith(".")) r = "./" + r;
  return r;
};
const fuenteDesde = (archivoNuevo, fuente) => (fuente.startsWith(".") ? relativo(archivoNuevo, path.join(path.dirname(PRINCIPAL), fuente)) : fuente);

function textoDecl(d, exportar, archivo) {
  let t = codigo.slice(d.inicio, d.fin);
  // import("./...") dentro del código: la ruta cambia si la pieza se mueve de carpeta.
  if (archivo && archivo !== PRINCIPAL) t = t.replace(/import\((["'])(\.[^"']+)\1\)/g, (_, q, f) => `import(${q}${fuenteDesde(archivo, f)}${q})`);
  if (exportar && !d.exportado) {
    // "export" justo antes de la palabra clave (después de los comentarios de arriba).
    const m = /^(\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*)/.exec(t);
    const pre = m ? m[1] : "";
    t = pre + "export " + t.slice(pre.length);
  }
  return t;
}

const necesitaExport = (d) => [...usuarios.get(d)].some((u) => destino.get(u) !== destino.get(d)) || (d.exportado && destino.get(d) !== PRINCIPAL);
const salida = {};
for (const archivo of archivos) {
  const mias = decls.filter((d) => destino.get(d) === archivo);
  // Imports de librerías/otros módulos que usan mis declaraciones.
  const porFuente = new Map();
  const agregarImport = (fuente, importado, local) => {
    if (!porFuente.has(fuente)) porFuente.set(fuente, { def: null, ns: null, nombres: new Map() });
    const f = porFuente.get(fuente);
    if (importado === "default") f.def = local; else if (importado === "*") f.ns = local; else f.nombres.set(local, importado);
  };
  mias.forEach((d) => usaImports.get(d).forEach((n) => { const im = imports.get(n); agregarImport(fuenteDesde(archivo, im.fuente), im.importado, n); }));
  // Imports de otras partes separadas.
  mias.forEach((d) => deps.get(d).forEach((x) => {
    const a = destino.get(x);
    if (a === archivo) return;
    x.nombres.forEach((n) => agregarImport(relativo(archivo, a).replace(/\.jsx$/, ".jsx"), x.esDefault ? "default" : n, n));
  }));
  const lineasImport = [];
  // Los imports que ya tenía el archivo principal, en su orden original; los nuevos al final.
  for (const [fuente, f] of porFuente) {
    const partes = [];
    if (f.def) partes.push(f.def);
    if (f.ns) partes.push(`* as ${f.ns}`);
    if (f.nombres.size) partes.push(`{ ${[...f.nombres].map(([local, imp]) => (local === imp ? local : `${imp} as ${local}`)).join(", ")} }`);
    lineasImport.push(`import ${partes.join(", ")} from "${fuente}";`);
  }
  salida[archivo] = { lineasImport, cuerpo: mias.map((d) => textoDecl(d, necesitaExport(d), archivo)) };
}

// Principal: conserva su encabezado (imports con efectos, comentarios de arriba) y re-exporta lo que
// otros archivos de la app le piden (ej. ProjectionPanel para la pantalla pública).
const reexportar = (config.reexportar || []).filter((n) => nombreADecl.has(n) && destino.get(nombreADecl.get(n)) !== PRINCIPAL);
const importsConEfecto = codigo.match(/^import\s+["'][^"']+["'];?$/gm) || [];
for (const archivo of archivos) {
  const { lineasImport, cuerpo } = salida[archivo];
  let texto;
  if (archivo === PRINCIPAL) {
    const extra = reexportar.map((n) => `export { ${n} } from "${relativo(PRINCIPAL, destino.get(nombreADecl.get(n)))}";`);
    texto = [...importsConEfecto, ...lineasImport, ...extra].join("\n") + "\n\n" + cuerpo.join("\n\n") + "\n";
  } else {
    const encabezado = config.encabezados?.[archivo] ? `// ${config.encabezados[archivo]}\n` : "";
    texto = encabezado + lineasImport.join("\n") + "\n\n" + cuerpo.join("\n\n") + "\n";
  }
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  fs.writeFileSync(archivo, texto);
  console.log(`${archivo}: ${cuerpo.length} piezas, ${texto.split("\n").length} líneas`);
}
