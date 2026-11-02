// Mapa de un archivo grande: declaraciones de primer nivel, tamaño, de qué dependen y quién las usa.
// Uso: node scripts/mapaArchivo.mjs src/PrototipoWorshipFlow.jsx
import fs from "node:fs";
import { parse } from "@babel/parser";
import traverseMod from "@babel/traverse";
const traverse = traverseMod.default || traverseMod;

export function analizar(archivo) {
  const codigo = fs.readFileSync(archivo, "utf8");
  const ast = parse(codigo, { sourceType: "module", plugins: ["jsx"], attachComment: true });
  const decls = []; // { nombres, inicio, fin, nodo, tipo }
  const imports = new Map(); // nombreLocal -> { fuente, importado }
  let programa;
  traverse(ast, {
    Program(p) { programa = p; p.stop(); },
  });
  for (const st of ast.program.body) {
    const inicio = st.leadingComments?.length ? st.leadingComments[0].start : st.start;
    if (st.type === "ImportDeclaration") {
      for (const s of st.specifiers) imports.set(s.local.name, { fuente: st.source.value, importado: s.type === "ImportDefaultSpecifier" ? "default" : s.type === "ImportNamespaceSpecifier" ? "*" : s.imported.name });
      continue;
    }
    const d = st.type.startsWith("Export") && st.declaration ? st.declaration : st;
    let nombres = [];
    if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") nombres = [d.id.name];
    else if (d.type === "VariableDeclaration") d.declarations.forEach((v) => { if (v.id.type === "Identifier") nombres.push(v.id.name); else traverse.cheap?.(v.id, () => {}); });
    decls.push({ nombres, inicio, fin: st.end, tipo: d.type, exportado: st.type.startsWith("Export"), esDefault: st.type === "ExportDefaultDeclaration", kind: d.kind });
  }
  // Dependencias: identificadores que se refieren a ligaduras del programa.
  const scopePrograma = programa.scope;
  const deps = new Map(decls.map((d) => [d, new Set()]));
  const usaImports = new Map(decls.map((d) => [d, new Set()]));
  const declDe = (pos) => decls.find((d) => pos >= d.inicio && pos < d.fin);
  const nombreADecl = new Map();
  decls.forEach((d) => d.nombres.forEach((n) => nombreADecl.set(n, d)));
  const reasignaciones = [];
  traverse(ast, {
    "ReferencedIdentifier|JSXIdentifier"(p) {
      const n = p.node.name;
      if (p.isJSXIdentifier() && !/^[A-Z]/.test(n) && !p.parentPath.isJSXMemberExpression()) return;
      if (p.isJSXIdentifier() && p.parentPath.isJSXAttribute()) return;
      const b = p.scope.getBinding(n);
      if (!b || b.scope !== scopePrograma) return;
      const d = declDe(p.node.start);
      if (!d) return;
      if (imports.has(n)) usaImports.get(d).add(n);
      else if (nombreADecl.has(n) && nombreADecl.get(n) !== d) deps.get(d).add(nombreADecl.get(n));
    },
  });
  for (const [n, b] of Object.entries(scopePrograma.bindings)) {
    for (const v of b.constantViolations) reasignaciones.push({ nombre: n, en: declDe(v.node.start) });
  }
  return { codigo, decls, deps, usaImports, imports, nombreADecl, reasignaciones };
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2]) {
  const { decls, deps, reasignaciones } = analizar(process.argv[2]);
  const usuarios = new Map(decls.map((d) => [d, []]));
  decls.forEach((d) => deps.get(d).forEach((x) => usuarios.get(x).push(d)));
  const lineas = (d) => 0;
  for (const d of decls) {
    console.log(`${d.nombres.join(",") || d.tipo}\t${d.fin - d.inicio}\tusan:${usuarios.get(d).map((u) => u.nombres[0]).join(",")}`);
  }
  console.log("REASIGNACIONES", reasignaciones.map((r) => `${r.nombre}@${r.en?.nombres?.[0]}`).join(" "));
}
