import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Mic2, BookOpen, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Trash2, Check, Send, Eye, EyeOff, Lock, Presentation } from "lucide-react";
import ModoPredicar from "./ModoPredicar.jsx";
import { bosquejoVacio, nuevoPunto, nuevoSubpunto, letraSubpunto, bosquejoListoParaEnviar, bosquejoAItems } from "../lib/bosquejos.js";

// Asistente paso a paso para que el predicador arme su bosquejo (pedido de Eldin, 2026-11-01):
// 1. Título del sermón · 2. Cita base (con la Biblia integrada) · 3. Introducción / idea central ·
// 4. Puntos, cada uno con sus versículos · 5. Revisar y "Enviar a Multimedia".
// Se guarda solo como borrador en cada "Siguiente" y al cerrar, así puede armarlo en varios días.
//
// BibliaSelector es el mismo buscador de la Biblia del Setlist (BibleBrowserBody), recibido por props
// para no duplicarlo: onAdd recibe { ref, version, text, bookId, bookName, chapter, verseStart, verseEnd }.

const PASOS = ["Título", "Cita base", "Idea central", "Puntos", "Revisar"];
const NARANJA = "var(--wf-brand-accent)";
const sombra = "0 3px 14px rgba(22,50,79,0.09)";
const input = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "11px 12px", fontSize: 15, color: "var(--wf-text)", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
const botonPrincipal = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: NARANJA, border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 700, color: "var(--wf-on-brand-accent)", cursor: "pointer", fontFamily: "inherit" };
const botonSecundario = { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "var(--wf-hover)", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 14, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" };
const botonIcono = { background: "transparent", border: "none", color: "var(--wf-muted)", cursor: "pointer", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 };
const etiqueta = { fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5, marginBottom: 6 };

function Pregunta({ children, ayuda }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 21, fontWeight: 600, color: "var(--wf-heading)", lineHeight: 1.25 }}>{children}</div>
      {ayuda && <div style={{ fontSize: 13, color: "var(--wf-muted)", marginTop: 4 }}>{ayuda}</div>}
    </div>
  );
}

