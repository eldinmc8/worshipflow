// Ajustes → Biblias de la iglesia (solo administradores, 2026-11-16): importar versiones desde un archivo
// Zefania XML, reemplazarlas o borrarlas. Lo que se importa lo ve SOLO esta iglesia y aparece primero en
// el selector de versión ("De mi iglesia"). Lectura y guardado: src/lib/bibliasIglesia.js.
import { useRef, useState } from "react";
import { BookOpen, Upload, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import { leerZefania, decodificarXml, errorCodigo, importarBiblia, borrarBibliaIglesia, TAMANO_MAXIMO_XML } from "../lib/bibliasIglesia.js";
import { BIBLE_VERSIONS, useBibliasIglesia, inputStyle, primaryBtn } from "../pantallas/compartido.jsx";
import { showToast, notifyError } from "../lib/toast.js";
import { confirmDialog } from "../lib/confirm.js";

const tarjeta = { background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 };
const etiqueta = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--wf-text-2)", margin: "10px 0 5px" };
const miles = (n) => Number(n || 0).toLocaleString("es");

function resumenTestamentos(libros) {
  const at = libros.filter((l) => l.bookid <= 39).length;
  const nt = libros.filter((l) => l.bookid >= 40).length;
  if (at === 39 && nt === 27) return "Biblia completa (66 libros)";
  if (!at) return nt === 27 ? "Nuevo Testamento completo" : `Nuevo Testamento: ${nt} de 27 libros`;
  if (!nt) return at === 39 ? "Antiguo Testamento completo" : `Antiguo Testamento: ${at} de 39 libros`;
  return `${libros.length} de 66 libros`;
}

// Un versículo conocido para que el admin compruebe que el texto se leyó bien (tildes, letras propias).
function muestra(datos) {
  const buscar = (l, c, v) => datos.versiculos.find((x) => x.libro === l && x.capitulo === c && x.versiculo === v);
  const v = buscar(43, 3, 16) || buscar(19, 23, 1) || datos.versiculos[0];
  const libro = datos.libros.find((l) => l.bookid === v.libro);
  return { ref: `${libro?.name || ""} ${v.capitulo}:${v.versiculo}`, texto: v.texto };
}

