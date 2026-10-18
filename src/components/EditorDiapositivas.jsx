import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Undo2, Redo2, Type, ImagePlus, PaintBucket, AlignLeft, AlignCenter, AlignRight, AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  Copy, BringToFront, SendToBack, Trash2, LayoutTemplate, Plus, Bold, Italic, Loader2, ClipboardPaste, CopyPlus, Shapes, Smile, Search, BookmarkPlus, RotateCcw, X as XIcon, Play, Sparkles,
} from "lucide-react";
import { listarPlantillasIglesia, guardarPlantillaIglesia, borrarPlantillaIglesia } from "../lib/plantillasIglesia.js";
import { ICONOS_DISENO } from "./iconosDiseno.js";
import DiapositivaDisenada from "./DiapositivaDisenada.jsx";
import { ENTRADAS, PERMANENCIAS, ANIM_CAPA_VACIA, pasosDeDiapositiva } from "../lib/animaciones.js";
import {
  FUENTES, COLORES, PLANTILLAS, LIENZO_ANCHO, familiaDe, nuevaCapaTexto, nuevaCapaImagen, clonarDiapositiva, clonarCapa,
  posicionRapida, ajustarAGuias, redondear, nuevaDiapositiva, FORMAS, nuevaCapaForma, nuevaCapaIcono, DEGRADADOS, degradado, cssDegradado,
} from "../lib/diapositivas.js";
import { subirFondo } from "../lib/multimedia.js";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { confirmDialog, promptDialog } from "../lib/confirm.js";
import { notifyError, showToast } from "../lib/toast.js";

// Editor de diapositivas (pedido de Eldin, 2026-10-10) — SOLO escritorio, tipo PowerPoint:
// a la izquierda las diapositivas del grupo (reordenar arrastrando, duplicar, copiar/pegar), al centro
// el lienzo 16:9 (arrastrar, estirar desde las esquinas, guías al centrar, doble clic para escribir) y
// a la derecha las opciones de lo seleccionado. Nada se guarda ni sale en pantalla hasta "Listo".

// Portapapeles compartido entre aperturas del editor: copiar en un grupo y pegar en otro.
let portapapeles = null; // { tipo: "capa", capa } | { tipo: "diapositiva", diapositiva }

const C = {
  fondo: "#0F141C", panel: "#121923", cinta: "#141B26", borde: "#222B38", campo: "#1E2633", bordeCampo: "#2C3646",
  texto: "#E8ECF2", suave: "#9AA4B2", tenue: "#6B7584", naranja: "#E8821E", azul: "#2F8CFF", marino: "#16324F",
};
const estiloCampo = { background: C.campo, border: `1px solid ${C.bordeCampo}`, borderRadius: 8, padding: "6px 9px", fontSize: 12.5, color: C.texto, width: "100%", boxSizing: "border-box", fontFamily: "inherit" };
const etiqueta = { color: C.suave, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" };

function BotonCinta({ icon: Icon, label, onClick, activo, deshabilitado, titulo }) {
  return (
    <button
      onClick={onClick} disabled={deshabilitado} title={titulo || label}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 60, height: 52, padding: "0 6px", borderRadius: 10, border: "none", cursor: deshabilitado ? "default" : "pointer", background: activo ? C.naranja : "transparent", color: activo ? C.marino : deshabilitado ? "#4A5464" : "#C9D1DC", fontSize: 11, fontWeight: activo ? 700 : 500 }}
      onMouseEnter={(e) => { if (!activo && !deshabilitado) e.currentTarget.style.background = "#1E2633"; }}
      onMouseLeave={(e) => { if (!activo) e.currentTarget.style.background = "transparent"; }}
    >
      <Icon size={18} />{label}
    </button>
  );
}
function GrupoCinta({ label, children, ultimo }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 10px", borderRight: ultimo ? "none" : `1px solid ${C.borde}` }}>
      <div style={{ display: "flex", gap: 2 }}>{children}</div>
      <div style={{ fontSize: 10.5, color: C.tenue, marginTop: 2 }}>{label}</div>
    </div>
  );
}
function Muestras({ valor, onCambiar, conNinguno }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {conNinguno && (
        <button onClick={() => onCambiar(null)} title="Sin fondo" style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${valor == null ? C.naranja : C.bordeCampo}`, background: "transparent", cursor: "pointer", position: "relative", padding: 0 }}>
          <span style={{ position: "absolute", left: 2, right: 2, top: 10, height: 2, background: "#C23B32", transform: "rotate(-45deg)" }} />
        </button>
      )}
      {COLORES.map((c) => (
        <button key={c} onClick={() => onCambiar(c)} title={c} style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${valor?.toLowerCase() === c.toLowerCase() ? C.naranja : C.bordeCampo}`, background: c, cursor: "pointer", padding: 0 }} />
      ))}
      <label title="Otro color" style={{ width: 24, height: 24, borderRadius: 6, border: `2px dashed ${C.bordeCampo}`, overflow: "hidden", cursor: "pointer", position: "relative", background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(valor || "") ? valor : "#ffffff"} onChange={(e) => onCambiar(e.target.value)} style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer" }} />
      </label>
    </div>
  );
}
function Segmentos({ opciones, valor, onCambiar }) {
  return (
    <div style={{ display: "flex", background: C.campo, borderRadius: 8, overflow: "hidden" }}>
      {opciones.map(([v, label, Icon]) => (
        <button key={v} onClick={() => onCambiar(v)} title={label} style={{ flex: 1, padding: "6px 0", border: "none", cursor: "pointer", background: valor === v ? C.naranja : "transparent", color: valor === v ? C.marino : C.suave, fontWeight: valor === v ? 700 : 500, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
          {Icon ? <Icon size={14} /> : label}
        </button>
      ))}
    </div>
  );
}
function Deslizador({ valor, min, max, paso = 1, onCambiar, onInicio, sufijo = "" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="range" min={min} max={max} step={paso} value={valor} onPointerDown={onInicio} onChange={(e) => onCambiar(Number(e.target.value))} style={{ flex: 1, accentColor: C.naranja }} />
      <span style={{ fontSize: 11.5, color: C.suave, minWidth: 34, textAlign: "right" }}>{Math.round(valor)}{sufijo}</span>
    </div>
  );
}

// Medidas reales de una imagen (para que entre con su proporción).
const medirImagen = (url) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
  img.onerror = () => resolve({ w: 16, h: 9 });
  img.src = url;
});