function TarjetaVersiculo({ v, onQuitar, compacta = false }) {
  return (
    <div style={{ background: "var(--wf-card)", boxShadow: sombra, borderRadius: 12, padding: compacta ? "8px 10px" : "12px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
      <BookOpen size={14} color="#2F5FA8" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#2F5FA8" }}>{v.ref} <span style={{ fontWeight: 500, color: "var(--wf-muted)" }}>· {v.version}</span></div>
        <div style={{ fontSize: 12.5, color: "var(--wf-text-2)", lineHeight: 1.45, marginTop: 2, ...(compacta ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } : {}) }}>{v.text}</div>
      </div>
      {onQuitar && <button type="button" onClick={onQuitar} style={botonIcono} aria-label={`Quitar ${v.ref}`} title="Quitar"><X size={15} /></button>}
    </div>
  );
}

// soloLectura (2026-11-06): lo abre alguien que no es el predicador (Supervisor, Multimedia, un rol con
// "ver_diapositivas") solo para leer el bosquejo ya enviado — llega siempre junto con bloqueado.
export default function BosquejoWizard({ inicial, tituloBloque, tituloEvento, bloqueado = false, soloLectura = false, onEliminar = null, vivo = null, onGuardar, onEnviar, onClose, BibliaSelector }) {
  const [b, setB] = useState(() => ({ ...bosquejoVacio(), ...(inicial || {}) }));
  // Ya enviado antes → abre directo en "Revisar"; si no, en el primer paso.
  const [paso, setPaso] = useState(() => (inicial?.enviadoAt ? 4 : 0));
  const [estado, setEstado] = useState("guardado"); // guardado · sin-guardar · guardando · error
  const [enviando, setEnviando] = useState(false);
  const [eligiendo, setEligiendo] = useState(null); // null · "cita" · id del punto al que se agrega un versículo
  const [cambiarCita, setCambiarCita] = useState(false);
  // Modo predicar (2026-11-06): seguir el bosquejo en el celular si no hay pantalla de escenario.
  // vivo = { serviceOrder, bloqueId, enVivo, slideAlAire } — para que siga solo a Multimedia.
  const [predicando, setPredicando] = useState(false);
  const ultimoGuardado = useRef(JSON.stringify(b));
  const contenido = useRef(null);

  const cambiar = (patch) => { setB((x) => ({ ...x, ...patch })); setEstado("sin-guardar"); };
  const cambiarPunto = (id, patch) => cambiar({ puntos: b.puntos.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  // Subpuntos (2026-11-06): A, B, C… dentro de cada punto.
  const subsDe = (p) => p.subpuntos || [];
  const cambiarSub = (pid, sid, patch) => cambiar({ puntos: b.puntos.map((p) => (p.id === pid ? { ...p, subpuntos: subsDe(p).map((s) => (s.id === sid ? { ...s, ...patch } : s)) } : p)) });
  const conclusiones = b.conclusiones || [];
  const cambiarConclusion = (k, texto) => cambiar({ conclusiones: conclusiones.map((c, x) => (x === k ? texto : c)) });
  const moverPunto = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= b.puntos.length) return;
    const puntos = [...b.puntos];
    [puntos[i], puntos[j]] = [puntos[j], puntos[i]];
    cambiar({ puntos });
  };

  const guardar = async () => {
    if (bloqueado) return true;
    const ahora = JSON.stringify(b);
    if (ahora === ultimoGuardado.current) { setEstado("guardado"); return true; }
    setEstado("guardando");
    try {
      const guardado = await onGuardar(b);
      ultimoGuardado.current = ahora;
      if (guardado?.updatedAt) setB((x) => ({ ...x, updatedAt: guardado.updatedAt }));
      setEstado("guardado");
      return true;
    } catch {
      setEstado("error");
      return false;
    }
  };

  const irA = async (n) => {
    if (n > paso && paso === 0 && !b.titulo.trim()) return;
    setEligiendo(null); setCambiarCita(false);
    await guardar();
    setPaso(n);
  };
  useEffect(() => { contenido.current?.scrollTo?.({ top: 0 }); }, [paso]);

  const cerrar = async () => { await guardar(); onClose(); };

  const enviar = async () => {
    if (!bosquejoListoParaEnviar(b) || bloqueado) return;
    setEnviando(true);
    try {
      const enviado = await onEnviar(b);
      ultimoGuardado.current = JSON.stringify(b);
      setB((x) => ({ ...x, ...(enviado || {}) }));
      setEstado("guardado");
      onClose({ enviado: true });
    } catch {
      setEstado("error");
    } finally {
      setEnviando(false);
    }
  };

  const textoEstado = bloqueado ? null
    : estado === "guardando" ? "Guardando…"
    : estado === "error" ? "No se pudo guardar. Revisa tu conexión."
    : estado === "sin-guardar" ? "Se guarda al tocar Siguiente"
    : "Borrador guardado ✓";

  const diapositivas = bosquejoAItems(b, "vista", (() => { let n = 0; return () => `v${++n}`; })());

  // ---------- Contenido de cada paso ----------
  let cuerpo;
  if (eligiendo) {
    const esCita = eligiendo === "cita";
    cuerpo = (
      <>
        <button type="button" onClick={() => setEligiendo(null)} style={{ ...botonSecundario, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}><ChevronLeft size={15} /> Volver</button>
        <Pregunta ayuda="Elige libro, capítulo y versículos. El texto queda listo para Multimedia.">{esCita ? "Cita base" : String(eligiendo).startsWith("sub:") ? "Versículo para este subpunto" : "Versículo para este punto"}</Pregunta>
        <BibliaSelector
          submitLabel={esCita ? "Usar esta cita" : "Agregar al punto"}
          onAdd={(v) => {
            const versiculo = { ref: v.ref, version: v.version, text: v.text, bookId: v.bookId, bookName: v.bookName, chapter: v.chapter, verseStart: v.verseStart, verseEnd: v.verseEnd };
            if (esCita) { cambiar({ citaBase: versiculo }); setCambiarCita(false); }
            else if (String(eligiendo).startsWith("sub:")) {
              const [, pid, sid] = String(eligiendo).split(":");
              const sub = subsDe(b.puntos.find((p) => p.id === pid) || {}).find((s) => s.id === sid);
              cambiarSub(pid, sid, { versiculos: [...(sub?.versiculos || []), versiculo] });
            }
            else cambiarPunto(eligiendo, { versiculos: [...(b.puntos.find((p) => p.id === eligiendo)?.versiculos || []), versiculo] });
            setEligiendo(null);
          }}
        />
      </>
    );
  } else if (paso === 0) {
    cuerpo = (
      <>
        <Pregunta ayuda="Es lo primero que se va a proyectar.">¿Cuál es el título del sermón?</Pregunta>
        <input
          autoFocus value={b.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} readOnly={bloqueado}
          onKeyDown={(e) => { if (e.key === "Enter") irA(1); }}
          placeholder="Ej. La gracia que transforma" style={input} maxLength={140}
        />
      </>
    );
  } else if (paso === 1) {
    cuerpo = (
      <>
        <Pregunta ayuda="El pasaje principal del mensaje. Puedes saltar este paso.">¿Cuál es la cita base?</Pregunta>
        {b.citaBase && !cambiarCita ? (
          <>
            <TarjetaVersiculo v={b.citaBase} />
            {!bloqueado && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={() => setEligiendo("cita")} style={{ ...botonSecundario, flex: 1, fontSize: 13 }}>Cambiar</button>
                <button type="button" onClick={() => cambiar({ citaBase: null })} style={{ ...botonSecundario, flex: 1, fontSize: 13, color: "#C23B32" }}>Quitar</button>
              </div>
            )}
          </>
        ) : (
          !bloqueado && <button type="button" onClick={() => setEligiendo("cita")} style={{ ...botonPrincipal, width: "100%" }}><BookOpen size={16} /> Buscar en la Biblia</button>
        )}
      </>
    );
  } else if (paso === 2) {
    cuerpo = (
      <>
        <Pregunta ayuda="Puedes saltar este paso.">Introducción o idea central</Pregunta>
        <textarea
          value={b.ideaCentral} onChange={(e) => cambiar({ ideaCentral: e.target.value })} readOnly={bloqueado}
          placeholder="Ej. Dios nos ama antes de que cambiemos, y su amor es lo que nos cambia."
          rows={6} style={{ ...input, resize: "vertical", lineHeight: 1.5 }}
        />
        <button
          type="button" disabled={bloqueado} onClick={() => cambiar({ mostrarIdea: !b.mostrarIdea })}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", marginTop: 12, background: "var(--wf-card)", boxShadow: sombra, border: "none", borderRadius: 12, padding: "11px 12px", cursor: bloqueado ? "default" : "pointer", textAlign: "left", fontFamily: "inherit" }}
        >
          {b.mostrarIdea ? <Eye size={17} color={NARANJA} /> : <EyeOff size={17} color="var(--wf-faint)" />}
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--wf-text)" }}>Mostrar en pantalla</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)" }}>{b.mostrarIdea ? "Se proyectará después de la cita base." : "Solo la ves tú. No se proyecta."}</span>
          </span>
          <span style={{ width: 38, height: 22, borderRadius: 11, background: b.mostrarIdea ? NARANJA : "var(--wf-border)", position: "relative", flexShrink: 0, transition: "background .15s" }}>
            <span style={{ position: "absolute", top: 3, left: b.mostrarIdea ? 19 : 3, width: 16, height: 16, borderRadius: 8, background: "#fff", transition: "left .15s" }} />
          </span>
        </button>
      </>
    );
  } else if (paso === 3) {
    cuerpo = (
      <>
        <Pregunta ayuda="Escribe cada punto. Si tiene partes (A, B…), toca «+ Subpunto». Al final puedes agregar tus conclusiones.">Los puntos del sermón</Pregunta>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {b.puntos.map((p, i) => (
            <div key={p.id} style={{ background: "var(--wf-card)", boxShadow: sombra, borderRadius: 16, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 12, background: NARANJA, color: "var(--wf-on-brand-accent)", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "var(--wf-muted)" }}>PUNTO {i + 1}</span>
                {!bloqueado && (
                  <>
                    <button type="button" onClick={() => moverPunto(i, -1)} disabled={i === 0} style={{ ...botonIcono, opacity: i === 0 ? 0.3 : 1 }} aria-label="Subir punto" title="Subir"><ChevronUp size={16} /></button>
                    <button type="button" onClick={() => moverPunto(i, 1)} disabled={i === b.puntos.length - 1} style={{ ...botonIcono, opacity: i === b.puntos.length - 1 ? 0.3 : 1 }} aria-label="Bajar punto" title="Bajar"><ChevronDown size={16} /></button>
                    <button type="button" onClick={() => cambiar({ puntos: b.puntos.filter((x) => x.id !== p.id) })} style={{ ...botonIcono, color: "#C23B32" }} aria-label="Quitar punto" title="Quitar punto"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
              <input
                value={p.titulo} onChange={(e) => cambiarPunto(p.id, { titulo: e.target.value })} readOnly={bloqueado}
                placeholder="Ej. Su amor es inmerecido" style={{ ...input, fontWeight: 600 }} maxLength={160}
              />
              <textarea
                value={p.nota} onChange={(e) => cambiarPunto(p.id, { nota: e.target.value })} readOnly={bloqueado}
                placeholder="Lo que vas a explicar en este punto (solo lo ves tú, no se proyecta)"
                rows={2} style={{ ...input, fontSize: 13.5, marginTop: 8, resize: "vertical", lineHeight: 1.45 }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {p.versiculos.map((v, k) => (
                  <TarjetaVersiculo key={`${v.ref}-${k}`} v={v} compacta onQuitar={bloqueado ? null : () => cambiarPunto(p.id, { versiculos: p.versiculos.filter((_, x) => x !== k) })} />
                ))}
              </div>
              {!bloqueado && (
                <button type="button" onClick={() => setEligiendo(p.id)} style={{ ...botonSecundario, width: "100%", marginTop: 8, padding: "9px 12px", fontSize: 13, color: "#2F5FA8" }}>
                  <Plus size={15} /> Versículo
                </button>
              )}
              {/* Subpuntos: cada uno con título, ideas (una por línea) y versículos */}
              {subsDe(p).map((s, k) => (
                <div key={s.id} style={{ marginTop: 10, marginLeft: 6, paddingLeft: 12, borderLeft: `3px solid ${NARANJA}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: NARANJA }}>{letraSubpunto(k)}.</span>
                    <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: "var(--wf-muted)" }}>SUBPUNTO</span>
                    {!bloqueado && <button type="button" onClick={() => cambiarPunto(p.id, { subpuntos: subsDe(p).filter((x) => x.id !== s.id) })} style={{ ...botonIcono, color: "#C23B32" }} aria-label={`Quitar subpunto ${letraSubpunto(k)}`} title="Quitar subpunto"><Trash2 size={14} /></button>}
                  </div>
                  <input
                    value={s.titulo} onChange={(e) => cambiarSub(p.id, s.id, { titulo: e.target.value })} readOnly={bloqueado}
                    aria-label={`Título del subpunto ${letraSubpunto(k)}`} placeholder="Ej. La plenitud de su naturaleza divina" style={{ ...input, fontSize: 14, fontWeight: 600 }} maxLength={160}
                  />
                  <textarea
                    value={s.ideas} onChange={(e) => cambiarSub(p.id, s.id, { ideas: e.target.value })} readOnly={bloqueado}
                    aria-label={`Ideas del subpunto ${letraSubpunto(k)}`} placeholder={"Tus ideas, una por línea (solo las ves tú)\nEj. No es una criatura exaltada"}
                    rows={3} style={{ ...input, fontSize: 13.5, marginTop: 6, resize: "vertical", lineHeight: 1.45 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {(s.versiculos || []).map((v, x) => (
                      <TarjetaVersiculo key={`${v.ref}-${x}`} v={v} compacta onQuitar={bloqueado ? null : () => cambiarSub(p.id, s.id, { versiculos: s.versiculos.filter((_, y) => y !== x) })} />
                    ))}
                  </div>
                  {!bloqueado && (
                    <button type="button" onClick={() => setEligiendo(`sub:${p.id}:${s.id}`)} style={{ ...botonSecundario, width: "100%", marginTop: 6, padding: "8px 12px", fontSize: 12.5, color: "#2F5FA8" }}>
                      <Plus size={14} /> Versículo para {letraSubpunto(k)}
                    </button>
                  )}
                </div>
              ))}
              {!bloqueado && (
                <button type="button" onClick={() => cambiarPunto(p.id, { subpuntos: [...subsDe(p), nuevoSubpunto()] })} style={{ ...botonSecundario, width: "100%", marginTop: 10, padding: "9px 12px", fontSize: 13, background: "transparent", border: "1.5px dashed var(--wf-border)" }}>
                  <Plus size={15} /> Subpunto {letraSubpunto(subsDe(p).length)}
                </button>
              )}
            </div>
          ))}
        </div>
        {!bloqueado && (
          <button type="button" onClick={() => cambiar({ puntos: [...b.puntos, nuevoPunto()] })} style={{ ...botonSecundario, width: "100%", marginTop: 12, border: "1.5px dashed var(--wf-border)", background: "transparent" }}>
            <Plus size={16} /> {b.puntos.length ? "Agregar otro punto" : "Agregar el primer punto"}
          </button>
        )}
        {/* Conclusiones (2026-11-06): cada una se proyecta como su propia diapositiva, al final. */}
        <div style={{ ...etiqueta, marginTop: 22 }}>CONCLUSIONES</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conclusiones.map((c, k) => (
            <div key={k} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ width: 24, height: 24, borderRadius: 12, background: "#16324F", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 10 }}>{k + 1}</span>
              <textarea
                value={c} onChange={(e) => cambiarConclusion(k, e.target.value)} readOnly={bloqueado}
                aria-label={`Conclusión ${k + 1}`} placeholder="Ej. Cristo es plenamente Dios y plenamente hombre." rows={2}
                style={{ ...input, fontSize: 14, resize: "vertical", lineHeight: 1.45 }}
              />
              {!bloqueado && <button type="button" onClick={() => cambiar({ conclusiones: conclusiones.filter((_, x) => x !== k) })} style={{ ...botonIcono, color: "#C23B32", marginTop: 6 }} aria-label={`Quitar conclusión ${k + 1}`} title="Quitar conclusión"><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
        {!bloqueado && (
          <button type="button" onClick={() => cambiar({ conclusiones: [...conclusiones, ""] })} style={{ ...botonSecundario, width: "100%", marginTop: 10, border: "1.5px dashed var(--wf-border)", background: "transparent" }}>
            <Plus size={16} /> {conclusiones.length ? "Agregar otra conclusión" : "Agregar una conclusión"}
          </button>
        )}
      </>
    );
  } else {
    cuerpo = (
      <>
        {b.titulo.trim() && (
          <button type="button" onClick={() => setPredicando(true)} style={{ ...botonPrincipal, width: "100%", marginBottom: 16, background: "#16324F", color: "#fff" }}>
            <Presentation size={16} /> Modo predicar
            <span style={{ fontWeight: 500, fontSize: 12, opacity: 0.8 }}>· síguelo en tu celular</span>
          </button>
        )}
        <Pregunta ayuda={b.enviadoAt ? "Ya lo enviaste. Si cambias algo, vuelve a enviarlo para que Multimedia tenga lo último." : "Revisa que todo esté bien. Toca cualquier parte para corregirla."}>Tu bosquejo</Pregunta>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" onClick={() => irA(0)} style={{ textAlign: "left", background: "var(--wf-card)", boxShadow: sombra, border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={etiqueta}>TÍTULO</div>
            <div style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 18, fontWeight: 600, color: "var(--wf-heading)" }}>{b.titulo || "Sin título"}</div>
          </button>
          <button type="button" onClick={() => irA(1)} style={{ textAlign: "left", background: "var(--wf-card)", boxShadow: sombra, border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={etiqueta}>CITA BASE</div>
            {b.citaBase ? <div style={{ fontSize: 13.5, fontWeight: 700, color: "#2F5FA8" }}>{b.citaBase.ref} <span style={{ fontWeight: 500, color: "var(--wf-muted)" }}>· {b.citaBase.version}</span></div>
              : <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Sin cita base</div>}
          </button>
          <button type="button" onClick={() => irA(2)} style={{ textAlign: "left", background: "var(--wf-card)", boxShadow: sombra, border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ ...etiqueta, display: "flex", alignItems: "center", gap: 6 }}>IDEA CENTRAL {b.ideaCentral.trim() && (b.mostrarIdea ? <Eye size={12} /> : <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>· no se proyecta</span>)}</div>
            <div style={{ fontSize: 13, color: b.ideaCentral.trim() ? "var(--wf-text-2)" : "var(--wf-faint)", whiteSpace: "pre-line", lineHeight: 1.45 }}>{b.ideaCentral.trim() || "Sin idea central"}</div>
          </button>
          <button type="button" onClick={() => irA(3)} style={{ textAlign: "left", background: "var(--wf-card)", boxShadow: sombra, border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            <div style={etiqueta}>PUNTOS</div>
            {b.puntos.filter((p) => p.titulo.trim()).length === 0 ? <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Sin puntos</div> : (
              <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
                {b.puntos.filter((p) => p.titulo.trim()).map((p) => (
                  <li key={p.id} style={{ fontSize: 13.5, color: "var(--wf-text)", fontWeight: 600 }}>
                    {p.titulo}
                    {p.versiculos.length > 0 && <span style={{ fontWeight: 500, color: "#2F5FA8" }}> · {p.versiculos.map((v) => v.ref).join(", ")}</span>}
                    {subsDe(p).filter((s) => (s.titulo || "").trim()).map((s, k) => (
                      <div key={s.id} style={{ fontSize: 12.5, fontWeight: 500, color: "var(--wf-text-2)", marginTop: 2 }}>
                        <b style={{ color: NARANJA }}>{letraSubpunto(k)}.</b> {s.titulo}
                        {(s.versiculos || []).length > 0 && <span style={{ color: "#2F5FA8" }}> · {s.versiculos.map((v) => v.ref).join(", ")}</span>}
                      </div>
                    ))}
                  </li>
                ))}
              </ol>
            )}
            {conclusiones.some((c) => c.trim()) && (
              <>
                <div style={{ ...etiqueta, marginTop: 10, marginBottom: 4 }}>CONCLUSIONES</div>
                <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 }}>
                  {conclusiones.filter((c) => c.trim()).map((c, k) => <li key={k} style={{ fontSize: 13, color: "var(--wf-text-2)" }}>{c}</li>)}
                </ol>
              </>
            )}
          </button>
        </div>
        <div style={{ ...etiqueta, marginTop: 18 }}>ASÍ LO VERÁ MULTIMEDIA · {diapositivas.length} {diapositivas.length === 1 ? "DIAPOSITIVA" : "DIAPOSITIVAS"}</div>
        {/* Mini-previews oscuras, como la proyección real (regla de oro: solo la proyección es oscura). */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
          {diapositivas.map((d) => (
            <div key={d.id} style={{ flexShrink: 0, width: 128, aspectRatio: "16 / 9", background: "#1B2029", borderRadius: 8, padding: 8, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#fff", overflow: "hidden" }}>
              {d.type === "biblia" ? (
                <>
                  <div style={{ fontSize: 7.5, lineHeight: 1.3, opacity: 0.9, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.text}</div>
                  <div style={{ fontSize: 7, fontWeight: 700, color: "#E8821E", marginTop: 3 }}>{d.reference}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.2, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.title}</div>
                  {d.subtitle && <div style={{ fontSize: 7, opacity: 0.7, marginTop: 3 }}>{d.subtitle}</div>}
                </>
              )}
            </div>
          ))}
        </div>
      </>
    );
  }

  // ---------- Barra de abajo ----------
  const puedeSeguir = paso !== 0 || !!b.titulo.trim();
  let barra = null;
  if (!eligiendo) {
    barra = paso < 4 ? (
      <div style={{ display: "flex", gap: 8 }}>
        {paso > 0 && <button type="button" onClick={() => irA(paso - 1)} style={botonSecundario} aria-label="Atrás"><ChevronLeft size={16} /> Atrás</button>}
        {(paso === 1 || paso === 2) && !bloqueado && (
          <button type="button" onClick={() => irA(paso + 1)} style={{ ...botonSecundario, background: "transparent", color: "var(--wf-muted)" }}>Saltar</button>
        )}
        <button type="button" onClick={() => irA(paso + 1)} disabled={!puedeSeguir} style={{ ...botonPrincipal, flex: 1, opacity: puedeSeguir ? 1 : 0.45, cursor: puedeSeguir ? "pointer" : "default" }}>
          Siguiente <ChevronRight size={16} />
        </button>
      </div>
    ) : (
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => irA(3)} style={botonSecundario} aria-label="Atrás"><ChevronLeft size={16} /> Atrás</button>
        {bloqueado ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--wf-muted)", background: "var(--wf-hover)", borderRadius: 12, padding: "10px 12px" }}>
            <Lock size={15} style={{ flexShrink: 0 }} /> {soloLectura ? "Solo para leer. Lo arma y lo envía el predicador." : "El culto ya está en vivo. Si hay que corregir algo, pídeselo a Multimedia."}
          </div>
        ) : (
          <button type="button" onClick={enviar} disabled={enviando || !bosquejoListoParaEnviar(b)} style={{ ...botonPrincipal, flex: 1, opacity: enviando ? 0.6 : 1 }}>
            {enviando ? "Enviando…" : <><Send size={16} /> {b.enviadoAt ? "Volver a enviar a Multimedia" : "Listo, enviar a Multimedia"}</>}
          </button>
        )}
      </div>
    );
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,10,14,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}>
      <div role="dialog" aria-modal="true" aria-label="Bosquejo del sermón" style={{ background: "var(--wf-bg, #F4F6FA)", borderRadius: 20, width: "min(480px, calc(100vw - 16px))", height: "calc(100dvh - 16px)", maxHeight: 760, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        {/* Encabezado */}
        <div style={{ background: "var(--wf-card)", padding: "14px 16px 12px", boxShadow: "0 2px 10px rgba(22,50,79,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(232,130,30,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Mic2 size={16} color={NARANJA} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--wf-text)" }}>Bosquejo del sermón</div>
              <div style={{ fontSize: 11.5, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[tituloBloque, tituloEvento].filter(Boolean).join(" · ")}</div>
            </div>
            {/* Solo llega para el predicador asignado o un administrador (ver puedeEliminarBosquejo). */}
            {b.titulo.trim() && <button type="button" onClick={() => setPredicando(true)} style={botonIcono} aria-label="Modo predicar" title="Modo predicar: síguelo en tu celular"><Presentation size={17} /></button>}
            {onEliminar && <button type="button" onClick={onEliminar} style={{ ...botonIcono, color: "#C23B32" }} aria-label="Eliminar bosquejo" title="Eliminar bosquejo"><Trash2 size={17} /></button>}
            <button type="button" onClick={cerrar} style={botonIcono} aria-label="Cerrar"><X size={18} /></button>
          </div>
          {/* Pasos: tocar uno ya visitado lleva ahí */}
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            {PASOS.map((nombre, i) => (
              <button
                key={nombre} type="button" onClick={() => (b.titulo.trim() || i === 0) && irA(i)} title={nombre} aria-label={`Paso ${i + 1}: ${nombre}`}
                style={{ flex: 1, height: 5, borderRadius: 3, border: "none", padding: 0, cursor: "pointer", background: i <= paso ? NARANJA : "var(--wf-border)" }}
              />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--wf-muted)" }}>
            <span>Paso {paso + 1} de {PASOS.length} · {PASOS[paso]}</span>
            {textoEstado && <span style={{ color: estado === "error" ? "#C23B32" : "var(--wf-muted)", display: "flex", alignItems: "center", gap: 3 }}>{estado === "guardado" && <Check size={11} />}{textoEstado.replace(" ✓", "")}</span>}
          </div>
        </div>
        {bloqueado && !eligiendo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 16px 0", fontSize: 12.5, color: "var(--wf-text-2)", background: "rgba(194,59,50,0.08)", borderRadius: 12, padding: "9px 12px" }}>
            <Lock size={14} color="#C23B32" style={{ flexShrink: 0 }} /> {soloLectura ? "Estás viendo el bosquejo del predicador, solo para leer." : "El culto está en vivo: el bosquejo queda solo para leer."}
          </div>
        )}
        <div ref={contenido} style={{ flex: 1, overflowY: "auto", padding: "18px 16px" }}>{cuerpo}</div>
        {barra && <div style={{ padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", background: "var(--wf-card)", boxShadow: "0 -2px 10px rgba(22,50,79,0.06)" }}>{barra}</div>}
      </div>
      {predicando && (
        <ModoPredicar bosquejo={b} serviceOrder={vivo?.serviceOrder || []} bloqueId={vivo?.bloqueId} enVivo={!!vivo?.enVivo}
          slideAlAire={vivo?.slideAlAire || null} onClose={() => setPredicando(false)} />
      )}
    </div>,
    document.body
  );
}