export default function BibliasIglesia({ iglesiaId, usuarioId }) {
  const propias = useBibliasIglesia();
  const inputRef = useRef(null);
  const [leyendo, setLeyendo] = useState(false);
  const [previa, setPrevia] = useState(null); // { datos, archivo, reemplaza: entrada | null }
  const [form, setForm] = useState({ codigo: "", nombre: "", idioma: "" });
  const [progreso, setProgreso] = useState(null); // { hechos, total }
  const reemplazarRef = useRef(null);

  const elegirArchivo = (reemplaza = null) => {
    reemplazarRef.current = reemplaza;
    if (inputRef.current) { inputRef.current.value = ""; inputRef.current.click(); }
  };

  const alElegir = async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (archivo.size > TAMANO_MAXIMO_XML) { notifyError("El archivo es demasiado grande", new Error("El máximo es 30 MB.")); return; }
    setLeyendo(true);
    try {
      const bytes = await archivo.arrayBuffer();
      await new Promise((r) => setTimeout(r, 30)); // deja pintar "Leyendo…" antes del trabajo pesado
      const datos = leerZefania(decodificarXml(bytes));
      const reemplaza = reemplazarRef.current;
      setPrevia({ datos, archivo: archivo.name, reemplaza });
      setForm({ codigo: reemplaza ? reemplaza.code : datos.codigoSugerido, nombre: datos.nombre, idioma: datos.idioma });
    } catch (err) {
      notifyError("No se pudo leer el archivo", err);
    } finally {
      setLeyendo(false);
    }
  };

  const codigosOcupados = [...BIBLE_VERSIONS.map((v) => v.code), ...propias.filter((p) => p.bibliaId !== previa?.reemplaza?.bibliaId).map((p) => p.code)];
  const problemaCodigo = previa ? errorCodigo(form.codigo, codigosOcupados) : null;

  const guardar = async () => {
    if (problemaCodigo || !previa) return;
    setProgreso({ hechos: 0, total: previa.datos.versiculos.length });
    try {
      await importarBiblia({
        iglesiaId, usuarioId, datos: previa.datos,
        codigo: form.codigo, nombre: form.nombre, idioma: form.idioma,
        reemplazaId: previa.reemplaza?.bibliaId || null,
        onProgreso: (hechos, total) => setProgreso({ hechos, total }),
      });
      window.dispatchEvent(new Event("wf-biblias-iglesia"));
      showToast(`${form.codigo.toUpperCase()} quedó lista. Ya aparece de primera en el selector de versión.`, "info");
      setPrevia(null);
    } catch (err) {
      notifyError("No se pudo guardar la Biblia", err);
    } finally {
      setProgreso(null);
    }
  };

  const borrar = async (v) => {
    if (!(await confirmDialog(`¿Borrar ${v.code} · ${v.label}? Nadie de la iglesia podrá elegirla. Los versículos que ya están en el orden de un culto se siguen viendo igual.`, { danger: true, textoConfirmar: "Borrar" }))) return;
    try {
      await borrarBibliaIglesia(v.bibliaId);
      window.dispatchEvent(new Event("wf-biblias-iglesia"));
      showToast(`${v.code} se borró.`, "info");
    } catch (err) {
      notifyError("No se pudo borrar", err);
    }
  };

  const input = <input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" onChange={alElegir} style={{ display: "none" }} aria-label="Archivo de la Biblia (.xml)" />;

  if (previa) {
    const m = muestra(previa.datos);
    const guardando = !!progreso;
    const pct = progreso?.total ? Math.round((progreso.hechos / progreso.total) * 100) : 0;
    return (
      <div>
        {input}
        <div style={tarjeta}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 2 }}>{previa.reemplaza ? `Reemplazar ${previa.reemplaza.code} con` : "Archivo"}: {previa.archivo}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-text)" }}>{resumenTestamentos(previa.datos.libros)} · {miles(previa.datos.versiculos.length)} versículos</div>
          <div style={{ marginTop: 10, background: "var(--wf-hover)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", marginBottom: 3 }}>{m.ref}</div>
            <div style={{ fontSize: 13.5, color: "var(--wf-text)", lineHeight: 1.5 }}>{m.texto}</div>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginTop: 6 }}>Revisa que las letras y tildes se vean bien antes de guardar.</div>

          <label style={etiqueta} htmlFor="biblia-nombre">Nombre</label>
          <input id="biblia-nombre" value={form.nombre} maxLength={80} disabled={guardando} onChange={(e) => setForm({ ...form, nombre: e.target.value })} style={inputStyle} />
          <label style={etiqueta} htmlFor="biblia-codigo">Abreviatura (la que se ve en la proyección)</label>
          <input id="biblia-codigo" value={form.codigo} maxLength={10} disabled={guardando} onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase().replace(/\s/g, "") })} style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }} />
          {problemaCodigo && <div role="alert" style={{ fontSize: 12, color: "#C23B32", marginTop: 4 }}>{problemaCodigo}</div>}
          <label style={etiqueta} htmlFor="biblia-idioma">Idioma (opcional)</label>
          <input id="biblia-idioma" value={form.idioma} maxLength={40} disabled={guardando} placeholder="Ej. Ixil" onChange={(e) => setForm({ ...form, idioma: e.target.value })} style={inputStyle} />

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "var(--wf-text-2)", marginTop: 14, lineHeight: 1.45 }}>
            <AlertTriangle size={15} color="#E8821E" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Sube solo versiones que tu iglesia tiene permiso de usar. Esta Biblia la ve <b>solo tu iglesia</b>.</span>
          </div>

          {guardando ? (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 8, borderRadius: 4, background: "var(--wf-hover)", overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--wf-brand-accent)", transition: "width .2s" }} />
              </div>
              <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 6 }}>Guardando… {miles(progreso.hechos)} de {miles(progreso.total)} versículos. No cierres esta pantalla.</div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setPrevia(null)} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid var(--wf-divider)", background: "var(--wf-card)", color: "var(--wf-text)", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={guardar} disabled={!!problemaCodigo || !form.nombre.trim()} style={{ ...primaryBtn, flex: 2, minHeight: 44, opacity: problemaCodigo || !form.nombre.trim() ? 0.5 : 1 }}>{previa.reemplaza ? "Reemplazar" : "Guardar Biblia"}</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {input}
      <div style={{ fontSize: 13.5, color: "var(--wf-muted)", margin: "-10px 0 16px", lineHeight: 1.5 }}>
        Agrega las versiones que usa tu iglesia (por ejemplo, en el idioma de tu región) desde un archivo <b>Zefania XML</b>. Salen de primeras en el selector de versión, solo para tu iglesia.
      </div>

      {propias.length === 0 ? (
        <div style={{ ...tarjeta, display: "flex", alignItems: "center", gap: 12, color: "var(--wf-muted)", fontSize: 13 }}>
          <BookOpen size={20} color="#2F5FA8" style={{ flexShrink: 0 }} /> Todavía no han importado ninguna versión.
        </div>
      ) : propias.map((v) => (
        <div key={v.bibliaId} style={{ ...tarjeta, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: "#2F5FA8", background: "#E8F1FB", borderRadius: 8, padding: "4px 8px", flexShrink: 0 }}>{v.code}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis" }}>{v.label}</div>
            <div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>{resumenTestamentos(v.libros)}</div>
          </div>
          <button onClick={() => elegirArchivo(v)} disabled={leyendo} aria-label={`Reemplazar ${v.code}`} title="Reemplazar con otro archivo" style={{ background: "none", border: "none", padding: 10, cursor: "pointer", color: "var(--wf-text-2)" }}><RefreshCw size={17} /></button>
          <button onClick={() => borrar(v)} aria-label={`Borrar ${v.code}`} title="Borrar" style={{ background: "none", border: "none", padding: 10, cursor: "pointer", color: "#C23B32" }}><Trash2 size={17} /></button>
        </div>
      ))}

      <button onClick={() => elegirArchivo(null)} disabled={leyendo} style={{ ...primaryBtn, width: "100%", minHeight: 48, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <Upload size={17} /> {leyendo ? "Leyendo el archivo…" : "Importar versión (.xml)"}
      </button>
    </div>
  );
}