export default function EditorDiapositivas({ titulo: tituloInicial, diapositivas: inicial, indiceInicial = 0, alAire = false, nueva = false, iglesiaId, onGuardar, onCerrar }) {
  const [titulo, setTitulo] = useState(tituloInicial || "");
  const [hist, setHist] = useState(() => ({ pasado: [], presente: inicial?.length ? inicial : [nuevaDiapositiva()], futuro: [] }));
  const diaps = hist.presente;
  const [sel, setSel] = useState(Math.min(Math.max(0, indiceInicial), Math.max(0, (inicial?.length || 1) - 1)));
  const [capaSel, setCapaSel] = useState(null);
  const [editandoTexto, setEditandoTexto] = useState(null);
  const [guias, setGuias] = useState({ x: null, y: null });
  const [menu, setMenu] = useState(null); // { x, y, indice } — clic derecho en una miniatura
  const [plantillasAbiertas, setPlantillasAbiertas] = useState(nueva); // una diapositiva nueva abre con las plantillas a la vista
  const [panelInsertar, setPanelInsertar] = useState(null); // null | "formas" | "iconos"
  const [buscarIcono, setBuscarIcono] = useState("");
  // Plantillas propias de la iglesia (null = todavía no se cargan, o la tabla no existe aún).
  const [misPlantillas, setMisPlantillas] = useState(null);
  const [plantillasDisponibles, setPlantillasDisponibles] = useState(true);
  useEffect(() => {
    let vivo = true;
    listarPlantillasIglesia()
      .then((lista) => { if (!vivo) return; if (lista === null) setPlantillasDisponibles(false); else setMisPlantillas(lista); })
      .catch(() => { if (vivo) setPlantillasDisponibles(false); });
    return () => { vivo = false; };
  }, []);
  const [subiendo, setSubiendo] = useState(false);
  const [zona, setZona] = useState("lienzo"); // dónde fue el último clic: "lienzo" | "lista" (para Supr)
  const [lienzoPx, setLienzoPx] = useState({ w: 960, h: 540 });
  const areaRef = useRef(null);
  const lienzoRef = useRef(null);
  const gestoRef = useRef(null);
  const inputImagenRef = useRef(null);
  const inputFondoRef = useRef(null);
  const textareaRef = useRef(null);

  const diap = diaps[sel] || diaps[0];
  const capa = diap?.capas.find((c) => c.id === capaSel) || null;
  // Vista previa de las animaciones (pantalla completa): cada clic revela el siguiente paso, como en vivo.
  const [vistaPrevia, setVistaPrevia] = useState(null); // null | { paso, vuelta }
  const pasosDiap = pasosDeDiapositiva(diap);
  const sucio = titulo !== (tituloInicial || "") || JSON.stringify(diaps) !== JSON.stringify(inicial || []);

  // ---- Historial (deshacer/rehacer) ----
  const cambiar = (fn, { guardarHistoria = true } = {}) => setHist((h) => {
    const nuevo = fn(h.presente);
    if (nuevo === h.presente) return h;
    return guardarHistoria ? { pasado: [...h.pasado.slice(-80), h.presente], presente: nuevo, futuro: [] } : { ...h, presente: nuevo };
  });
  const marcarHistoria = () => setHist((h) => ({ pasado: [...h.pasado.slice(-80), h.presente], presente: h.presente, futuro: [] }));
  const deshacer = () => setHist((h) => (h.pasado.length ? { pasado: h.pasado.slice(0, -1), presente: h.pasado[h.pasado.length - 1], futuro: [h.presente, ...h.futuro] } : h));
  const rehacer = () => setHist((h) => (h.futuro.length ? { pasado: [...h.pasado, h.presente], presente: h.futuro[0], futuro: h.futuro.slice(1) } : h));
  useEffect(() => { if (sel >= diaps.length) setSel(Math.max(0, diaps.length - 1)); }, [diaps.length, sel]);
  useEffect(() => { if (capaSel && !diap?.capas.some((c) => c.id === capaSel)) { setCapaSel(null); setEditandoTexto(null); } }, [diap, capaSel]);

  const cambiarDiap = (fn, opciones) => cambiar((ds) => ds.map((d, i) => (i === sel ? fn(d) : d)), opciones);
  const cambiarCapa = (patch, opciones) => cambiarDiap((d) => ({ ...d, capas: d.capas.map((c) => (c.id === capaSel ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c)) }), opciones);

  // ---- Lienzo: tamaño que cabe en el área central ----
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(320, Math.min(r.width - 64, ((r.height - 64) * 16) / 9));
      setLienzoPx({ w, h: (w * 9) / 16 });
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Arrastrar / estirar capas ----
  const iniciarGesto = (e, c, modo) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setZona("lienzo");
    if (editandoTexto === c.id) return;
    setCapaSel(c.id);
    if (editandoTexto) setEditandoTexto(null);
    const r = lienzoRef.current.getBoundingClientRect();
    gestoRef.current = { modo, x0: e.clientX, y0: e.clientY, capa0: { ...c }, w: r.width, h: r.height, movido: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moverGesto = (e) => {
    const g = gestoRef.current;
    if (!g) return;
    const dx = ((e.clientX - g.x0) / g.w) * 100;
    const dy = ((e.clientY - g.y0) / g.h) * 100;
    if (!g.movido) {
      if (Math.abs(e.clientX - g.x0) + Math.abs(e.clientY - g.y0) < 3) return;
      g.movido = true;
      marcarHistoria();
    }
    const c0 = g.capa0;
    let nueva;
    if (g.modo === "mover") {
      const otras = (diap?.capas || []).filter((x) => x.id !== c0.id);
      const r = e.altKey ? { capa: { ...c0, x: redondear(c0.x + dx), y: redondear(c0.y + dy) }, guias: { x: null, y: null } } : ajustarAGuias({ ...c0, x: c0.x + dx, y: c0.y + dy }, otras);
      nueva = r.capa;
      setGuias(r.guias);
    } else {
      // Estirar desde un asa: n/s/e/w y sus combinaciones. Imágenes mantienen su proporción (o con Shift).
      let { x, y, w, h } = c0;
      const m = g.modo;
      if (m.includes("e")) w = Math.max(2, c0.w + dx);
      if (m.includes("s")) h = Math.max(2, c0.h + dy);
      if (m.includes("w")) { w = Math.max(2, c0.w - dx); x = c0.x + c0.w - w; }
      if (m.includes("n")) { h = Math.max(2, c0.h - dy); y = c0.y + c0.h - h; }
      const mantener = (c0.tipo === "imagen" || c0.tipo === "icono" || (c0.tipo === "forma" && c0.forma === "circulo")) !== e.shiftKey && m.length === 2;
      if (mantener) {
        const prop = c0.w / c0.h;
        if (Math.abs(dx) > Math.abs(dy)) { const h2 = w / prop; if (m.includes("n")) y = c0.y + c0.h - h2; h = h2; }
        else { const w2 = h * prop; if (m.includes("w")) x = c0.x + c0.w - w2; w = w2; }
      }
      nueva = { ...c0, x: redondear(x), y: redondear(y), w: redondear(w), h: redondear(h) };
    }
    cambiarDiap((d) => ({ ...d, capas: d.capas.map((x) => (x.id === c0.id ? nueva : x)) }), { guardarHistoria: false });
  };
  const terminarGesto = () => { gestoRef.current = null; setGuias({ x: null, y: null }); };

  // ---- Acciones ----
  const agregarTexto = () => {
    const c = nuevaCapaTexto();
    cambiarDiap((d) => ({ ...d, capas: [...d.capas, c] }));
    setCapaSel(c.id);
    setTimeout(() => { setEditandoTexto(c.id); }, 0);
  };
  const agregarCapa = (c) => {
    cambiarDiap((d) => ({ ...d, capas: [...d.capas, c] }));
    setCapaSel(c.id); setEditandoTexto(null); setPanelInsertar(null); setZona("lienzo");
  };
  const elegirImagen = async (file, destino) => {
    if (!file) return;
    setSubiendo(true);
    try {
      const url = await subirFondo(iglesiaId, "imagen", file);
      if (destino === "fondo") {
        cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, tipo: "imagen", url, ajuste: d.fondo?.ajuste || "cover" } }));
      } else if (destino === "reemplazar" && capa) {
        cambiarCapa({ url });
      } else {
        const { w, h } = await medirImagen(url);
        const c = nuevaCapaImagen(url, w, h);
        cambiarDiap((d) => ({ ...d, capas: [...d.capas, c] }));
        setCapaSel(c.id);
      }
    } catch (e) {
      notifyError("No se pudo subir la imagen", e);
    } finally {
      setSubiendo(false);
    }
  };
  const alinearCapa = (eje, donde) => {
    if (!capa) return;
    if (eje === "x") cambiarCapa((c) => ({ x: redondear(donde === 0 ? 5 : donde === 1 ? (100 - c.w) / 2 : 95 - c.w) }));
    else cambiarCapa((c) => ({ y: redondear(donde === 0 ? 5 : donde === 1 ? (100 - c.h) / 2 : 95 - c.h) }));
  };
  const duplicarCapa = () => {
    if (!capa) return;
    const c = clonarCapa(capa, 3);
    cambiarDiap((d) => ({ ...d, capas: [...d.capas, c] }));
    setCapaSel(c.id);
  };
  const ordenCapa = (alFrente) => {
    if (!capa) return;
    cambiarDiap((d) => {
      const resto = d.capas.filter((c) => c.id !== capa.id);
      return { ...d, capas: alFrente ? [...resto, capa] : [capa, ...resto] };
    });
  };
  const borrarCapa = () => {
    if (!capa) return;
    cambiarDiap((d) => ({ ...d, capas: d.capas.filter((c) => c.id !== capa.id) }));
    setCapaSel(null); setEditandoTexto(null);
  };
  const insertarDiapositiva = (d, despuesDe = sel) => {
    cambiar((ds) => [...ds.slice(0, despuesDe + 1), d, ...ds.slice(despuesDe + 1)]);
    setSel(despuesDe + 1); setCapaSel(null);
  };
  // Una plantilla sobre una diapositiva vacía (sin textos ni imágenes y con fondo de color) la
  // reemplaza; si no, entra como diapositiva nueva después de la actual.
  const usarPlantilla = (p) => {
    const d = p.crear();
    const vacia = diap && !diap.capas.length && (diap.fondo?.tipo || "color") === "color";
    if (vacia) { cambiar((ds) => ds.map((x, i) => (i === sel ? d : x))); setCapaSel(null); }
    else insertarDiapositiva(d);
    if (nueva && (!titulo.trim() || titulo === "Diapositiva") && p.clave !== "blanco") setTitulo(p.nombre);
  };
  const guardarComoPlantilla = async () => {
    if (!diap) return;
    if (!plantillasDisponibles) { showToast("Guardar plantillas todavía no está activado en esta iglesia. Avísale a Eldin.", "error"); return; }
    const nombre = await promptDialog("Así la vas a encontrar en Plantillas → De mi iglesia.", { titulo: "Guardar como mi plantilla", placeholder: "Ej. Anuncio estilo JBP", textoConfirmar: "Guardar" });
    if (!nombre || !nombre.trim()) return;
    try {
      const nueva = await guardarPlantillaIglesia(nombre.trim(), clonarDiapositiva(diap));
      setMisPlantillas((l) => [nueva, ...(l || [])]);
      showToast(`Plantilla "${nombre.trim()}" guardada. La encuentras en Plantillas.`, "info");
    } catch (e) { notifyError("No se pudo guardar la plantilla", e); }
  };
  const borrarMiPlantilla = async (t) => {
    if (!(await confirmDialog(`Se borra para toda la iglesia. Las diapositivas que ya la usan no cambian.`, { titulo: `¿Borrar la plantilla "${t.nombre}"?`, danger: true, textoConfirmar: "Borrar" }))) return;
    try { await borrarPlantillaIglesia(t.id); setMisPlantillas((l) => (l || []).filter((x) => x.id !== t.id)); }
    catch (e) { notifyError("No se pudo borrar la plantilla", e); }
  };
  const duplicarDiapositiva = (i = sel) => insertarDiapositiva(clonarDiapositiva(diaps[i]), i);
  const borrarDiapositiva = async (i = sel) => {
    if (diaps.length <= 1) {
      if (!(await confirmDialog("Es la única diapositiva de este grupo. Si la borras, al tocar Listo se quita el grupo del orden del culto.", { titulo: "Borrar diapositiva", danger: true, textoConfirmar: "Borrar" }))) return;
    }
    cambiar((ds) => ds.filter((_, k) => k !== i));
    setSel((s) => Math.max(0, Math.min(s, diaps.length - 2))); setCapaSel(null);
  };
  const copiar = (i = null) => {
    if (i === null && capa) portapapeles = { tipo: "capa", capa: JSON.parse(JSON.stringify(capa)) };
    else portapapeles = { tipo: "diapositiva", diapositiva: JSON.parse(JSON.stringify(diaps[i ?? sel])) };
  };
  const pegar = (despuesDe = sel) => {
    if (!portapapeles) return;
    if (portapapeles.tipo === "capa") {
      const c = clonarCapa(portapapeles.capa, 2);
      cambiarDiap((d) => ({ ...d, capas: [...d.capas, c] }));
      setCapaSel(c.id);
    } else {
      insertarDiapositiva(clonarDiapositiva(portapapeles.diapositiva), despuesDe);
    }
  };

  const cerrar = async () => {
    if (sucio && !(await confirmDialog("Tienes cambios sin guardar en estas diapositivas. ¿Salir sin guardarlos?", { titulo: "Cambios sin guardar", danger: true, textoConfirmar: "Salir sin guardar" }))) return;
    onCerrar();
  };
  const listo = () => onGuardar(diaps, titulo.trim() || tituloInicial || "Diapositivas");

  // ---- Teclado (en fase de captura: mientras el editor está abierto, las flechas no cambian la
  // diapositiva al aire de la consola de atrás) ----
  const accionesRef = useRef({});
  accionesRef.current = { deshacer, rehacer, borrarCapa, borrarDiapositiva, copiar, pegar, duplicarCapa, duplicarDiapositiva, capa, zona, sel, diaps, editandoTexto };
  useEffect(() => {
    const onKey = (e) => {
      const a = accionesRef.current;
      const el = document.activeElement;
      const escribiendo = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (document.querySelector("[data-dialogo-confirmacion]")) return;
      if (escribiendo) {
        if (e.key === "Escape" && a.editandoTexto) { e.preventDefault(); setEditandoTexto(null); el.blur(); }
        return;
      }
      e.stopPropagation();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z" && !e.shiftKey) { e.preventDefault(); a.deshacer(); }
      else if (mod && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); a.rehacer(); }
      else if (mod && k === "c") { e.preventDefault(); a.copiar(a.zona === "lista" ? a.sel : null); }
      else if (mod && k === "x") { e.preventDefault(); a.copiar(a.zona === "lista" ? a.sel : null); if (a.capa && a.zona !== "lista") a.borrarCapa(); else a.borrarDiapositiva(); }
      else if (mod && k === "v") { e.preventDefault(); a.pegar(); }
      else if (mod && k === "d") { e.preventDefault(); if (a.capa && a.zona !== "lista") a.duplicarCapa(); else a.duplicarDiapositiva(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (a.capa && a.zona !== "lista") a.borrarCapa(); else if (a.zona === "lista") a.borrarDiapositiva(); }
      else if (e.key === "Escape") { setVistaPrevia(null); setCapaSel(null); setMenu(null); setPlantillasAbiertas(false); setPanelInsertar(null); }
      else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        if (a.capa && a.zona !== "lista") {
          const paso = e.shiftKey ? 2 : 0.5;
          const dx = e.key === "ArrowLeft" ? -paso : e.key === "ArrowRight" ? paso : 0;
          const dy = e.key === "ArrowUp" ? -paso : e.key === "ArrowDown" ? paso : 0;
          cambiarCapa((c) => ({ x: redondear(c.x + dx), y: redondear(c.y + dy) }));
        } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { setSel((s) => Math.max(0, s - 1)); setCapaSel(null); }
        else { setSel((s) => Math.min(a.diaps.length - 1, s + 1)); setCapaSel(null); }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // cambiarCapa depende de sel/capaSel: se lee siempre la versión actual por accionesRef y el cierre.
  });

  // Doble clic para escribir: el cuadro de texto queda encima de la capa con su misma letra.
  useEffect(() => {
    if (editandoTexto && textareaRef.current) { textareaRef.current.focus(); textareaRef.current.select(); }
  }, [editandoTexto]);

  // ---- Lista de diapositivas: arrastrar para reordenar ----
  const arrastre = useArrastreLista({
    habilitado: true,
    onReorder: (desde, hacia) => {
      cambiar((ds) => { const arr = [...ds]; const [m] = arr.splice(desde, 1); arr.splice(hacia, 0, m); return arr; });
      setSel(hacia);
    },
  });

  const escala = lienzoPx.w / LIENZO_ANCHO;
  const asas = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const posAsa = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };
  const cursorAsa = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
  const fondo = diap?.fondo || {};

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: C.fondo, color: C.texto, display: "flex", flexDirection: "column", fontFamily: "'Poppins', sans-serif" }} onPointerDown={() => { if (menu) setMenu(null); if (plantillasAbiertas) setPlantillasAbiertas(false); if (panelInsertar) setPanelInsertar(null); }}>
      {/* Barra superior */}
      <div style={{ height: 54, background: C.marino, display: "flex", alignItems: "center", gap: 12, padding: "0 16px", flexShrink: 0 }}>
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, whiteSpace: "nowrap" }}>Diseño de diapositivas</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre del grupo" aria-label="Nombre del grupo" style={{ ...estiloCampo, width: 280, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)" }} />
        <span style={{ fontSize: 12, color: "#C9D1DC" }}>{diaps.length} diapositiva{diaps.length === 1 ? "" : "s"}</span>
        <div style={{ flex: 1 }} />
        {subiendo && <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#C9D1DC" }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Subiendo imagen…</span>}
        <button onClick={cerrar} style={{ background: "transparent", color: "#fff", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
        <button onClick={listo} disabled={subiendo} style={{ background: C.naranja, color: C.marino, border: "none", borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>{alAire ? "Listo y actualizar pantalla" : "Listo"}</button>
      </div>

      {/* Cinta */}
      <div style={{ display: "flex", alignItems: "stretch", padding: "8px 8px 6px", background: C.cinta, borderBottom: `1px solid ${C.borde}`, flexShrink: 0, position: "relative", zIndex: 3 }}>
        <GrupoCinta label="Edición">
          <BotonCinta icon={Undo2} label="Deshacer" onClick={deshacer} deshabilitado={!hist.pasado.length} titulo="Deshacer (Ctrl+Z)" />
          <BotonCinta icon={Redo2} label="Rehacer" onClick={rehacer} deshabilitado={!hist.futuro.length} titulo="Rehacer (Ctrl+Y)" />
        </GrupoCinta>
        <GrupoCinta label="Insertar">
          <BotonCinta icon={Type} label="Texto" onClick={agregarTexto} />
          <BotonCinta icon={ImagePlus} label="Imagen" onClick={() => inputImagenRef.current?.click()} />
          <div style={{ position: "relative" }} onPointerDown={(e) => e.stopPropagation()}>
            <BotonCinta icon={Shapes} label="Forma" onClick={() => setPanelInsertar((p) => (p === "formas" ? null : "formas"))} activo={panelInsertar === "formas"} titulo="Rectángulo, círculo, línea, franja, marco" />
            {panelInsertar === "formas" && (
              <div style={{ position: "absolute", top: 58, left: 0, zIndex: 5, background: C.panel, border: `1px solid ${C.bordeCampo}`, borderRadius: 12, padding: 10, width: 300, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
                <div style={{ ...etiqueta, marginBottom: 8 }}>Formas</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {FORMAS.map((f) => {
                    const ej = nuevaCapaForma(f.clave);
                    return (
                      <button key={f.clave} onClick={() => agregarCapa(nuevaCapaForma(f.clave))} title={f.nombre}
                        style={{ background: C.campo, border: `1px solid ${C.bordeCampo}`, borderRadius: 8, padding: 8, cursor: "pointer", color: C.texto, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <span style={{ width: 54, height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ display: "block", width: `${Math.min(100, ej.w * 1.6)}%`, height: `${Math.max(6, Math.min(100, ej.h * 1.6))}%`, background: ej.color || "transparent", border: ej.borde ? `2px solid ${ej.borde}` : "none", borderRadius: ej.forma === "circulo" ? "50%" : Math.min(10, (ej.radio || 0) / 6), aspectRatio: ej.forma === "circulo" ? "1" : undefined, maxHeight: "100%" }} />
                        </span>
                        {f.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: "relative" }} onPointerDown={(e) => e.stopPropagation()}>
            <BotonCinta icon={Smile} label="Ícono" onClick={() => setPanelInsertar((p) => (p === "iconos" ? null : "iconos"))} activo={panelInsertar === "iconos"} titulo="Cruz, paloma, Biblia, corazón, micrófono…" />
            {panelInsertar === "iconos" && (
              <div style={{ position: "absolute", top: 58, left: 0, zIndex: 5, background: C.panel, border: `1px solid ${C.bordeCampo}`, borderRadius: 12, padding: 10, width: 380, maxHeight: "62vh", overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, ...estiloCampo, marginBottom: 10 }}>
                  <Search size={14} color={C.suave} />
                  <input autoFocus value={buscarIcono} onChange={(e) => setBuscarIcono(e.target.value)} placeholder="Buscar: cruz, música, fecha…" style={{ background: "transparent", border: "none", outline: "none", color: C.texto, fontSize: 12.5, flex: 1, fontFamily: "inherit" }} />
                </div>
                {[...new Set(ICONOS_DISENO.map((i) => i.grupo))].map((grupo) => {
                  const q = buscarIcono.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                  const lista = ICONOS_DISENO.filter((i) => i.grupo === grupo && (!q || `${i.nombre} ${i.clave}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q)));
                  if (!lista.length) return null;
                  return (
                    <div key={grupo} style={{ marginBottom: 10 }}>
                      <div style={{ ...etiqueta, marginBottom: 6 }}>{grupo}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                        {lista.map(({ clave, nombre, Icon }) => (
                          <button key={clave} onClick={() => agregarCapa(nuevaCapaIcono(clave))} title={nombre}
                            style={{ aspectRatio: "1", background: C.campo, border: `1px solid ${C.bordeCampo}`, borderRadius: 8, cursor: "pointer", color: C.texto, display: "flex", alignItems: "center", justifyContent: "center" }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.naranja; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.bordeCampo; }}>
                            <Icon size={22} strokeWidth={1.6} />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <BotonCinta icon={PaintBucket} label="Fondo" onClick={() => { setCapaSel(null); setEditandoTexto(null); }} activo={!capa} titulo="Opciones del fondo (a la derecha)" />
        </GrupoCinta>
        <GrupoCinta label="Alinear en la diapositiva">
          <BotonCinta icon={AlignLeft} label="Izquierda" onClick={() => alinearCapa("x", 0)} deshabilitado={!capa} />
          <BotonCinta icon={AlignCenter} label="Centrar" onClick={() => alinearCapa("x", 1)} deshabilitado={!capa} />
          <BotonCinta icon={AlignRight} label="Derecha" onClick={() => alinearCapa("x", 2)} deshabilitado={!capa} />
          <BotonCinta icon={AlignStartVertical} label="Arriba" onClick={() => alinearCapa("y", 0)} deshabilitado={!capa} />
          <BotonCinta icon={AlignCenterVertical} label="Medio" onClick={() => alinearCapa("y", 1)} deshabilitado={!capa} />
          <BotonCinta icon={AlignEndVertical} label="Abajo" onClick={() => alinearCapa("y", 2)} deshabilitado={!capa} />
        </GrupoCinta>
        <GrupoCinta label="Objeto">
          <BotonCinta icon={Copy} label="Duplicar" onClick={duplicarCapa} deshabilitado={!capa} titulo="Duplicar (Ctrl+D)" />
          <BotonCinta icon={BringToFront} label="Al frente" onClick={() => ordenCapa(true)} deshabilitado={!capa} />
          <BotonCinta icon={SendToBack} label="Atrás" onClick={() => ordenCapa(false)} deshabilitado={!capa} />
          <BotonCinta icon={Trash2} label="Eliminar" onClick={borrarCapa} deshabilitado={!capa} titulo="Eliminar (Supr)" />
        </GrupoCinta>
        <GrupoCinta label="Animación">
          <BotonCinta icon={Play} label="Reproducir" onClick={() => setVistaPrevia({ paso: 0, vuelta: Date.now() })} titulo="Ver las animaciones de esta diapositiva como en la proyección" />
        </GrupoCinta>
        <GrupoCinta label="Diseños" ultimo>
          <BotonCinta icon={BookmarkPlus} label="Guardar plantilla" onClick={guardarComoPlantilla} titulo="Guardar esta diapositiva como plantilla de tu iglesia, para reusarla" />
          <div style={{ position: "relative" }} onPointerDown={(e) => e.stopPropagation()}>
            <BotonCinta icon={LayoutTemplate} label="Plantillas" onClick={() => setPlantillasAbiertas((v) => !v)} activo={plantillasAbiertas} />
            {plantillasAbiertas && (
              <div style={{ position: "absolute", top: 58, right: 0, zIndex: 5, background: C.panel, border: `1px solid ${C.bordeCampo}`, borderRadius: 12, padding: 10, width: 560, maxHeight: "70vh", overflowY: "auto", boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
                {misPlantillas?.length > 0 && (
                  <>
                    <div style={{ ...etiqueta, marginBottom: 8 }}>De mi iglesia</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      {misPlantillas.map((t) => (
                        <div key={t.id} style={{ position: "relative" }}>
                          <button onClick={() => { usarPlantilla({ clave: t.id, nombre: t.nombre, crear: () => clonarDiapositiva(t.diapositiva) }); setPlantillasAbiertas(false); }} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: C.texto, width: "100%" }}>
                            <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.naranja}` }}><DiapositivaDisenada diapositiva={t.diapositiva} /></div>
                            <div style={{ fontSize: 11.5, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</div>
                          </button>
                          <button onClick={() => borrarMiPlantilla(t)} title="Borrar esta plantilla" style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><XIcon size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ ...etiqueta, marginBottom: 8 }}>Plantillas · todo se puede cambiar después</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {PLANTILLAS.map((p) => {
                    const ejemplo = p.crear();
                    return (
                      <button key={p.clave} onClick={() => { usarPlantilla(p); setPlantillasAbiertas(false); }} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: C.texto }}>
                        <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.bordeCampo}` }}><DiapositivaDisenada diapositiva={ejemplo} /></div>
                        <div style={{ fontSize: 11.5, marginTop: 4 }}>{p.nombre}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </GrupoCinta>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {/* Diapositivas del grupo */}
        <div style={{ width: 220, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.borde}`, overflowY: "auto", padding: 12 }} onPointerDown={() => setZona("lista")}>
          <div style={{ ...etiqueta }}>Diapositivas</div>
          {diaps.map((d, i) => (
            <div
              key={d.id} {...arrastre.filaProps(i)}
              onClick={() => { setSel(i); setCapaSel(null); setEditandoTexto(null); setZona("lista"); }}
              onContextMenu={(e) => { e.preventDefault(); setSel(i); setZona("lista"); setMenu({ x: e.clientX, y: e.clientY, indice: i }); }}
              style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10, cursor: "pointer", ...arrastre.estiloFila(i) }}
            >
              <span style={{ fontSize: 11, color: C.suave, width: 14, textAlign: "right", paddingTop: 4 }}>{i + 1}</span>
              <div style={{ position: "relative", flex: 1, aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", outline: i === sel ? `2px solid ${C.naranja}` : `1px solid ${C.bordeCampo}`, outlineOffset: i === sel ? 1 : 0 }}>
                <DiapositivaDisenada diapositiva={d} />
              </div>
            </div>
          ))}
          <button onClick={() => insertarDiapositiva(nuevaDiapositiva(), diaps.length - 1)} style={{ width: "100%", aspectRatio: "16/9", marginLeft: 22, maxWidth: "calc(100% - 22px)", borderRadius: 8, border: `2px dashed ${C.bordeCampo}`, background: "transparent", color: C.tenue, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 12 }}>
            <Plus size={16} /> Nueva diapositiva
          </button>
          <div style={{ fontSize: 10.5, color: C.tenue, marginTop: 10, lineHeight: 1.5 }}>Arrastra para cambiar el orden. Clic derecho para duplicar, copiar o borrar.</div>
        </div>

        {/* Lienzo */}
        <div ref={areaRef} style={{ flex: 1, minWidth: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", background: "#0B1017" }}
          onPointerDown={() => { setZona("lienzo"); setCapaSel(null); setEditandoTexto(null); }}>
          <div style={{ position: "relative", width: lienzoPx.w, height: lienzoPx.h, boxShadow: "0 10px 40px rgba(0,0,0,0.55)" }} onPointerDown={(e) => e.stopPropagation()}>
            <DiapositivaDisenada diapositiva={diap ? { ...diap, capas: diap.capas.filter((c) => c.id !== editandoTexto) } : null} lienzoRef={lienzoRef} onPointerDownLienzo={() => { setZona("lienzo"); setCapaSel(null); setEditandoTexto(null); }}>
              {guias.x !== null && <div style={{ position: "absolute", left: `${guias.x}%`, top: 0, bottom: 0, width: 1, background: "#FF4FA3", pointerEvents: "none" }} />}
              {guias.y !== null && <div style={{ position: "absolute", top: `${guias.y}%`, left: 0, right: 0, height: 1, background: "#FF4FA3", pointerEvents: "none" }} />}
              {(diap?.capas || []).map((c) => {
                const seleccionada = c.id === capaSel;
                if (c.id === editandoTexto) {
                  return (
                    <textarea
                      key={c.id} ref={textareaRef} value={c.texto}
                      onPointerDown={(e) => e.stopPropagation()}
                      onFocus={marcarHistoria}
                      onChange={(e) => cambiarCapa({ texto: e.target.value }, { guardarHistoria: false })}
                      onBlur={() => setEditandoTexto(null)}
                      style={{
                        position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, boxSizing: "border-box", resize: "none",
                        background: c.caja || "rgba(0,0,0,0.25)", border: `2px solid ${C.azul}`, borderRadius: (c.radio || 0) * escala, outline: "none",
                        padding: c.caja ? `${18 * escala}px ${32 * escala}px` : 0, margin: 0, overflow: "hidden",
                        fontFamily: familiaDe(c.fuente), fontSize: (c.tamano || 64) * escala, color: c.color, fontWeight: c.negrita ? 700 : 400, fontStyle: c.cursiva ? "italic" : "normal",
                        textAlign: c.alinear || "center", lineHeight: 1.2, transform: c.rotacion ? `rotate(${c.rotacion}deg)` : undefined,
                      }}
                    />
                  );
                }
                return (
                  <div
                    key={c.id}
                    onPointerDown={(e) => iniciarGesto(e, c, "mover")} onPointerMove={moverGesto} onPointerUp={terminarGesto} onPointerCancel={terminarGesto}
                    onDoubleClick={() => { if (c.tipo === "texto") setEditandoTexto(c.id); else setCapaSel(c.id); }}
                    title={c.tipo === "texto" ? "Doble clic para escribir" : undefined}
                    style={{ position: "absolute", left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%`, boxSizing: "border-box", cursor: "move", outline: seleccionada ? `2px solid ${C.azul}` : "1px dashed transparent", touchAction: "none", transform: c.rotacion ? `rotate(${c.rotacion}deg)` : undefined }}
                    onMouseEnter={(e) => { if (!seleccionada) e.currentTarget.style.outline = "1px dashed rgba(255,255,255,0.6)"; }}
                    onMouseLeave={(e) => { if (!seleccionada) e.currentTarget.style.outline = "1px dashed transparent"; }}
                  >
                    {c.anim && (
                      <span title={c.anim.paso > 0 ? `Aparece con el clic ${c.anim.paso}` : "Tiene animación"} style={{ position: "absolute", top: -9, right: 14, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 9, background: C.naranja, color: C.marino, fontSize: 10.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 2, pointerEvents: "none", boxSizing: "border-box" }}>
                        {c.anim.paso > 0 ? c.anim.paso : <Sparkles size={10} />}
                      </span>
                    )}
                    {seleccionada && asas.map((a) => (
                      <span
                        key={a}
                        onPointerDown={(e) => iniciarGesto(e, c, a)} onPointerMove={moverGesto} onPointerUp={terminarGesto} onPointerCancel={terminarGesto}
                        style={{ position: "absolute", left: `${posAsa[a][0]}%`, top: `${posAsa[a][1]}%`, width: 11, height: 11, marginLeft: -6, marginTop: -6, background: "#fff", border: `2px solid ${C.azul}`, borderRadius: 3, cursor: cursorAsa[a], boxSizing: "border-box", touchAction: "none" }}
                      />
                    ))}
                  </div>
                );
              })}
            </DiapositivaDisenada>
          </div>
          <div style={{ position: "absolute", left: 16, bottom: 12, fontSize: 11.5, color: C.tenue }}>
            {capa ? (capa.tipo === "texto" ? "Texto seleccionado · Doble clic para escribir · Flechas para mover · Alt = sin guías" : `${capa.tipo === "forma" ? "Forma seleccionada" : capa.tipo === "icono" ? "Ícono seleccionado" : "Imagen seleccionada"} · Arrastra las esquinas para cambiar el tamaño · Shift = libre`) : "Clic en un elemento para seleccionarlo"}
          </div>
          <div style={{ position: "absolute", right: 16, bottom: 12, fontSize: 11.5, color: C.tenue }}>Diapositiva {sel + 1} de {diaps.length} · 16:9</div>
        </div>

        {/* Propiedades */}
        <div style={{ width: 290, flexShrink: 0, background: C.panel, borderLeft: `1px solid ${C.borde}`, overflowY: "auto", padding: 16, fontSize: 12.5 }}>
          {capa?.tipo === "texto" ? (
            <>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto }}>Texto</div>
              <div style={{ marginBottom: 14 }}>
                <textarea value={capa.texto} onFocus={marcarHistoria} onChange={(e) => cambiarCapa({ texto: e.target.value }, { guardarHistoria: false })} rows={3} style={{ ...estiloCampo, resize: "vertical" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Fuente</div>
                <select value={capa.fuente} onChange={(e) => cambiarCapa({ fuente: e.target.value })} style={{ ...estiloCampo, fontFamily: familiaDe(capa.fuente) }}>
                  {FUENTES.map((f) => <option key={f.clave} value={f.clave} style={{ fontFamily: f.family }}>{f.nombre}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Tamaño</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input type="number" min={12} max={400} value={Math.round(capa.tamano)} onFocus={marcarHistoria} onChange={(e) => cambiarCapa({ tamano: Math.max(12, Math.min(400, Number(e.target.value) || 12)) }, { guardarHistoria: false })} style={{ ...estiloCampo, flex: 1 }} />
                  <button onClick={() => cambiarCapa((c) => ({ tamano: Math.max(12, Math.round(c.tamano * 0.9)) }))} style={{ ...estiloCampo, width: 40, cursor: "pointer" }}>A−</button>
                  <button onClick={() => cambiarCapa((c) => ({ tamano: Math.min(400, Math.round(c.tamano * 1.1)) }))} style={{ ...estiloCampo, width: 40, cursor: "pointer" }}>A+</button>
                  <button onClick={() => cambiarCapa((c) => ({ negrita: !c.negrita }))} title="Negrita" style={{ ...estiloCampo, width: 36, cursor: "pointer", background: capa.negrita ? C.naranja : C.campo, color: capa.negrita ? C.marino : C.texto }}><Bold size={14} /></button>
                  <button onClick={() => cambiarCapa((c) => ({ cursiva: !c.cursiva }))} title="Cursiva" style={{ ...estiloCampo, width: 36, cursor: "pointer", background: capa.cursiva ? C.naranja : C.campo, color: capa.cursiva ? C.marino : C.texto }}><Italic size={14} /></button>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Color</div><Muestras valor={capa.color} onCambiar={(v) => cambiarCapa({ color: v })} /></div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Alineación</div>
                <Segmentos valor={capa.alinear} onCambiar={(v) => cambiarCapa({ alinear: v })} opciones={[["left", "Izquierda", AlignLeft], ["center", "Centro", AlignCenter], ["right", "Derecha", AlignRight]]} />
                <div style={{ height: 6 }} />
                <Segmentos valor={capa.vertical || "middle"} onCambiar={(v) => cambiarCapa({ vertical: v })} opciones={[["top", "Arriba"], ["middle", "Medio"], ["bottom", "Abajo"]]} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Caja detrás del texto</div>
                <Muestras valor={capa.caja} conNinguno onCambiar={(v) => cambiarCapa({ caja: v })} />
                {capa.caja && <div style={{ marginTop: 8 }}><div style={{ ...etiqueta, marginBottom: 2 }}>Esquinas</div><Deslizador valor={capa.radio || 0} min={0} max={120} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ radio: v }, { guardarHistoria: false })} /></div>}
              </div>
            </>
          ) : capa?.tipo === "forma" ? (
            <>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto }}>Forma</div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Tipo</div>
                <Segmentos valor={capa.forma} onCambiar={(v) => cambiarCapa({ forma: v })} opciones={[["rect", "Rectángulo"], ["circulo", "Círculo"]]} />
              </div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Relleno</div><Muestras valor={capa.color} conNinguno onCambiar={(v) => cambiarCapa({ color: v })} /></div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Borde</div>
                <Muestras valor={capa.borde} conNinguno onCambiar={(v) => cambiarCapa({ borde: v })} />
                {capa.borde && <div style={{ marginTop: 8 }}><div style={{ ...etiqueta, marginBottom: 2 }}>Grosor</div><Deslizador valor={capa.grosor || 6} min={1} max={40} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ grosor: v }, { guardarHistoria: false })} /></div>}
              </div>
              {capa.forma !== "circulo" && <div style={{ marginBottom: 14 }}><div style={etiqueta}>Esquinas</div><Deslizador valor={capa.radio || 0} min={0} max={300} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ radio: v }, { guardarHistoria: false })} /></div>}
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Transparencia</div><Deslizador valor={Math.round((capa.opacidad ?? 1) * 100)} min={5} max={100} sufijo="%" onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ opacidad: v / 100 }, { guardarHistoria: false })} /></div>
              <div style={{ fontSize: 11, color: C.tenue, lineHeight: 1.5, marginBottom: 14 }}>Truco: una forma con transparencia detrás de un texto lo hace leer mejor sobre una foto. Usa <b>Atrás</b> para mandarla detrás.</div>
            </>
          ) : capa?.tipo === "icono" ? (
            <>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto }}>Ícono</div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Color</div><Muestras valor={capa.color} onCambiar={(v) => cambiarCapa({ color: v })} /></div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Grosor del trazo</div><Deslizador valor={(capa.grosor || 1.6) * 10} min={5} max={35} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ grosor: v / 10 }, { guardarHistoria: false })} /></div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Transparencia</div><Deslizador valor={Math.round((capa.opacidad ?? 1) * 100)} min={5} max={100} sufijo="%" onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ opacidad: v / 100 }, { guardarHistoria: false })} /></div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Cambiar por otro</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5, maxHeight: 170, overflowY: "auto" }}>
                  {ICONOS_DISENO.map(({ clave, nombre, Icon }) => (
                    <button key={clave} onClick={() => cambiarCapa({ icono: clave })} title={nombre} style={{ aspectRatio: "1", background: capa.icono === clave ? C.naranja : C.campo, border: `1px solid ${C.bordeCampo}`, borderRadius: 6, cursor: "pointer", color: capa.icono === clave ? C.marino : C.texto, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}><Icon size={16} /></button>
                  ))}
                </div>
              </div>
            </>
          ) : capa?.tipo === "imagen" ? (
            <>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto }}>Imagen</div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Ajuste</div>
                <Segmentos valor={capa.ajuste || "contain"} onCambiar={(v) => cambiarCapa({ ajuste: v })} opciones={[["contain", "Completa"], ["cover", "Recortar y llenar"]]} />
              </div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Esquinas</div><Deslizador valor={capa.radio || 0} min={0} max={300} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ radio: v }, { guardarHistoria: false })} /></div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Opacidad</div><Deslizador valor={Math.round((capa.opacidad ?? 1) * 100)} min={10} max={100} sufijo="%" onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ opacidad: v / 100 }, { guardarHistoria: false })} /></div>
              <button onClick={() => { inputImagenRef.current.dataset.destino = "reemplazar"; inputImagenRef.current.click(); }} style={{ ...estiloCampo, cursor: "pointer", marginBottom: 14 }}>Cambiar imagen…</button>
            </>
          ) : (
            <>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto }}>Fondo de la diapositiva</div>
              <div style={{ marginBottom: 14 }}><div style={etiqueta}>Color</div><Muestras valor={fondo.tipo === "degradado" ? null : fondo.color} onCambiar={(v) => cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, color: v, ...(d.fondo?.tipo === "imagen" || d.fondo?.tipo === "video" ? {} : { tipo: "color" }) } }))} /></div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Degradado</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
                  {DEGRADADOS.map((g) => {
                    const activo = fondo.tipo === "degradado" && fondo.color === g.color && fondo.color2 === g.color2;
                    return <button key={g.clave} title={g.nombre} onClick={() => cambiarDiap((d) => ({ ...d, fondo: degradado(g.clave) }))} style={{ aspectRatio: "16/10", borderRadius: 6, cursor: "pointer", padding: 0, background: cssDegradado(g), border: `2px solid ${activo ? C.naranja : C.bordeCampo}` }} />;
                  })}
                </div>
                {fondo.tipo === "degradado" && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, color: C.suave }}>Colores</span>
                      <input type="color" value={fondo.color || "#16324F"} onChange={(e) => cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, color: e.target.value } }))} style={{ width: 34, height: 26, border: "none", background: "none", cursor: "pointer" }} />
                      <input type="color" value={fondo.color2 || "#000000"} onChange={(e) => cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, color2: e.target.value } }))} style={{ width: 34, height: 26, border: "none", background: "none", cursor: "pointer" }} />
                    </div>
                    <div style={{ ...etiqueta, marginBottom: 2 }}>Dirección</div>
                    <Deslizador valor={fondo.angulo ?? 160} min={0} max={360} sufijo="°" onInicio={marcarHistoria} onCambiar={(v) => cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, angulo: v } }), { guardarHistoria: false })} />
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={etiqueta}>Imagen de fondo</div>
                {fondo.tipo === "imagen" && fondo.url ? (
                  <>
                    <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: 8, overflow: "hidden", marginBottom: 8, background: `center / contain no-repeat url(${fondo.url}), #000` }} />
                    <Segmentos valor={fondo.ajuste || "cover"} onCambiar={(v) => cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, ajuste: v } }))} opciones={[["contain", "Completa"], ["cover", "Llenar"]]} />
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button onClick={() => inputFondoRef.current?.click()} style={{ ...estiloCampo, cursor: "pointer" }}>Cambiar…</button>
                      <button onClick={() => cambiarDiap((d) => ({ ...d, fondo: { ...d.fondo, tipo: "color", url: "" } }))} style={{ ...estiloCampo, cursor: "pointer", color: "#FF8A80" }}>Quitar</button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => inputFondoRef.current?.click()} style={{ ...estiloCampo, cursor: "pointer" }}>Subir imagen…</button>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: C.tenue, lineHeight: 1.6 }}>Usa <b>Texto</b>, <b>Imagen</b>, <b>Forma</b> o <b>Ícono</b> arriba para agregar algo encima. Las páginas de un PDF quedan como fondo: puedes ponerles texto o un logo encima sin rehacer el archivo.</div>
            </>
          )}
          {capa && (
            <div style={{ marginBottom: 14, paddingTop: 12, borderTop: `1px solid ${C.borde}` }}>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto }}>Efectos</div>
              {capa.tipo === "texto" && <div style={{ marginBottom: 12 }}><div style={etiqueta}>Transparencia</div><Deslizador valor={Math.round((capa.opacidad ?? 1) * 100)} min={5} max={100} sufijo="%" onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ opacidad: v / 100 }, { guardarHistoria: false })} /></div>}
              <div style={{ marginBottom: 12 }}>
                <div style={etiqueta}>Sombra</div>
                <Deslizador valor={capa.sombra ?? (capa.tipo === "texto" && !capa.caja ? 30 : 0)} min={0} max={100} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ sombra: v }, { guardarHistoria: false })} />
              </div>
              <div>
                <div style={{ ...etiqueta, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  Girar
                  {capa.rotacion ? <button onClick={() => cambiarCapa({ rotacion: 0 })} title="Enderezar" style={{ background: "transparent", border: "none", color: C.naranja, cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, padding: 0 }}><RotateCcw size={11} /> Enderezar</button> : null}
                </div>
                <Deslizador valor={capa.rotacion || 0} min={-180} max={180} sufijo="°" onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa({ rotacion: Math.abs(v) < 2 ? 0 : v }, { guardarHistoria: false })} />
              </div>
            </div>
          )}
          {capa && (
            <div style={{ marginBottom: 14, paddingTop: 12, borderTop: `1px solid ${C.borde}` }}>
              <div style={{ ...etiqueta, fontSize: 12, color: C.texto, display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={13} /> Animación</div>
              <div style={{ marginBottom: 10 }}>
                <div style={etiqueta}>Cómo entra</div>
                <select value={capa.anim?.entrada || ""} onChange={(e) => {
                  const v = e.target.value;
                  cambiarCapa((c) => (v ? { anim: { ...ANIM_CAPA_VACIA, ...(c.anim || {}), entrada: v } } : { anim: c.anim?.paso > 0 ? { ...c.anim, entrada: "aparecer" } : null }));
                }} style={estiloCampo}>
                  <option value="">Sin animación</option>
                  {ENTRADAS.filter((e) => capa.tipo === "texto" || e.clave !== "escribir").map((e) => <option key={e.clave} value={e.clave}>{e.nombre}</option>)}
                </select>
              </div>
              {capa.anim && (
                <>
                  {capa.tipo === "texto" && (
                    <div style={{ marginBottom: 10 }}>
                      <Segmentos valor={capa.anim.unidad || "todo"} onCambiar={(v) => cambiarCapa((c) => ({ anim: { ...c.anim, unidad: v } }))} opciones={[["todo", "Todo junto"], ["palabra", "Por palabra"], ["letra", "Por letra"]]} />
                    </div>
                  )}
                  <div style={{ marginBottom: 10 }}><div style={{ ...etiqueta, marginBottom: 2 }}>Velocidad</div><Deslizador valor={Math.round((capa.anim.velocidad ?? 1) * 100)} min={40} max={200} paso={10} sufijo="%" onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa((c) => ({ anim: { ...c.anim, velocidad: v / 100 } }), { guardarHistoria: false })} /></div>
                  <div style={{ marginBottom: 10 }}><div style={{ ...etiqueta, marginBottom: 2 }}>Esperar antes de entrar (décimas de segundo)</div><Deslizador valor={Math.round((capa.anim.retraso || 0) * 10)} min={0} max={50} onInicio={marcarHistoria} onCambiar={(v) => cambiarCapa((c) => ({ anim: { ...c.anim, retraso: v / 10 } }), { guardarHistoria: false })} /></div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={etiqueta}>Mientras está en pantalla</div>
                    <select value={capa.anim.permanencia || "quieta"} onChange={(e) => cambiarCapa((c) => ({ anim: { ...c.anim, permanencia: e.target.value } }))} style={estiloCampo}>
                      {PERMANENCIAS.map((p) => <option key={p.clave} value={p.clave}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={etiqueta}>Cuándo aparece</div>
                    <Segmentos valor={(capa.anim.paso || 0) > 0 ? "clic" : "con"} onCambiar={(v) => cambiarCapa((c) => ({ anim: { ...c.anim, paso: v === "clic" ? Math.max(1, pasosDiap + ((c.anim?.paso || 0) > 0 ? 0 : 1)) : 0 } }))} opciones={[["con", "Con la diapositiva"], ["clic", "Al dar clic"]]} />
                    {(capa.anim.paso || 0) > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, color: C.texto }}>
                        <span style={{ flex: 1 }}>Clic número</span>
                        <button onClick={() => cambiarCapa((c) => ({ anim: { ...c.anim, paso: Math.max(1, (c.anim.paso || 1) - 1) } }))} style={{ ...estiloCampo, width: 30, padding: 0, height: 26, cursor: "pointer" }}>−</button>
                        <b style={{ minWidth: 16, textAlign: "center" }}>{capa.anim.paso}</b>
                        <button onClick={() => cambiarCapa((c) => ({ anim: { ...c.anim, paso: Math.min(20, (c.anim.paso || 1) + 1) } }))} style={{ ...estiloCampo, width: 30, padding: 0, height: 26, cursor: "pointer" }}>+</button>
                      </div>
                    )}
                    <div style={{ fontSize: 10.5, color: C.tenue, lineHeight: 1.5, marginTop: 6 }}>"Al dar clic": en vivo, cada <b>Siguiente</b> revela el próximo elemento antes de pasar a la otra diapositiva — ideal para los puntos de la prédica.</div>
                  </div>
                </>
              )}
            </div>
          )}
          {capa && (
            <div style={{ marginBottom: 14 }}>
              <div style={etiqueta}>Posición rápida</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                {[0, 1, 2].flatMap((fila) => [0, 1, 2].map((col) => (
                  <button key={`${fila}-${col}`} onClick={() => cambiarCapa((c) => posicionRapida(c, fila, col))} title="Mover aquí" style={{ ...estiloCampo, height: 28, padding: 0, cursor: "pointer", display: "flex", alignItems: fila === 0 ? "flex-start" : fila === 1 ? "center" : "flex-end", justifyContent: col === 0 ? "flex-start" : col === 1 ? "center" : "flex-end" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: C.naranja, margin: 4 }} />
                  </button>
                )))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 18, padding: 10, borderRadius: 10, background: C.campo, color: C.suave, fontSize: 11, lineHeight: 1.6 }}>
            Ctrl+C / Ctrl+V copia y pega (también entre grupos) · Ctrl+D duplica · Supr elimina · Ctrl+Z deshace · Flechas mueven lo seleccionado
          </div>
        </div>
      </div>

      {vistaPrevia && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={() => setVistaPrevia((v) => (v.paso < pasosDiap ? { ...v, paso: v.paso + 1 } : null))}
          style={{ position: "fixed", inset: 0, zIndex: 9200, background: "#000", cursor: "pointer" }}>
          <DiapositivaDisenada key={vistaPrevia.vuelta} diapositiva={diap} animar paso={vistaPrevia.paso} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", gap: 10, pointerEvents: "none" }}>
            <span style={{ background: "rgba(0,0,0,.6)", color: "#fff", fontSize: 12.5, padding: "6px 12px", borderRadius: 999 }}>
              {vistaPrevia.paso < pasosDiap ? `Clic para el siguiente paso (${vistaPrevia.paso} de ${pasosDiap})` : "Clic para cerrar"}
            </span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setVistaPrevia({ paso: 0, vuelta: Date.now() }); }} style={{ position: "absolute", top: 14, left: 14, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><RotateCcw size={14} /> Repetir</button>
          <button onClick={(e) => { e.stopPropagation(); setVistaPrevia(null); }} aria-label="Cerrar vista previa" style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 999, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={16} /></button>
        </div>
      )}
      {menu && (
        <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", left: menu.x, top: menu.y, zIndex: 9100, background: C.panel, border: `1px solid ${C.bordeCampo}`, borderRadius: 10, padding: 4, minWidth: 190, boxShadow: "0 12px 30px rgba(0,0,0,0.5)" }}>
          {[
            [CopyPlus, "Duplicar", () => duplicarDiapositiva(menu.indice), "Ctrl+D"],
            [Copy, "Copiar", () => copiar(menu.indice), "Ctrl+C"],
            ...(portapapeles?.tipo === "diapositiva" ? [[ClipboardPaste, "Pegar después", () => pegar(menu.indice), "Ctrl+V"]] : []),
            [Trash2, "Eliminar", () => borrarDiapositiva(menu.indice), "Supr", true],
          ].map(([Icon, label, accion, atajo, peligro]) => (
            <button key={label} onClick={() => { setMenu(null); accion(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", borderRadius: 7, padding: "7px 10px", cursor: "pointer", color: peligro ? "#FF8A80" : C.texto, fontSize: 12.5, textAlign: "left" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.campo; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
              <Icon size={14} /> <span style={{ flex: 1 }}>{label}</span> <span style={{ color: C.tenue, fontSize: 11 }}>{atajo}</span>
            </button>
          ))}
        </div>
      )}

      <input ref={inputImagenRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; const destino = e.target.dataset.destino || "capa"; e.target.value = ""; e.target.dataset.destino = ""; elegirImagen(f, destino); }} />
      <input ref={inputFondoRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; elegirImagen(f, "fondo"); }} />
    </div>,
    document.body,
  );
}
