// Eventos: calendario y lista, detalle del evento y su Setlist (bloques, encargados, equipo de alabanza, bosquejo). Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { Pencil, Check, Mic2, ChevronRight, Sparkles, FolderOpen, ExternalLink, ListMusic, Plus, Radio, MapPin, Users, Calendar, Music, ArrowLeft, Trash2, Bell, X, Settings, Eye, EyeOff, Download, Play, GraduationCap, Star, MoreHorizontal, BookOpen, Type, PenTool, FileUp, Search, ArrowUpDown, GripVertical, ChevronUp, ChevronDown, Paperclip, Copy, Timer } from "lucide-react";
import { bosquejoTieneCambiosSinEnviar, esBloquePredicacion } from "../lib/bosquejos.js";
import { useState, useMemo, useEffect, useRef } from "react";
import { todayLocal, monthKey, monthLabelFromKey, parseIsoDateLocal, isUpcoming, compareByDay, MONTH_ABBR, formatFullDate } from "../lib/dates.js";
import { acordeEn, getNotacion } from "../lib/preferencias.js";
import { useArrastreLista } from "../lib/arrastreLista.js";
import { buscarCanciones } from "../lib/busqueda.js";
import { showToast } from "../lib/toast.js";
import { anclaDeBloque } from "../lib/ordenCulto.js";
import { esGrupoDiapositivas, diapositivasDeItem } from "../lib/diapositivas.js";
import { esPaginaPresentacion } from "../lib/importarPresentacion.js";
import DiapositivaDisenada from "../components/DiapositivaDisenada.jsx";
import { createPortal } from "react-dom";
import ImportarPresentacion from "../components/ImportarPresentacion.jsx";
import CuentaRegresivaModal from "../components/CuentaRegresivaModal.jsx";
import { SelectEstilo } from "../components/EditorAnimacionCancion.jsx";
import { ANIMACIONES } from "../components/LetrasAnimadas.jsx";
import RelojCuentaRegresiva, { estiloCuenta } from "../components/RelojCuentaRegresiva.jsx";
import { esCuentaRegresiva, normalizarCuenta } from "../lib/cuentaRegresiva.js";
import { NOTES, normalizarTitulo, lideraBloque, isWorshipBlock, primaryBtn, ghostToggleBtn, iconGhost, ModalShell, Field, inputStyle, DEFAULT_COVERS, misAsignacionesEnEvento, quienDirigeAlabanza, miniBtnStyle, addBtnStyle, textoEnsayo, clasificacionesActuales, TYPE_META, ElegirParteDelCulto } from "./compartido.jsx";
import { BibleModal } from "./biblia.jsx";
import { SlideModal } from "./ventanas.jsx";

// Tonalidades para cambiar una canción dentro del Setlist: solo las 12 notas. Si la canción original
// es menor, las 12 salen en menor (Em pasa a Fm, nunca a F), así nunca se cambia sin querer de
// menor a mayor ni al revés.
function opcionesTonalidadSetlist(keyOriginal) {
  const menor = (keyOriginal || "").endsWith("m");
  return NOTES.map((n) => (menor ? `${n}m` : n));
}

// Un bloque "pertenece" a Multimedia por el mismo criterio (título) que isWorshipBlock usa para
// Alabanza — ver serviceOrderVisiblePara: Alabanza y Multimedia son el único par que se ve entre sí,
// cualquier otro bloque organizativo (Limpieza, Ofrendas, Adolescentes, Escuelita Infantil, Lectura
// inicial, Predicación...) restringe a su(s) encargado(s) a ver SOLO ese bloque.
function isMultimediaBlock(item) {
  return item.type === "seccion" && normalizarTitulo(item.title).includes("multimedia");
}

// Única fuente de verdad para la visibilidad del Setlist por grupo — la usan tanto SetlistPane (para
// decidir qué panel mostrar) como el resumen en PDF (para no filtrar aparte y arriesgar que se
// desincronicen). Nada de esto aplica a un administrador, que siempre ve todo:
// - Alabanza y Multimedia se ven entre sí (el equipo de alabanza completo + el bloque de Multimedia)
//   y nada más del Setlist.
// - Cualquier OTRO bloque organizativo (Limpieza, Ofrendas, Adolescentes, Escuelita Infantil, Lectura
//   inicial, Predicación, etc.) restringe a su(s) encargado(s) a ver SOLO ese bloque — ni siquiera
//   Alabanza/Multimedia, ni el resto de bloques.
function decidirVisibilidadSetlist(event, isAdminViewer, userId, esSupervisor, gruposQueLidero = null) {
  // Supervisor ve TODO, sin excepción — a diferencia de los demás roles, tener además una asignación
  // propia (ej. un bloque puntual) no lo restringe a ver solo eso. Es el único rol, aparte de
  // Administrador, que nunca queda encerrado en "bloque-propio" ni "filtrado".
  if (isAdminViewer || esSupervisor) return { modo: "todo" };
  // También cuentan como propios los bloques vinculados a un grupo (ministerio) que esta persona
  // lidera (pedido de Eldin, 2026-10-30): el líder de Limpieza ve — y edita, ver puedeEditarBloque —
  // el bloque de Limpieza en cada evento aunque no figure como encargado.
  const misBloquesPropios = event.serviceOrder.filter((it) => it.type === "seccion" && (
    (it.encargados || []).some((m) => m.usuarioId === userId) || lideraBloque(it, gruposQueLidero)
  ));
  const misOtrosBloques = misBloquesPropios.filter((it) => !isMultimediaBlock(it));
  // OJO: esto se chequea ANTES de "bloque-propio" — alguien puede ser AMBAS cosas a la vez (ej. toca
  // guitarra en Alabanza Y además es el encargado puntual de la Escuelita Dominical), y en ese caso
  // tiene que ver la unión de las dos cosas, no quedar encerrado en una a costa de la otra. Antes
  // "bloque-propio" se evaluaba primero y ganaba SIEMPRE que hubiera algún bloque propio, así que
  // alguien de Alabanza con un bloque organizativo de más se quedaba viendo SOLO ese bloque — sin
  // canciones, sin nada de lo que de verdad necesitaba para tocar (bug real: 2026-09, Pavel).
  const soyDeAlabanzaOMultimedia = esMiembroAlabanza(event, userId) || misBloquesPropios.some(isMultimediaBlock) || misBloquesPropios.some(isWorshipBlock);
  if (soyDeAlabanzaOMultimedia) {
    // Ven el Setlist COMPLETO (canciones, versículos, slides — lo que de verdad necesitan para tocar
    // o proyectar) + su propio bloque de Multimedia/Alabanza + cualquier otro bloque organizativo del
    // que además sean encargados puntuales (ej. la Escuelita) — nada más de bloques organizativos
    // AJENOS (Limpieza, Ofrendas, Predicación, etc., que son los únicos que sí se ocultan).
    const propiosIds = new Set(misOtrosBloques.map((it) => it.id));
    return { modo: "filtrado", visibleOrder: event.serviceOrder.filter((it) => it.type !== "seccion" || isMultimediaBlock(it) || isWorshipBlock(it) || propiosIds.has(it.id)) };
  }
  if (misOtrosBloques.length > 0) return { modo: "bloque-propio", blocks: misOtrosBloques };
  return { modo: "todo" };
}

// Ítems del Setlist que un usuario puede ver, aplicando decidirVisibilidadSetlist — se usa en el
// resumen en PDF, que de otro modo mostraría el Setlist completo a cualquiera sin pasar por SetlistPane.
function serviceOrderVisiblePara(event, isAdminViewer, userId, esSupervisor, gruposQueLidero = null) {
  const decision = decidirVisibilidadSetlist(event, isAdminViewer, userId, esSupervisor, gruposQueLidero);
  if (decision.modo === "bloque-propio") return decision.blocks;
  if (decision.modo === "filtrado") return decision.visibleOrder;
  return event.serviceOrder;
}

// "Del equipo de Alabanza" = aparece como integrante de algún rol del equipo de alabanza en ESTE
// evento (event.worshipRoles, ej. Guitarra, Batería) — no tiene que ver con el rol de dispositivo.
function esMiembroAlabanza(event, uid) {
  return (event.worshipRoles || []).some((r) => (r.members || []).some((m) => m.usuarioId === uid));
}

// Vista reducida para quien solo tiene un privilegio de grupo restringido en este evento (Limpieza,
// Ventas, Adolescentes, Ofrendas o Multimedia): ni el Setlist completo, ni la biblioteca de canciones,
// ni botones de agregar — solo su(s) propio(s) bloque(s), de solo lectura (encargados incluidos), tal
// como se ve el resto de bloques cuando no se pueden editar. Multimedia además ve el equipo de
// Alabanza completo (worshipRoles), que necesita para proyectar.
// Botón del predicador en su bloque de Predicación: "Agregar bosquejo" la primera vez; después muestra
// el título y si ya está enviado a Multimedia (ver BosquejoWizard y lib/bosquejos.js).
function EtiquetaBosquejoListo({ cambios = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "3px 9px", background: cambios ? "rgba(232,130,30,0.14)" : "rgba(31,138,115,0.14)", color: cambios ? "var(--wf-brand-accent)" : "#1F8A73" }}>
      {cambios ? <Pencil size={11} /> : <Check size={11} />} {cambios ? "Cambios sin enviar" : "Bosquejo listo"}
    </span>
  );
}

function BotonBosquejo({ bosquejo, onAbrir, grande = false }) {
  const tiene = !!(bosquejo && bosquejo.titulo);
  if (!tiene) {
    return (
      <button onClick={onAbrir} className="hoverable" style={{ ...primaryBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: grande ? "13px" : "10px", fontSize: grande ? 14 : 13, marginBottom: grande ? 16 : 0 }}>
        <Mic2 size={grande ? 17 : 15} /> Agregar bosquejo
      </button>
    );
  }
  const enviado = !!bosquejo.enviadoAt;
  return (
    <button onClick={onAbrir} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 14, padding: "10px 12px", cursor: "pointer", marginBottom: grande ? 16 : 0, fontFamily: "inherit" }}>
      <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(232,130,30,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Mic2 size={15} color="var(--wf-brand-accent)" /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bosquejo.titulo}</div>
        <div style={{ marginTop: 3 }}>
          {enviado ? <EtiquetaBosquejoListo cambios={bosquejoTieneCambiosSinEnviar(bosquejo)} />
            : <span style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>Borrador · toca para seguir</span>}
        </div>
      </div>
      <ChevronRight size={16} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
    </button>
  );
}

function RestrictedGroupPanel({ blocks, worshipRoles, ministries, event, bosquejoInfo = null }) {
  return (
    <div style={{ flex: 1, padding: 20, display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 14 }}>
        {blocks.map((block) => {
          // Si este bloque está vinculado a un ministerio, ya se ve TODA su planificación y recursos
          // acá mismo, desplegados de una — a diferencia del Setlist completo (que arranca colapsado y
          // hay que tocarlo), quien solo tiene este panel restringido no tiene ningún otro lugar donde
          // ir a buscarlo, así que no tiene sentido esconderlo detrás de un toque.
          const linkedMinistry = block.ministryId ? ministries.find((m) => m.id === block.ministryId) : null;
          const currentPlan = linkedMinistry && event.date ? linkedMinistry.plan.find((p) => p.date === event.date) : null;
          const eventMonth = event.date ? event.date.slice(0, 7) : null;
          const resourcesForEventMonth = linkedMinistry ? linkedMinistry.resources.filter((r) => r.month === eventMonth) : [];
          return (
          <div key={block.id} style={{ background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 18, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--wf-muted)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 10 }}><Sparkles size={13} color="#5661B3" /> TU PRIVILEGIO EN ESTE EVENTO</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>{block.title}</div>
            {block.description && <div style={{ fontSize: 13, color: "var(--wf-text-2)", marginBottom: 16 }}>{block.description}</div>}
            {bosquejoInfo?.puede(block) && <BotonBosquejo bosquejo={bosquejoInfo.bosquejos[block.id]} onAbrir={() => bosquejoInfo.abrir(block.id)} grande />}
            {linkedMinistry && currentPlan?.detail && (
              <div style={{ background: "var(--wf-hover)", borderRadius: 12, padding: "10px 12px", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4 }}>PLANIFICACIÓN DE ESTA SEMANA</div>
                <div style={{ fontSize: 12.5, color: "var(--wf-text-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{currentPlan.detail}</div>
              </div>
            )}
            {linkedMinistry && resourcesForEventMonth.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>RECURSOS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {resourcesForEventMonth.map((r) => (
                    <a key={r.id} href={r.link || undefined} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-hover)", borderRadius: 12, padding: "8px 10px", textDecoration: "none", color: "var(--wf-text)", fontSize: 12, fontWeight: 600 }}>
                      <FolderOpen size={13} color="var(--wf-faint)" />
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                      {r.link && <ExternalLink size={12} color="#2F5FA8" style={{ flexShrink: 0 }} />}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 8 }}>EQUIPO ASIGNADO</div>
            {(block.encargados || []).length === 0 ? (
              <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>Nadie asignado todavía.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {block.encargados.map((m, i) => (
                  <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{m.n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                    <span style={{ fontSize: 13 }}>{m.n}{m.lead && <span style={{ fontSize: 10, color: "var(--wf-brand-accent)", fontWeight: 700 }}> · Encargado</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })}
        {worshipRoles.map((role) => (
          <div key={role.id} style={{ background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 18, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--wf-muted)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 10 }}><Sparkles size={13} color="var(--wf-brand-accent)" /> EQUIPO DE ALABANZA</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, marginBottom: 10 }}>{role.name}</div>
            {(role.members || []).length === 0 ? (
              <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>Nadie asignado todavía.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {role.members.map((m, i) => (
                  <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{m.n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
                    <span style={{ fontSize: 13 }}>{m.n}{m.lead && <span style={{ fontSize: 10, color: "var(--wf-brand-accent)", fontWeight: 700 }}> · Encargado</span>}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EventList({ events, plantillas, isAdminViewer, liveEventId, liveLibre, onSelect, onCreate, canStartLive, onStartFree, library, myUserId }) {
  const [viewMode, setViewMode] = useState("eventos"); // eventos | plantillas (solo administradores alternan)
  const [step, setStep] = useState(null); // null | 'template' | 'details'
  const [templateId, setTemplateId] = useState("blank");
  const [form, setForm] = useState({ title: "", dateLabel: "", date: "", hora: "", location: "" });
  const [monthFilter, setMonthFilter] = useState("proximos"); // 'proximos' | mes (para revisar eventos pasados)

  const isPlantillaMode = isAdminViewer && viewMode === "plantillas";
  // Crear una plantilla no pasa por "seleccionar plantilla" (sería plantilla-de-plantilla) — va directo
  // al formulario de detalles, y se guarda con esPlantilla: true.
  const openCreate = () => {
    setTemplateId("blank");
    setForm({ title: "", dateLabel: "", date: "", hora: "", location: "" });
    setStep(isPlantillaMode ? "details" : "template");
  };
  const confirmTemplate = () => setStep("details");
  // Tocar una plantilla en la lista NO debe abrirla como si fuera un evento ya decidido, ni pasar por
  // un formulario/modal intermedio — clona la plantilla de una vez como evento real (autoguardado,
  // igual que cualquier otro cambio en esta app) y navega directo a su pantalla completa: Setlist ya
  // cargado y editable ahí mismo, título/fecha/hora editables en Ajustes sin ventanas emergentes.
  // Editar el contenido propio de la plantilla (su Setlist base) sigue siendo el lápiz aparte en cada fila.
  const aplicarPlantilla = (pl) => {
    onCreate({ templateId: pl.id, title: pl.title, dateLabel: "", date: null, hora: null, location: pl.location || "Por definir", esPlantilla: false });
  };
  const confirmCreate = () => {
    if (!form.title.trim() || (!isPlantillaMode && !form.date)) return;
    onCreate({ templateId: templateId === "blank" ? null : templateId, title: form.title, dateLabel: form.dateLabel || "", date: form.date || null, hora: form.hora || null, location: form.location || "Por definir", esPlantilla: isPlantillaMode });
    setStep(null);
  };

  const today = todayLocal();
  // Ventana fija de ±6 meses alrededor de hoy, para poder planear meses futuros aunque todavía no
  // tengan eventos — más cualquier mes que sí tenga eventos reales aunque caiga fuera de la ventana.
  const monthOptions = useMemo(() => {
    const map = new Map();
    for (let offset = -6; offset <= 6; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1);
      const key = monthKey(d.getFullYear(), d.getMonth());
      map.set(key, monthLabelFromKey(key));
    }
    events.forEach((ev) => {
      const d = parseIsoDateLocal(ev.date);
      if (!d) return;
      const key = monthKey(d.getFullYear(), d.getMonth());
      if (!map.has(key)) map.set(key, monthLabelFromKey(key));
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) => a.value.localeCompare(b.value));
  }, [events, today]);

  const isProximos = monthFilter === "proximos";
  const visibleEvents = useMemo(() => {
    const list = isProximos
      ? events.filter(isUpcoming)
      : events.filter((ev) => {
          const d = parseIsoDateLocal(ev.date);
          return d && monthKey(d.getFullYear(), d.getMonth()) === monthFilter;
        });
    return list.slice().sort(compareByDay);
  }, [events, monthFilter, isProximos]);

  const hero = isProximos ? visibleEvents[0] : null;
  const rest = isProximos ? visibleEvents.slice(1) : visibleEvents;
  const heroDate = hero ? parseIsoDateLocal(hero.date) : null;

  if (isPlantillaMode) {
    return (
      <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 12 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>Plantillas</h2>
          <button onClick={() => setViewMode("eventos")} style={ghostToggleBtn}>← Ver eventos</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 16 }}>Arma aquí bloques ya establecidos (orden del culto) que cualquier administrador podrá usar como base al crear un evento nuevo.</div>
        {plantillas.length === 0 && <div style={{ textAlign: "center", color: "var(--wf-faint)", fontSize: 13, padding: "40px 0" }}>Todavía no hay plantillas — crea la primera con el botón +.</div>}
        {plantillas.map((pl) => (
          <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 20, padding: 10, marginBottom: 10 }}>
            <button onClick={() => aplicarPlantilla(pl)} className="hoverable" title="Crear un evento con esta base" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", borderRadius: 14, padding: 4, cursor: "pointer" }}>
              <div style={{ width: 34, height: 34, borderRadius: 14, background: "var(--wf-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><ListMusic size={16} color="#5661B3" /></div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pl.title}</div>
                <div style={{ fontSize: 11, color: "var(--wf-faint)" }}>{pl.serviceOrder.length} elementos · toca para crear un evento</div>
              </div>
            </button>
            <button onClick={() => onSelect(pl.id)} className="hoverable" title="Editar el contenido de la plantilla" style={{ ...iconGhost, flexShrink: 0 }}>
              <Pencil size={15} color="#5661B3" />
            </button>
          </div>
        ))}
        <button onClick={openCreate} style={{ position: "fixed", right: 20, bottom: 92, width: 54, height: 54, borderRadius: "50%", background: "#5661B3", border: "none", boxShadow: "0 8px 18px rgba(86,97,179,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 41 }}>
          <Plus size={24} color="#fff" />
        </button>
        {step === "details" && (
          <ModalShell title="Nueva plantilla" icon={ListMusic} color="#5661B3" onClose={() => setStep(null)}>
            <Field label="Nombre de la plantilla" required><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Domingo AM — estructura estándar" style={inputStyle} autoFocus /></Field>
            <button onClick={confirmCreate} disabled={!form.title.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: form.title.trim() ? 1 : 0.4 }}>Crear plantilla</button>
          </ModalShell>
        )}
      </div>
    );
  }

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>Eventos</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isAdminViewer && <button data-tour="eventos-plantillas" onClick={() => setViewMode("plantillas")} style={ghostToggleBtn}>Plantillas</button>}
          <select
            data-tour="eventos-filtro"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{ fontSize: 12, fontWeight: 700, padding: "8px 10px", borderRadius: 12, border: "1px solid var(--wf-divider)", background: "var(--wf-hover)", color: "var(--wf-heading)", cursor: "pointer" }}
          >
            <option value="proximos">Próximos</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {canStartLive && (
        <button data-tour="eventos-libre" onClick={onStartFree} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: liveLibre ? "var(--wf-active-bg)" : "var(--wf-card)", border: liveLibre ? "1px solid var(--wf-brand-accent)" : "none", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 18, padding: "12px 14px", marginBottom: 16, cursor: "pointer", textAlign: "left" }}>
          <div style={{ width: 34, height: 34, borderRadius: 14, background: liveLibre ? "var(--wf-brand-accent)" : "var(--wf-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Radio size={16} color={liveLibre ? "#fff" : "#C23B32"} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{liveLibre ? "Transmisión libre en vivo" : "Transmitir sin evento"}</div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)" }}>{liveLibre ? 'Toca "En vivo" abajo para controlarla' : "Para anuncios, oración u otro contenido suelto sin un evento planificado"}</div>
          </div>
        </button>
      )}

      {hero && (
        <div data-tour="eventos-primero" style={{ position: "relative", marginBottom: 26 }}>
          <div style={{ position: "absolute", inset: "12px -8px 0 8px", background: "var(--wf-card)", borderRadius: 22, transform: "rotate(-3deg)", boxShadow: "0 4px 10px rgba(22,50,79,0.05)" }} />
          <div style={{ position: "absolute", inset: "6px -4px 0 4px", background: "var(--wf-card)", borderRadius: 22, transform: "rotate(2deg)", boxShadow: "0 4px 10px rgba(22,50,79,0.07)" }} />
          <button onClick={() => onSelect(hero.id)} className="hoverable" style={{ position: "relative", width: "100%", textAlign: "left", border: "none", cursor: "pointer", borderRadius: 22, padding: 0, overflow: "hidden", display: "block", boxShadow: "0 12px 26px rgba(22,50,79,0.2)" }}>
            <div style={{ background: hero.cover || DEFAULT_COVERS[0], padding: 20, minHeight: 130, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.92)", borderRadius: 14, padding: "3px 9px", textAlign: "center", minWidth: 38 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "var(--wf-heading)", lineHeight: 1.1 }}>{heroDate ? heroDate.getDate() : "–"}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--wf-brand-accent)" }}>{heroDate ? MONTH_ABBR[heroDate.getMonth()] : ""}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: "rgba(255,255,255,0.85)" }}>PRÓXIMO EVENTO</span>
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 600, color: "#fff" }}>{hero.title}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>{hero.location}</div>
              {(() => {
                const misCargos = misAsignacionesEnEvento(hero, myUserId, library);
                return misCargos.length > 0 ? (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 8, background: "rgba(255,255,255,0.18)", borderRadius: 12, padding: "4px 8px", display: "inline-block" }}>
                    Te toca: {misCargos.join(", ")}
                  </div>
                ) : null;
              })()}
            </div>
          </button>
        </div>
      )}

      {rest.length > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 10 }}>
          {isProximos ? "MÁS ADELANTE" : `${monthOptions.find((m) => m.value === monthFilter)?.label.toUpperCase()} · ${rest.length} EVENTOS`}
        </div>
      )}
      {rest.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--wf-faint)", fontSize: 13, padding: "40px 0" }}>
          {isProximos ? "No hay eventos próximos." : "No hay eventos en este mes."}
        </div>
      )}
      {rest.map((ev) => {
        const totalMembers = ev.serviceOrder.reduce((acc, item) => acc + (item.encargados?.length || 0), 0);
        const isLive = ev.id === liveEventId;
        const isPast = !isProximos && !isUpcoming(ev);
        const d = parseIsoDateLocal(ev.date);
        const misCargos = misAsignacionesEnEvento(ev, myUserId, library);
        return (
          <button key={ev.id} onClick={() => onSelect(ev.id)} className="hoverable" style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left", background: "var(--wf-card)", border: isLive ? "2px solid #C23B32" : "none", boxShadow: "0 3px 14px rgba(22,50,79,0.08)", borderRadius: 20, padding: 14, marginBottom: 10, cursor: "pointer", opacity: isPast ? 0.7 : 1 }}>
            <div style={{ width: 48, height: 48, borderRadius: 18, background: "var(--wf-hover)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--wf-heading)", lineHeight: 1.1 }}>{d ? d.getDate() : "–"}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#2F5FA8" }}>{d ? MONTH_ABBR[d.getMonth()] : ""}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.title}</div>
                {isLive && <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#B5342C", flexShrink: 0 }}><span className="live-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#C23B32" }} /> EN VIVO</span>}
                {isPast && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--wf-faint)", flexShrink: 0 }}>PASADO</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--wf-muted)", fontSize: 12 }}>
                <MapPin size={11} /> {ev.location}
                <span style={{ marginLeft: 8, display: "flex", alignItems: "center", gap: 4 }}><Users size={11} /> {totalMembers}</span>
              </div>
              {misCargos.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-brand-accent)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  Te toca: {misCargos.join(", ")}
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Botón flotante circular para crear evento — solo administradores */}
      {isAdminViewer && (
        <button data-tour="eventos-nuevo" onClick={openCreate} style={{ position: "fixed", right: 20, bottom: 92, width: 54, height: 54, borderRadius: "50%", background: "var(--wf-brand-accent)", border: "none", boxShadow: "0 8px 18px rgba(232,130,30,0.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", zIndex: 41 }}>
          <Plus size={24} color="var(--wf-brand-primary)" />
        </button>
      )}

      {step === "template" && (
        <ModalShell title="Selecciona plantilla" icon={ListMusic} color="#5661B3" onClose={() => setStep(null)}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 12 }}>Copia el orden del culto de una plantilla ya armada por un administrador, o empieza en blanco.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            {plantillas.length === 0 && <div style={{ fontSize: 12, color: "var(--wf-faint)", fontStyle: "italic", marginBottom: 4 }}>Todavía no hay plantillas creadas.</div>}
            {plantillas.map((pl) => (
              <label key={pl.id} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: templateId === pl.id ? "1px solid #5661B3" : "1px solid var(--wf-divider)", cursor: "pointer" }}>
                <input type="radio" name="template" checked={templateId === pl.id} onChange={() => setTemplateId(pl.id)} />
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{pl.title}</div><div style={{ fontSize: 11, color: "var(--wf-faint)" }}>{pl.serviceOrder.length} elementos en el setlist</div></div>
              </label>
            ))}
            <label className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: templateId === "blank" ? "1px solid #5661B3" : "1px solid var(--wf-divider)", cursor: "pointer" }}>
              <input type="radio" name="template" checked={templateId === "blank"} onChange={() => setTemplateId("blank")} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--wf-text-2)" }}>Evento en blanco</div>
            </label>
          </div>
          <button onClick={confirmTemplate} style={primaryBtn}>Continuar</button>
        </ModalShell>
      )}

      {step === "details" && (
        <ModalShell title="Detalles del evento" icon={Calendar} color="var(--wf-brand-accent)" onClose={() => setStep(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Título" required><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Domingo AM – 19 Jul" style={inputStyle} /></Field>
            <Field label="Fecha del calendario" required>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} style={inputStyle} />
              <span style={{ display: "block", fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>Es la fecha real del evento — de aquí sale su lugar en Inicio y en el filtro de mes, y también trae sola la planificación de Ministerios de esa semana.</span>
            </Field>
            <Field label="Hora o nota (opcional)"><input value={form.dateLabel} onChange={(e) => setForm({ ...form, dateLabel: e.target.value })} placeholder="Ej. 10:00 am" style={inputStyle} /></Field>
            <Field label="Hora exacta (opcional)">
              <input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} style={inputStyle} />
              <span style={{ display: "block", fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>Solo se usa para calcular recordatorios "por horas" — no reemplaza la nota de arriba.</span>
            </Field>
            <Field label="Ubicación"><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Ej. Pastores, Sacatepéquez" style={inputStyle} /></Field>
          </div>
          <button onClick={confirmCreate} disabled={!form.title.trim() || !form.date} style={{ ...primaryBtn, marginTop: 14, opacity: form.title.trim() && form.date ? 1 : 0.4, cursor: form.title.trim() && form.date ? "pointer" : "not-allowed" }}>Crear evento</button>
        </ModalShell>
      )}
    </div>
  );
}

function EnsayoAlabanzaCard({ event, userId, isAdminViewer, onGuardar }) {
  const enEquipo = (event.worshipRoles || []).some((r) => (r.members || []).some((m) => m.usuarioId === userId));
  const lider = quienDirigeAlabanza(event);
  const puedeEditar = isAdminViewer || (lider && lider.usuarioId === userId);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState({ ensayoFecha: "", ensayoHora: "", notaAlabanza: "" });
  const [guardando, setGuardando] = useState(false);
  if (!enEquipo && !puedeEditar) return null;
  if (!(event.worshipRoles || []).length && !isAdminViewer) return null;
  const tieneAlgo = !!(event.ensayoFecha || event.ensayoHora || (event.notaAlabanza || "").trim());
  if (!tieneAlgo && !puedeEditar) return null;
  const abrir = () => {
    setBorrador({ ensayoFecha: event.ensayoFecha || "", ensayoHora: (event.ensayoHora || "").slice(0, 5), notaAlabanza: event.notaAlabanza || "" });
    setEditando(true);
  };
  const guardar = async () => {
    setGuardando(true);
    try { await onGuardar(borrador); setEditando(false); } catch { /* el aviso de error ya se mostró */ } finally { setGuardando(false); }
  };
  return (
    <div style={{ background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 16, padding: 14, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: editando || tieneAlgo ? 10 : 0 }}>
        <Music size={16} color="#1F8A73" />
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>Ensayo de alabanza</span>
        {puedeEditar && !editando && (
          <button onClick={abrir} className="hoverable" style={miniBtnStyle}>{tieneAlgo ? <><Pencil size={12} /> Editar</> : <><Plus size={12} /> Agregar</>}</button>
        )}
      </div>
      {editando ? (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="Día del ensayo">
                <input type="date" value={borrador.ensayoFecha} onChange={(e) => setBorrador({ ...borrador, ensayoFecha: e.target.value })} style={inputStyle} />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="Hora">
                <input type="time" value={borrador.ensayoHora} onChange={(e) => setBorrador({ ...borrador, ensayoHora: e.target.value })} style={inputStyle} />
              </Field>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="Nota para el equipo (opcional)">
              <textarea value={borrador.notaAlabanza} onChange={(e) => setBorrador({ ...borrador, notaAlabanza: e.target.value })} rows={3} placeholder="Ej. Lleguen 15 minutos antes. Repasen el coro de Alabaré en Re." style={{ ...inputStyle, resize: "vertical", minHeight: 70 }} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => setEditando(false)} className="hoverable" style={{ ...addBtnStyle, flex: 1, justifyContent: "center", marginBottom: 0 }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ ...primaryBtn, flex: 1, marginTop: 0 }}>{guardando ? "Guardando…" : "Guardar"}</button>
          </div>
        </>
      ) : tieneAlgo ? (
        <>
          {textoEnsayo(event) && <div style={{ fontSize: 14, fontWeight: 600, color: "var(--wf-text)" }}>{textoEnsayo(event)}</div>}
          {(event.notaAlabanza || "").trim() && (
            <div style={{ marginTop: 8, background: "var(--wf-hover)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 13, color: "var(--wf-text-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{event.notaAlabanza}</div>
              {lider && <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginTop: 6 }}>— {lider.n}</div>}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--wf-faint)", marginTop: 6 }}>Pon la hora del ensayo y una nota; el equipo la verá en su pantalla de Inicio.</div>
      )}
    </div>
  );
}

// ---------------- DETALLE DE EVENTO ----------------
export function EventDetail({
  myIglesiaId, onAbrirEditor, onDisenarNueva,
  event, library, ministries, isCompact, isLive, canStartLive, isAdminViewer, puedeEditarSetlist, userId, usuariosReales, onBack, onStart, onPracticar, onGoLive, onDelete,
  isDraftFromTemplate, onPublish,
  onAddSong, onAddSeccion, onAddBibleClick, onAddSlideClick, onAddItems, onAddCuenta = null, destinoAgregar, onDestinoAgregar, onEditarItem, onRemove, onRestaurar, onDuplicate, onReorder,
  onLinkMinistry, onUpdateSeccionText, onSetSongKey, canAddBibleReading, canAddSermonPoints, bosquejoInfo = null,
  onAddEncargado, onSetEncargadoStatus, onSetEncargadoLead, onRemoveEncargado,
  onAddWorshipRole, onRemoveWorshipRole, onAddWorshipRoleMember, onSetWorshipRoleMemberStatus, onSetWorshipRoleMemberLead, onRemoveWorshipRoleMember,
  onViewMinistry, onOpenSong, onAddReminder, onRemoveReminder, onSetHora, onUpdateEventDetails, onMarkVisto, onSetEnsayo,
  showBibleForm, setShowBibleForm, addBible, showSlideForm, setShowSlideForm, slideDraft, setSlideDraft, addSlide,
  showSermonForm, setShowSermonForm, sermonPointText, setSermonPointText, addSermonPoint,
}) {
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDraft, setReminderDraft] = useState({ cantidad: 1, unidad: "dias" });
  const confirmAddReminder = () => {
    onAddReminder(Math.max(1, Number(reminderDraft.cantidad) || 1), reminderDraft.unidad);
    setReminderDraft({ cantidad: 1, unidad: "dias" });
    setShowReminderForm(false);
  };
  // Editar título/fecha/hora/ubicación DESPUÉS de creado — antes solo se fijaban una vez al crear el
  // evento/la plantilla y no había forma de corregirlos. Pantalla completa "Ajustes del evento"
  // (separada del Setlist), guarda en vivo campo por campo — mismo patrón que ya usa el título de
  // cada bloque del Setlist (onChange directo, sin botón "Guardar" ni validación bloqueante).
  const [showEventSettings, setShowEventSettings] = useState(false);
  const patchEvent = (patch) => onUpdateEventDetails({ title: event.title, dateLabel: event.dateLabel || "", date: event.date || null, hora: event.hora || null, location: event.location || "", ...patch });

  // "Ya vi mis asignaciones de este evento" — a propósito NO se marca solo con abrir el evento (eso
  // marcaba a alguien como "visto" aunque hubiera entrado por otra razón y nunca se hubiera fijado en
  // qué le tocaba a ella). Se marca cuando la persona misma toca el aviso "Te toca: ..." de abajo — un
  // gesto que sí implica que se fijó en su propio cargo. Distinto de "confirmado/pendiente/rechazado"
  // (eso lo cambia el admin a mano); esto lo dispara la propia persona, y es lo que le deja al admin ver
  // quién de verdad se enteró de lo que le toca.
  const misCargos = misAsignacionesEnEvento(event, userId, library);
  const yaVistoPorMi = (event.vistas || []).some((v) => v.usuarioId === userId);
  // Usa la misma función que el aviso emergente (confirmarAsignacionVista, pasada como onMarkVisto) en
  // vez de su propia copia — esa copia anterior guardaba en la base pero NUNCA actualizaba el estado
  // compartido `events`, así que ni esta misma persona en otra pestaña ni el admin viéndolo se enteraban
  // hasta que algo más disparara una recarga completa. Ahora ambos caminos quedan sincronizados.
  const marcarMisAsignacionesVistas = () => {
    if (yaVistoPorMi) return;
    onMarkVisto(event.id);
  };

  if (showEventSettings) {
    return (
      <div className="screen-enter" style={{ width: "100%", flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ padding: 20, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => setShowEventSettings(false)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "4px 6px 4px 0", borderRadius: 12 }}>
              <ArrowLeft size={18} color="var(--wf-text)" />
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 19, fontWeight: 600, color: "var(--wf-text)" }}>Ajustes del evento</span>
            </button>
            {isAdminViewer && (
              <button onClick={() => onDelete(event)} title="Eliminar evento" style={iconGhost}>
                <Trash2 size={16} color="#C23B32" />
              </button>
            )}
          </div>

          <Field label={event.esPlantilla ? "Nombre de la plantilla" : "Nombre del evento"}>
            <input value={event.title} onChange={(e) => patchEvent({ title: e.target.value })} style={inputStyle} />
          </Field>

          {!event.esPlantilla && (
            <>
              <div style={{ marginTop: 14 }}>
                <Field label="Ubicación del evento">
                  <input value={event.location || ""} onChange={(e) => patchEvent({ location: e.target.value })} placeholder="Ej. Pastores, Sacatepéquez" style={inputStyle} />
                </Field>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
                <div style={{ flex: 1 }}>
                  <Field label="Fecha">
                    <input type="date" value={event.date || ""} onChange={(e) => patchEvent({ date: e.target.value || null })} style={inputStyle} />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Hora">
                    <input type="time" value={event.hora || ""} onChange={(e) => patchEvent({ hora: e.target.value || null })} style={inputStyle} />
                  </Field>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <Field label="Hora o nota (opcional)">
                  <input value={event.dateLabel || ""} onChange={(e) => patchEvent({ dateLabel: e.target.value })} placeholder="Ej. 10:00 am" style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {isAdminViewer && (
            <div style={{ marginTop: 22, background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 16, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><Bell size={14} color="var(--wf-brand-accent)" /> Recordatorios</div>
                <button onClick={() => setShowReminderForm(true)} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: event.esPlantilla ? 0 : 10 }}>
                {(event.reminders || []).length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12 }}>Sin recordatorios configurados{event.esPlantilla ? " en esta plantilla" : ""}.</div>}
                {(event.reminders || []).map((r) => (
                  <span key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 12, fontWeight: 600 }}>
                    {r.cantidad} {r.unidad === "horas" ? (r.cantidad === 1 ? "hora" : "horas") : (r.cantidad === 1 ? "día" : "días")} antes
                    <button onClick={() => onRemoveReminder(r.id)} style={{ ...iconGhost, width: 18, height: 18 }}><X size={11} /></button>
                  </span>
                ))}
              </div>
              {!event.esPlantilla && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)" }}>HORA DEL EVENTO</span>
                    <input type="time" value={event.hora || ""} onChange={(e) => onSetHora(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12 }} />
                  </div>
                  {!event.hora && <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Sin hora definida, los recordatorios "por horas" no se pueden calcular con precisión.</div>}
                </>
              )}
            </div>
          )}
        </div>

        {showReminderForm && (
          <ModalShell title="Agregar recordatorio" icon={Bell} color="var(--wf-brand-accent)" onClose={() => setShowReminderForm(false)}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <Field label="Cantidad">
                <input type="number" min={1} value={reminderDraft.cantidad} onChange={(e) => setReminderDraft({ ...reminderDraft, cantidad: e.target.value })} style={inputStyle} />
              </Field>
              <Field label="Unidad">
                <select value={reminderDraft.unidad} onChange={(e) => setReminderDraft({ ...reminderDraft, unidad: e.target.value })} style={inputStyle}>
                  <option value="dias">Días antes</option>
                  <option value="horas">Horas antes</option>
                </select>
              </Field>
            </div>
            {reminderDraft.unidad === "horas" && !event.hora && (
              <div style={{ fontSize: 11, color: "#C23B32", marginTop: 8 }}>Este evento todavía no tiene hora definida — este recordatorio no se enviará hasta que se le asigne una.</div>
            )}
            <button onClick={confirmAddReminder} style={{ ...primaryBtn, marginTop: 14 }}>Agregar recordatorio</button>
          </ModalShell>
        )}
      </div>
    );
  }

  return (
    <div className="screen-enter" style={{ width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "20px 20px 0", maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
          {isAdminViewer && (
            <div style={{ display: "flex", gap: 8 }}>
              <button data-tour="evento-ajustes" onClick={() => setShowEventSettings(true)} title={event.esPlantilla ? "Ajustes de la plantilla" : "Ajustes del evento"} style={iconGhost}>
                <Settings size={16} color="var(--wf-heading)" />
              </button>
              <button onClick={() => onDelete(event)} title="Eliminar evento" style={iconGhost}>
                <Trash2 size={16} color="#C23B32" />
              </button>
            </div>
          )}
        </div>
        <div style={{ borderRadius: 16, background: "linear-gradient(135deg, #2A3B4D, var(--wf-hover))", padding: 20, marginBottom: 16 }}>
          <div style={{ display: "inline-block", background: event.esPlantilla ? "#5661B3" : "rgba(0,0,0,0.35)", borderRadius: 20, padding: "4px 12px", fontSize: 12, marginBottom: 10 }}>
            {event.esPlantilla ? "PLANTILLA" : (formatFullDate(event.date) || "Sin fecha") + (event.dateLabel ? ` · ${event.dateLabel}` : "")}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>{event.title}</div>
          {!event.esPlantilla && <div style={{ fontSize: 13, color: "#C8CDD6" }}>{event.location}</div>}
        </div>

        {/* Solo para quien tiene algo asignado en este evento — tocarlo (no basta con solo abrir el
            evento) es lo que le avisa al admin que la persona de verdad se fijó en su propio cargo, no
            solo que entró por curiosidad o por otra razón. Ver marcarMisAsignacionesVistas arriba.
            Antes decía solo "Te toca: X" sin más — para gente que recién está aprendiendo a usar una
            app, eso no se lee como "hay que tocar esto", parece solo un letrero informativo. Ahora,
            mientras no lo haya tocado, el texto GRANDE es una instrucción directa ("Toca aquí..."), con
            el detalle de qué le toca como texto más chico debajo — y una flecha, como cualquier botón
            de "siguiente" que ya conocen de otras pantallas. Una vez tocado, cambia a una confirmación
            clara en vez de repetir la misma instrucción. */}
        {misCargos.length > 0 && (
          <button
            data-tour="evento-mi-cargo"
            onClick={marcarMisAsignacionesVistas}
            className="hoverable"
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: yaVistoPorMi ? "#EAF6F1" : "var(--wf-active-bg)", border: `1.5px solid ${yaVistoPorMi ? "#1F8A73" : "var(--wf-brand-accent)"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 16, cursor: "pointer" }}
          >
            {yaVistoPorMi ? <Eye size={20} color="#1F8A73" style={{ flexShrink: 0 }} /> : <EyeOff size={20} color="var(--wf-active-text)" style={{ flexShrink: 0 }} />}
            <span style={{ flex: 1, minWidth: 0 }}>
              {yaVistoPorMi ? (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1F8A73" }}>Ya viste tu participación ✓</div>
                  <div style={{ fontSize: 12, color: "var(--wf-text-2)", marginTop: 2 }}>Te toca: {misCargos.join(", ")}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--wf-active-text)" }}>Toca aquí para ver tu participación</div>
                  <div style={{ fontSize: 12, color: "var(--wf-active-text)", marginTop: 2 }}>Te toca: {misCargos.join(", ")}</div>
                </>
              )}
            </span>
            {!yaVistoPorMi && <ChevronRight size={18} color="var(--wf-brand-accent)" style={{ flexShrink: 0 }} />}
          </button>
        )}

        {!event.esPlantilla && onSetEnsayo && (
          <EnsayoAlabanzaCard event={event} userId={userId} isAdminViewer={isAdminViewer} onGuardar={onSetEnsayo} />
        )}

        <button data-tour="evento-pdf" onClick={() => window.print()} className="hoverable" style={{ ...addBtnStyle, marginBottom: 16, justifyContent: "center" }}>
          <Download size={14} color="var(--wf-heading)" /> Exportar Setlist a PDF
        </button>

        {/* Oculta en pantalla (ver .print-only en index.css) — solo aparece al imprimir/"Guardar como
            PDF", como respaldo en papel del Setlist si algún día falla la app o el internet en pleno culto. */}
        <div className="print-only" style={{ padding: 28, fontFamily: "'Poppins', sans-serif", color: "#111" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 2 }}>{event.title}</div>
          <div style={{ fontSize: 12, color: "#444", marginBottom: 20 }}>
            {(formatFullDate(event.date) || event.dateLabel || "")}{event.hora ? ` · ${event.hora}` : ""}
          </div>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {serviceOrderVisiblePara(event, isAdminViewer || puedeEditarSetlist, userId, usuariosReales.find((u) => u.id === userId)?.rol === "supervisor", new Set((ministries || []).filter((m) => m.leaderId === userId).map((m) => m.id))).map((item) => {
              if (item.type === "seccion") {
                const names = isWorshipBlock(item)
                  ? (event.worshipRoles || []).flatMap((r) => r.members.map((m) => `${m.n} (${r.name})`)).join(", ")
                  : (item.encargados || []).map((m) => m.n).join(", ");
                return (
                  <li key={item.id} style={{ marginBottom: 10, fontSize: 14 }}>
                    <strong>{item.title}</strong>{item.description ? ` — ${item.description}` : ""}
                    {names && <div style={{ fontSize: 12, color: "#444" }}>Encargado(s): {names}</div>}
                  </li>
                );
              }
              if (item.type === "cancion") {
                const song = library.find((s) => s.id === item.songId);
                return (
                  <li key={item.id} style={{ marginBottom: 6, fontSize: 14 }}>
                    {song ? `${song.title} — ${acordeEn(item.keyOverride || song.key)}, ${song.tempo} bpm` : "Canción"}
                  </li>
                );
              }
              if (item.type === "biblia") {
                return <li key={item.id} style={{ marginBottom: 6, fontSize: 14 }}>{item.reference} ({item.version})</li>;
              }
              return <li key={item.id} style={{ marginBottom: 6, fontSize: 14 }}>{item.title || "Slide"}{item.subtitle ? ` — ${item.subtitle}` : ""}</li>;
            })}
          </ol>
        </div>

        {event.esPlantilla ? (
          <div style={{ fontSize: 12, color: "var(--wf-faint)", marginBottom: 14 }}>Esta es una plantilla — no se transmite en vivo, solo sirve como base para nuevos eventos ("Selecciona plantilla" al crear uno).</div>
        ) : canStartLive ? (
          <>
            <button data-tour="evento-iniciar" onClick={isLive ? onGoLive : onStart} style={{ ...primaryBtn, width: "100%", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: isLive ? "#C23B32" : "var(--wf-brand-accent)", color: isLive ? "#fff" : "var(--wf-text)" }}>
              <Play size={15} /> {isLive ? "Ya en vivo · Ir al control" : "Iniciar evento"}
            </button>
            {/* Practicar: la consola con este culto, sin proyectar nada (ver empezarPractica). Solo en
                computadora, que es donde se usa la consola. */}
            {!isLive && !isCompact && onPracticar && (
              <button data-tour="evento-practicar" onClick={onPracticar} className="hoverable" title="Abre la consola con este culto para aprender a usarla. Nada sale en la pantalla de la iglesia."
                style={{ width: "100%", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13.5, fontWeight: 700, padding: "10px 14px", borderRadius: 14, border: "1.5px solid #1F8A73", background: "transparent", color: "#1F8A73", cursor: "pointer", fontFamily: "inherit" }}>
                <GraduationCap size={16} /> Practicar sin proyectar
              </button>
            )}
            <div style={{ marginBottom: 20 }} />
          </>
        ) : (
          isLive && <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--wf-brand-accent)", marginBottom: 14 }}><span className="live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--wf-brand-accent)" }} /> Este evento está en vivo ahora mismo.</div>
        )}
      </div>
      {isDraftFromTemplate && isAdminViewer && (
        <div style={{ padding: "0 20px", maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box", flexShrink: 0 }}>
          <button onClick={onPublish} className="hoverable" style={{ ...primaryBtn, width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#1F8A73", color: "#fff" }}>
            <Check size={15} /> Publicar evento
          </button>
        </div>
      )}
      <SetlistPane
        onAbrirEditor={onAbrirEditor}
        onDisenarNueva={onDisenarNueva}
        myIglesiaId={myIglesiaId}
        event={event} library={library} ministries={ministries} isCompact={isCompact} isAdminViewer={isAdminViewer || puedeEditarSetlist} userId={userId} usuariosReales={usuariosReales}
        onAddSong={onAddSong} onAddSeccion={onAddSeccion}
        onAddBibleClick={onAddBibleClick} onAddSlideClick={onAddSlideClick} onAddItems={onAddItems} onAddCuenta={onAddCuenta}
        destinoAgregar={destinoAgregar} onDestinoAgregar={onDestinoAgregar} onEditarItem={onEditarItem}
        onRemove={onRemove} onRestaurar={onRestaurar} onDuplicate={onDuplicate} onReorder={onReorder}
        onLinkMinistry={onLinkMinistry} onUpdateSeccionText={onUpdateSeccionText}
        onSetSongKey={onSetSongKey}
        canAddBibleReading={canAddBibleReading} canAddSermonPoints={canAddSermonPoints} bosquejoInfo={bosquejoInfo}
        onAddEncargado={onAddEncargado} onSetEncargadoStatus={onSetEncargadoStatus} onSetEncargadoLead={onSetEncargadoLead} onRemoveEncargado={onRemoveEncargado}
        onAddWorshipRole={onAddWorshipRole} onRemoveWorshipRole={onRemoveWorshipRole} onAddWorshipRoleMember={onAddWorshipRoleMember} onSetWorshipRoleMemberStatus={onSetWorshipRoleMemberStatus} onSetWorshipRoleMemberLead={onSetWorshipRoleMemberLead} onRemoveWorshipRoleMember={onRemoveWorshipRoleMember}
        onViewMinistry={onViewMinistry} onOpenSong={onOpenSong}
        showBibleForm={showBibleForm} setShowBibleForm={setShowBibleForm} addBible={addBible}
        showSlideForm={showSlideForm} setShowSlideForm={setShowSlideForm} slideDraft={slideDraft} setSlideDraft={setSlideDraft} addSlide={addSlide}
        showSermonForm={showSermonForm} setShowSermonForm={setShowSermonForm} sermonPointText={sermonPointText} setSermonPointText={setSermonPointText} addSermonPoint={addSermonPoint}
      />
    </div>
  );
}

const NEXT_STATUS = { pendiente: "confirmado", confirmado: "rechazado", rechazado: "pendiente" };

const STATUS_STYLE = {
  confirmado: { border: "none", background: "#3FA772", icon: Check },
  rechazado: { border: "none", background: "#C23B32", icon: X },
  pendiente: { border: "1px solid var(--wf-border-soft)", background: "transparent", icon: null },
};

// Encargados de un ítem del Setlist: chips con estado (pendiente/confirmado/rechazado), estrella de
// "encargado principal" y selector para agregar de entre los usuarios ya registrados en la app (no
// texto libre). Solo quien tiene permiso sobre este bloque (admin, o el líder del ministerio vinculado)
// puede editar la lista — para los demás se muestra de solo lectura.
function EncargadosList({ encargados, canEdit, allUsuarios, onSetStatus, onSetLead, onAddEncargado, onRemove, vistasPorUsuario, showVistas }) {
  // Id seleccionado en el desplegable de "agregar persona" — se vuelve a "" apenas se agrega a alguien,
  // así el desplegable queda listo para la siguiente persona en vez de quedarse mostrando a la última.
  const [seleccionId, setSeleccionId] = useState("");
  const disponibles = allUsuarios.filter((u) => !encargados.some((m) => m.usuarioId === u.id));
  return (
    <div>
      {encargados.map((m, i) => {
        const style = STATUS_STYLE[m.status || "pendiente"];
        const StatusIcon = style.icon;
        const vistoAt = m.usuarioId && vistasPorUsuario ? vistasPorUsuario.get(m.usuarioId) : null;
        return (
          <div key={m.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--wf-divider)" }}>
            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#3A4B6E", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0, color: "#fff" }}>{m.n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</div>
            <span style={{ fontSize: 13, flex: 1 }}>{m.n}{m.lead && <span style={{ fontSize: 10, color: "var(--wf-brand-accent)", fontWeight: 700 }}> · Encargado</span>}</span>
            {/* Solo visible para administradores — le dice si la persona siquiera abrió el evento a ver
                qué le toca, algo que "confirmado/pendiente" no puede responder porque ESE estado lo
                cambia el admin a mano, no la persona misma. A propósito NO depende de "canEdit": el
                admin necesita poder chequear esto viendo el Setlist normal, sin tener que entrar al
                modo "Editar" primero solo para consultarlo. */}
            {showVistas && vistasPorUsuario && m.usuarioId && (
              vistoAt
                ? <Eye size={14} color="#1F8A73" title={`Vio sus asignaciones el ${new Date(vistoAt).toLocaleString("es")}`} />
                : <EyeOff size={14} color="var(--wf-border-soft)" title="Todavía no ha abierto el evento para ver qué le toca" />
            )}
            {canEdit && (
              <button onClick={() => onSetLead(i)} title={m.lead ? "Quitar como encargado principal" : "Marcar como encargado principal"} style={{ ...iconGhost, color: m.lead ? "var(--wf-brand-accent)" : "var(--wf-border-soft)" }}>
                <Star size={14} fill={m.lead ? "var(--wf-brand-accent)" : "none"} />
              </button>
            )}
            {canEdit ? (
              <button onClick={() => onSetStatus(i, NEXT_STATUS[m.status || "pendiente"])} title={m.status === "rechazado" ? "No puede asistir — click para cambiar" : undefined} style={{ width: 22, height: 22, borderRadius: "50%", border: style.border, background: style.background, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {StatusIcon && <StatusIcon size={13} color="#fff" />}
              </button>
            ) : (
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: style.border, background: style.background, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {StatusIcon && <StatusIcon size={13} color="#fff" />}
              </div>
            )}
            {canEdit && <button onClick={() => onRemove(i)} title="Quitar" style={{ ...iconGhost, color: "#C23B32" }}><X size={13} /></button>}
          </div>
        );
      })}
      {encargados.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12, padding: "6px 0" }}>Nadie asignado todavía.</div>}
      {/* Tocar el nombre agrega a esa persona de una vez — sin un segundo botón "Añadir" aparte, que
          antes se prestaba a elegir a alguien del selector y no darle a añadir, dejando la impresión
          de que la asignación "no se guardó". */}
      {canEdit && (
        <div style={{ marginTop: 10 }}>
          <select
            value={seleccionId}
            onChange={(e) => {
              const u = disponibles.find((x) => x.id === e.target.value);
              if (u) onAddEncargado(u);
              setSeleccionId("");
            }}
            disabled={disponibles.length === 0}
            style={{ ...inputStyle, color: seleccionId ? "var(--wf-text)" : "var(--wf-faint)", cursor: disponibles.length ? "pointer" : "default" }}
          >
            <option value="" disabled>{disponibles.length === 0 ? "No hay más personas disponibles para agregar" : "+ Agregar persona…"}</option>
            {disponibles.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// Equipo de alabanza: roles con nombre fijo (Guitarra, Batería, Voz...) en vez de una lista libre de
// encargados — el mismo roster se muestra y se edita igual desde el bloque de Alabanza que desde el de
// Adoración (es un solo array compartido a nivel de evento, no una copia por bloque).
function WorshipRolesEditor({ roles, canEdit, allUsuarios, onAddRole, onRemoveRole, onAddMember, onSetStatus, onSetLead, onRemoveMember, vistasPorUsuario, showVistas }) {
  const [newRoleName, setNewRoleName] = useState("");
  return (
    <div>
      {roles.map((r) => (
        <div key={r.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--wf-divider)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text-2)" }}>{r.name}</span>
            {canEdit && <button onClick={() => onRemoveRole(r.id)} title="Quitar rol" style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={13} /></button>}
          </div>
          <EncargadosList
            encargados={r.members}
            canEdit={canEdit}
            allUsuarios={allUsuarios}
            onAddEncargado={(usuario) => onAddMember(r.id, usuario)}
            onSetStatus={(mi, status) => onSetStatus(r.id, mi, status)}
            onSetLead={(mi) => onSetLead(r.id, mi)}
            onRemove={(mi) => onRemoveMember(r.id, mi)}
            vistasPorUsuario={vistasPorUsuario}
            showVistas={showVistas}
          />
        </div>
      ))}
      {roles.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12, marginBottom: 10 }}>Aún no hay roles definidos para el equipo de alabanza.</div>}
      {canEdit && (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            placeholder="Nuevo rol (ej. Guitarra)"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter" && newRoleName.trim()) { onAddRole(newRoleName); setNewRoleName(""); } }}
          />
          <button
            onClick={() => { if (newRoleName.trim()) { onAddRole(newRoleName); setNewRoleName(""); } }}
            style={{ ...addBtnStyle, width: "auto", padding: "0 12px", color: "#5661B3" }}
          >
            <Plus size={14} color="#5661B3" /> Agregar rol
          </button>
        </div>
      )}
    </div>
  );
}

// Botón "Encargados": ícono de personas con una insignia del conteo actual — es el punto de entrada
// para agregar/gestionar a los encargados de este ítem del Setlist, sin necesitar una pantalla aparte.
function EncargadosToggleButton({ count, onClick }) {
  return (
    <button onClick={onClick} title="Encargados" style={{ ...iconGhost, position: "relative" }}>
      <Users size={14} color={count > 0 ? "var(--wf-brand-accent)" : undefined} />
      {count > 0 && (
        <span style={{ position: "absolute", top: -2, right: -2, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", fontSize: 8, fontWeight: 800, borderRadius: 12, minWidth: 12, height: 12, lineHeight: "12px", textAlign: "center", padding: "0 2px" }}>{count}</span>
      )}
    </button>
  );
}

// ---------------- SETLIST (orden del culto) ----------------
function SetlistPane({ onAbrirEditor, onDisenarNueva, myIglesiaId, event, library, ministries, isCompact, isAdminViewer, userId, usuariosReales, onAddSong, onAddSeccion, onAddBibleClick, onAddSlideClick, onAddItems, onAddCuenta = null, destinoAgregar = null, onDestinoAgregar, onEditarItem, onRemove, onRestaurar, onDuplicate, onReorder, onLinkMinistry, onUpdateSeccionText, onViewMinistry, onOpenSong, onSetSongKey, canAddBibleReading, canAddSermonPoints, bosquejoInfo = null, onAddEncargado, onSetEncargadoStatus, onSetEncargadoLead, onRemoveEncargado, onAddWorshipRole, onRemoveWorshipRole, onAddWorshipRoleMember, onSetWorshipRoleMemberStatus, onSetWorshipRoleMemberLead, onRemoveWorshipRoleMember, showBibleForm, setShowBibleForm, addBible, showSlideForm, setShowSlideForm, slideDraft, setSlideDraft, addSlide, showSermonForm, setShowSermonForm, sermonPointText, setSermonPointText, addSermonPoint }) {
  const [showImportar, setShowImportar] = useState(false); // Importar presentación (ver ImportarPresentacion)
  // Editar el Setlist (estructura, encargados, equipo de alabanza) es solo de administradores — la
  // única excepción a "solo admin" en todo el Setlist es agregar un versículo, que puede hacerlo además
  // el encargado de ese bloque de Lectura bíblica/Oración (ver canAddBibleReading más arriba).
  // Además de eso, el Setlist se ve de solo lectura (sin agregar/quitar/mover nada) hasta tocar "Editar"
  // — UN SOLO candado para todo (antes Encargados/equipo de alabanza tenían su propio candado por
  // bloque además de este, y era fácil elegir a alguien del selector sin haber destrabado ESE candado
  // aparte, o creer que ya había quedado asignado sin haber tocado "Añadir" — de ahí que pareciera que
  // las asignaciones "se perdían"). Los cambios se siguen guardando solos apenas se hacen; "Guardar"
  // solo regresa a la vista de solo lectura.
  // Sin candado "Editar" (2026-10-10, para que sea fácil de usar): quien puede editar edita directo,
  // y si se equivoca al quitar algo aparece "Deshacer" (ver quitarConDeshacer).
  const canEditNow = isAdminViewer;
  // Líder de un grupo (2026-10-30): además del administrador, quien lidera el grupo vinculado a un
  // bloque puede editar ESE bloque — título, descripción y encargados. Nada más del Setlist (no
  // mueve, no borra, no agrega ni toca canciones u otros bloques).
  const gruposQueLidero = useMemo(() => new Set(ministries.filter((m) => m.leaderId === userId).map((m) => m.id)), [ministries, userId]);
  const canEditItem = (item) => canEditNow || lideraBloque(item, gruposQueLidero);
  const [showAgregar, setShowAgregar] = useState(false); // hoja "+ Agregar" con todas las opciones
  const [pickerCancion, setPickerCancion] = useState(false);
  // Orden en que se van eligiendo canciones en "Agregar canciones" (pedido de Eldin, 2026-10-21: "que al
  // elegir una aparezca entre paréntesis un número uno y si son dos dos"). Se reinicia al abrirlo.
  const [elegidasPicker, setElegidasPicker] = useState([]);
  useEffect(() => { if (pickerCancion) setElegidasPicker([]); }, [pickerCancion]);
  const numerosElegida = (id) => elegidasPicker.reduce((acc, x, i) => (x === id ? [...acc, i + 1] : acc), []);
  const [menuItem, setMenuItem] = useState(null); // { id, x, y } — menú "⋯" de un elemento
  // "Empieza aquí" se puede ocultar por evento (por si esta iglesia no usa el equipo de alabanza, etc.).
  const claveOcultarPasos = `worshipflow_pasos_ocultos_${event.id}`;
  const [pasosOcultos, setPasosOcultos] = useState(() => { try { return localStorage.getItem(claveOcultarPasos) === "1"; } catch { return false; } });
  const ocultarPasos = () => { setPasosOcultos(true); try { localStorage.setItem(claveOcultarPasos, "1"); } catch { /* sin almacenamiento */ } };
  useEffect(() => {
    if (!menuItem) return;
    const cerrar = () => setMenuItem(null);
    window.addEventListener("pointerdown", cerrar);
    window.addEventListener("scroll", cerrar, true);
    return () => { window.removeEventListener("pointerdown", cerrar); window.removeEventListener("scroll", cerrar, true); };
  }, [menuItem]);
  // usuarioId -> cuándo vio sus asignaciones de ESTE evento (ver marcarAsignacionVista) — se le pasa a
  // cada EncargadosList (bloques, equipo de alabanza) para el ícono de ojo junto a cada persona.
  const vistasPorUsuario = useMemo(() => new Map((event.vistas || []).map((v) => [v.usuarioId, v.vistoAt])), [event.vistas]);
  // La fila de una canción en el buscador se queda ahí, tocable de nuevo, después de agregarla (no
  // desaparece ni se deshabilita) — sin este freno, un doble toque rápido (dedo apurado, sin feedback
  // inmediato de que ya se agregó) la duplicaba o triplicaba en el Setlist. Medio segundo alcanza para
  // frenar un toque accidental sin bloquear a alguien que de verdad quiera repetir la misma canción más
  // adelante en el Setlist (ej. un coro que se canta dos veces).
  const lastAddSongRef = useRef({ id: null, at: 0 });
  const handleAddSong = (songId) => {
    const now = Date.now();
    if (lastAddSongRef.current.id === songId && now - lastAddSongRef.current.at < 600) return false;
    lastAddSongRef.current = { id: songId, at: now };
    onAddSong(songId);
    return true;
  };
  const [query, setQuery] = useState("");
  // Igual que en Canciones: poder ver solo los coros (para armar una cadena de coros seguidos), o solo
  // los himnos disponibles, etc., en vez de buscar a ojo en toda la biblioteca mezclada.
  const [libraryCategoryFilter, setLibraryCategoryFilter] = useState("todos");
  const [expandedSections, setExpandedSections] = useState({});
  const [showSeccionForm, setShowSeccionForm] = useState(false);
  // Editar una diapositiva de texto con el mismo formulario con que se creó (sin el editor de diseño).
  const [editTexto, setEditTexto] = useState(null); // { id, draft }
  // Cuenta regresiva (2026-11-05): null | { item } (editar) | {} (nueva).
  const [cuentaModal, setCuentaModal] = useState(null);
  // Otro estilo de letra animada para una canción solo en este evento (2026-11-06): { id, valor } | null.
  const [animEvento, setAnimEvento] = useState(null);
  const abrirEditarTexto = (it) => setEditTexto({ id: it.id, draft: { title: it.title || "", subtitle: it.subtitle || "", name: it.name || "", escalaSubtitulo: it.escalaSubtitulo, bg: it.bg || "#1B2029", bgType: it.bgType || "color", videoUrl: it.videoUrl || "", imageUrl: it.imageUrl || "" } });
  // La parte del culto elegida en "+ Agregar" solo vale mientras se está agregando: al cerrarse todo
  // (o cancelar), vuelve a "al final" para que lo siguiente no caiga en un bloque viejo.
  const agregando = showAgregar || pickerCancion || showImportar || showBibleForm || showSlideForm || showSermonForm || !!cuentaModal;
  useEffect(() => { if (!agregando && destinoAgregar) onDestinoAgregar?.(null); }, [agregando, destinoAgregar, onDestinoAgregar]);
  const [seccionDraft, setSeccionDraft] = useState({ title: "", description: "" });
  const confirmAddSeccion = () => {
    if (!seccionDraft.title.trim()) return;
    onAddSeccion(seccionDraft.title, seccionDraft.description);
    setSeccionDraft({ title: "", description: "" });
    setShowSeccionForm(false);
  };
  // Reordenar estilo OnStage: se agarra el elemento desde cualquier parte (con el dedo, manteniéndolo
  // presionado un instante; con mouse, presionando y moviendo) y los demás se apartan para mostrar
  // dónde va a caer — ver useArrastreLista. Un bloque desplegado no se mueve hasta que se cierre.
  // Modo "Ordenar" (pedido de Eldin, 2026-10-21): fuera de este modo el Setlist no se arrastra, para que
  // nada se mueva por accidente al leer o hacer scroll. Dentro, la lista se ve compacta (todas las filas
  // del mismo alto, también las diapositivas que el celular esconde) con flechas y "Mover a…".
  const [ordenando, setOrdenando] = useState(false);
  useEffect(() => { setOrdenando(false); }, [event.id]);
  const arrastre = useArrastreLista({
    habilitado: canEditNow && ordenando,
    puedeArrastrar: (idx) => {
      const it = event.serviceOrder[idx];
      return !(it?.type === "seccion" && expandedSections[it.id]);
    },
    onReorder,
  });
  // Visibilidad del Setlist por grupo — ver decidirVisibilidadSetlist. Va DESPUÉS de todos los hooks
  // de arriba: un return anticipado antes de un useState rompe las reglas de hooks en cuanto ese mismo
  // componente vuelva a renderizar sin la restricción activa.
  const visibilidadSetlist = decidirVisibilidadSetlist(event, isAdminViewer, userId, usuariosReales.find((u) => u.id === userId)?.rol === "supervisor", gruposQueLidero);
  // Si entre sus bloques hay alguno de un grupo que lidera, se usa la vista normal del Setlist (solo con
  // sus bloques) en vez del panel de solo lectura, para que pueda editarlos.
  const lideraAlgunoDeSusBloques = visibilidadSetlist.modo === "bloque-propio" && visibilidadSetlist.blocks.some((b) => lideraBloque(b, gruposQueLidero));
  if (visibilidadSetlist.modo === "bloque-propio" && !lideraAlgunoDeSusBloques) {
    return <RestrictedGroupPanel blocks={visibilidadSetlist.blocks} worshipRoles={[]} ministries={ministries} event={event} bosquejoInfo={bosquejoInfo} />;
  }
  // Alabanza/Multimedia: NO es un panel simplificado — ven el Setlist normal de siempre (canciones,
  // letra, versículos, slides), solo que sin los bloques organizativos de otros grupos (ver
  // visibleServiceOrder más abajo, usado en vez de event.serviceOrder en el render principal).
  const visibleServiceOrder = visibilidadSetlist.modo === "filtrado" ? visibilidadSetlist.visibleOrder
    : visibilidadSetlist.modo === "bloque-propio" ? visibilidadSetlist.blocks : event.serviceOrder;
  const filtered = buscarCanciones(library.filter((s) => libraryCategoryFilter === "todos" || s.category === libraryCategoryFilter), query);
  // ---- Fácil de usar (2026-10-10): "+ Agregar", menú "⋯" y "Empieza aquí" ----
  const puedeAgregarAlgo = isAdminViewer || canAddBibleReading || canAddSermonPoints;
  const nombreDeItem = (it) => (it.type === "cancion" ? library.find((x) => x.id === it.songId)?.title || "Canción"
    : it.type === "biblia" ? it.reference || "Versículo" : it.title || (it.type === "seccion" ? "Bloque" : "Diapositiva"));
  const quitarConDeshacer = (it) => {
    const indice = event.serviceOrder.findIndex((x) => x.id === it.id);
    onRemove(it.id);
    showToast(`Se quitó "${nombreDeItem(it)}".`, "info", onRestaurar ? { label: "Deshacer", onClick: () => onRestaurar(it, indice) } : null);
  };
  const moverItem = (it, paso) => {
    const desde = event.serviceOrder.findIndex((x) => x.id === it.id);
    const hacia = desde + paso;
    if (desde === -1 || hacia < 0 || hacia >= event.serviceOrder.length) return;
    onReorder(desde, hacia);
  };
  const abrirMenuItem = (e, it) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setMenuItem({ id: it.id, x: Math.min(r.right - 210, window.innerWidth - 220), y: Math.min(r.bottom + 4, window.innerHeight - 260) });
  };
  const botonMenu = (it) => (
    <button onClick={(e) => abrirMenuItem(e, it)} onPointerDown={(e) => e.stopPropagation()} title="Más opciones" aria-label={`Opciones de ${nombreDeItem(it)}`} style={{ ...iconGhost, width: 32, height: 32, borderRadius: 10, border: "1px solid var(--wf-border)", flexShrink: 0 }}><MoreHorizontal size={16} /></button>
  );
  const cancionesEvento = event.serviceOrder.filter((i) => i.type === "cancion").length;
  const bloqueAlabanza = event.serviceOrder.find((i) => isWorshipBlock(i));
  const personasAlabanza = (event.worshipRoles || []).reduce((acc, r) => acc + (r.members || []).length, 0);
  const tieneOtros = event.serviceOrder.some((i) => i.type === "slide" || i.type === "biblia");
  const pasosInicio = isAdminViewer && !event.esPlantilla && !pasosOcultos && (cancionesEvento === 0 || (bloqueAlabanza && personasAlabanza === 0)) ? [
    { clave: "canciones", titulo: "Agrega las canciones", detalle: cancionesEvento ? `${cancionesEvento} ${cancionesEvento === 1 ? "canción" : "canciones"}` : "Búscalas en la biblioteca", hecho: cancionesEvento > 0, accion: () => setPickerCancion(true) },
    ...(bloqueAlabanza ? [{
      clave: "equipo", titulo: "Asigna quién toca y canta", detalle: personasAlabanza ? `${personasAlabanza} personas` : "Piano, voz, batería…", hecho: personasAlabanza > 0,
      accion: () => {
        setExpandedSections((e) => ({ ...e, [bloqueAlabanza.id]: true }));
        setTimeout(() => document.querySelector(`[data-item-id="${bloqueAlabanza.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      },
    }] : []),
    { clave: "avisos", titulo: "Agrega avisos o el bosquejo", detalle: "Opcional", hecho: tieneOtros, accion: () => setShowAgregar(true) },
  ] : null;
  // Opciones de "+ Agregar", según lo que cada quien puede hacer.
  const opcionesAgregar = [
    isAdminViewer && { clave: "cancion", Icon: Music, color: "#1F8A73", titulo: "Canción", detalle: "De la biblioteca, con su letra lista", accion: () => setPickerCancion(true) },
    canAddBibleReading && { clave: "biblia", Icon: BookOpen, color: "#2F5FA8", titulo: "Versículo", detalle: "Búscalo en la Biblia", accion: onAddBibleClick },
    isAdminViewer && { clave: "texto", Icon: Type, color: "#B15EA0", titulo: "Texto rápido", detalle: "Un aviso o un título en segundos", accion: onAddSlideClick },
    isAdminViewer && onDisenarNueva && { clave: "disenar", Icon: PenTool, color: "#E8821E", titulo: "Diseñar diapositiva", detalle: "Con imágenes y plantillas", accion: () => onDisenarNueva(destinoAgregar ? anclaDeBloque(event.serviceOrder, destinoAgregar)?.id : undefined) },
    isAdminViewer && { clave: "importar", Icon: FileUp, color: "#5B6472", titulo: "Importar PDF o imágenes", detalle: "De Canva, PowerPoint o del predicador", accion: () => setShowImportar(true) },
    canAddSermonPoints && { clave: "bosquejo", Icon: Mic2, color: "var(--wf-heading)", titulo: "Punto del bosquejo", detalle: "Lo que el predicador va a ir mostrando", accion: () => setShowSermonForm(true) },
    isAdminViewer && onAddCuenta && { clave: "cuenta", Icon: Timer, color: "#5661B3", titulo: "Cuenta regresiva", detalle: "Un reloj antes de empezar (va al inicio si no eliges otra parte)", accion: () => setCuentaModal({}) },
    isAdminViewer && { clave: "bloque", Icon: ListMusic, color: "#5661B3", titulo: "Bloque del culto", detalle: "Una parte del culto: Bienvenida, Ofrenda…", accion: () => setShowSeccionForm(true) },
  ].filter(Boolean);
  const itemDelMenu = menuItem ? event.serviceOrder.find((x) => x.id === menuItem.id) : null;
  return (
    <div style={{ display: "flex", flexDirection: isCompact ? "column" : "row", flex: 1, minHeight: 0 }}>
      {/* Computadora: la biblioteca a la izquierda para agregar canciones con un toque. Todo lo demás
          (versículo, diapositivas, importar, bloques...) está en "+ Agregar". En el celular, la
          biblioteca se abre desde "+ Agregar → Canción". */}
      {!isCompact && isAdminViewer && (
      <div style={{ width: 270, margin: "14px 0 14px 14px", background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", minHeight: 0, boxSizing: "border-box", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--wf-muted)", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, marginBottom: 4 }}><ListMusic size={13} /> AGREGAR CANCIONES</div>
        <div style={{ fontSize: 11.5, color: "var(--wf-faint)", marginBottom: 10 }}>
          Toca una canción para agregarla al final.
          {elegidasPicker.length > 0 && <> <b style={{ color: "#1F8A73" }}>{elegidasPicker.length} {elegidasPicker.length === 1 ? "agregada" : "agregadas"}</b> · <button onClick={() => setElegidasPicker([])} style={{ background: "none", border: "none", padding: 0, fontSize: 11.5, fontWeight: 700, color: "#2F5FA8", cursor: "pointer" }}>Reiniciar números</button></>}
        </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 10px", marginBottom: 10 }}>
            <Search size={13} color="var(--wf-faint)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 12, width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 10 }}>
            {[["todos", "Todos"], ...clasificacionesActuales.map((c) => [c.clave, c.nombre])].map(([key, label]) => (
              <button key={key} onClick={() => setLibraryCategoryFilter(key)} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 20, border: "none", background: libraryCategoryFilter === key ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: libraryCategoryFilter === key ? "var(--wf-brand-primary)" : "var(--wf-text)", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
        <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
          {filtered.map((s) => {
            const numeros = numerosElegida(s.id);
            return (
            <button key={s.id} onClick={() => { if (handleAddSong(s.id)) setElegidasPicker((l) => [...l, s.id]); }} className="hoverable" style={{ width: "100%", textAlign: "left", padding: "9px 10px", marginBottom: 6, borderRadius: 12, background: numeros.length ? "var(--wf-active-bg)" : "transparent", border: "none", boxShadow: numeros.length ? "inset 0 0 0 1.5px #1F8A73" : "0 3px 14px rgba(22,50,79,0.09)", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{numeros.length > 0 && <span style={{ color: "#1F8A73", fontWeight: 800, marginRight: 5 }}>({numeros.join(", ")})</span>}{s.title}</div><div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(s.key)} · {s.tempo} bpm</div></div>
              <Plus size={15} color="var(--wf-brand-accent)" />
            </button>
            );
          })}
          {filtered.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12, padding: "6px 0" }}>Ninguna canción coincide.</div>}
        </div>
      </div>
      )}

      <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
          <h2 data-tour="evento-setlist" style={{ fontFamily: "'Fraunces', serif", fontSize: 20, margin: 0 }}>Setlist</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {!isCompact && <span style={{ fontSize: 12, color: "var(--wf-faint)" }}>{formatFullDate(event.date) || event.dateLabel}</span>}
            {canEditNow && event.serviceOrder.length > 1 && (
              <button
                onClick={() => { setOrdenando((v) => !v); setMenuItem(null); }}
                className={ordenando ? undefined : "hoverable"}
                title={ordenando ? "Terminar de ordenar" : "Cambiar el orden del culto"}
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 18, cursor: "pointer",
                  border: ordenando ? "none" : "1px solid var(--wf-border)", background: ordenando ? "#1F8A73" : "var(--wf-card)", color: ordenando ? "#fff" : "var(--wf-text)" }}
              >
                {ordenando ? <><Check size={15} /> Listo</> : <><ArrowUpDown size={15} /> Ordenar</>}
              </button>
            )}
            {puedeAgregarAlgo && !ordenando && (
              <button
                data-tour="evento-editar-setlist"
                onClick={() => { onDestinoAgregar?.(null); setShowAgregar(true); }}
                className="hoverable"
                style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 800, padding: "7px 14px", borderRadius: 18, border: "none", cursor: "pointer", background: "var(--wf-brand-accent)", color: "var(--wf-brand-primary)" }}
              >
                <Plus size={15} /> Agregar
              </button>
            )}
          </div>
        </div>
        <div style={{ height: 10 }} />
        {/* Evento nuevo: en vez de verse vacío, dice por dónde empezar. Cada paso se toca para hacerlo
            y se tacha solo cuando ya está listo; desaparece cuando lo principal está hecho. */}
        {pasosInicio && (
          <div style={{ background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", marginBottom: 14, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px 6px", display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>Empieza aquí</div>
                <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>Arma este culto en este orden</div>
              </div>
              <button onClick={ocultarPasos} title="Ocultar" aria-label="Ocultar Empieza aquí" style={{ ...iconGhost, width: 26, height: 26 }}><X size={14} /></button>
            </div>
            {pasosInicio.map((p, i) => (
              <button key={p.clave} onClick={p.hecho ? undefined : p.accion} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "11px 14px", border: "none", borderTop: "1px solid var(--wf-divider)", background: "transparent", cursor: p.hecho ? "default" : "pointer", color: "var(--wf-text)" }}>
                <span style={{ width: 28, height: 28, borderRadius: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, background: p.hecho ? "#E1F5EE" : i === pasosInicio.findIndex((x) => !x.hecho) ? "var(--wf-active-bg)" : "var(--wf-hover)", color: p.hecho ? "#1F8A73" : "var(--wf-active-text)" }}>
                  {p.hecho ? <Check size={15} /> : i + 1}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, textDecoration: p.hecho ? "line-through" : "none", color: p.hecho ? "var(--wf-muted)" : "var(--wf-text)" }}>{p.titulo}</span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)" }}>{p.detalle}</span>
                </span>
                {!p.hecho && <ChevronRight size={16} color="var(--wf-faint)" />}
              </button>
            ))}
          </div>
        )}
        {ordenando ? (
          <div style={{ paddingBottom: 120 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--wf-text-2)", background: "var(--wf-active-bg)", border: "1px solid #1F8A73", borderRadius: 12, padding: "8px 12px", margin: "6px 0 10px" }}>
              <ArrowUpDown size={15} color="#1F8A73" style={{ flexShrink: 0 }} />
              <span>Arrastra cada elemento a su lugar, o usa <b>Mover a…</b>. Toca <b>Listo</b> al terminar.</span>
            </div>
            {event.serviceOrder.map((item, idx) => {
              const meta = TYPE_META[item.type] || TYPE_META.slide;
              const Icon = meta.icon;
              const total = event.serviceOrder.length;
              const esBloque = item.type === "seccion";
              return (
                <div key={item.id} {...arrastre.filaProps(idx)} data-item-id={item.id}
                  style={{ display: "flex", alignItems: "center", gap: 8, height: 50, boxSizing: "border-box", padding: "0 8px 0 10px", marginBottom: 6, borderRadius: 12,
                    background: esBloque ? "rgba(124,140,216,0.16)" : "var(--wf-card)", border: esBloque ? "1px solid #5661B3" : "1px solid var(--wf-border)",
                    ...arrastre.estiloFila(idx) }}>
                  <GripVertical size={16} color={esBloque ? "#5661B3" : "var(--wf-faint)"} style={{ flexShrink: 0 }} />
                  <span style={{ width: 22, fontSize: 11.5, fontWeight: 700, color: "var(--wf-faint)", textAlign: "right", flexShrink: 0 }}>{idx + 1}</span>
                  <Icon size={15} color={meta.color} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: esBloque ? 800 : 600, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDeItem(item)}</span>
                  <select aria-label={`Mover ${nombreDeItem(item)} a otro lugar`} value="" onChange={(e) => { const h = Number(e.target.value); if (Number.isFinite(h) && h !== idx) onReorder(idx, h); }}
                    style={{ width: isCompact ? 34 : 104, height: 32, borderRadius: 9, border: "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0, padding: isCompact ? 0 : "0 6px", fontFamily: "inherit" }}>
                    <option value="" disabled>{isCompact ? "⋯" : "Mover a…"}</option>
                    {idx !== 0 && <option value={0}>Al principio</option>}
                    {event.serviceOrder.map((otro, j) => (j === idx || j === idx - 1 || j === total - 1 ? null : (
                      <option key={otro.id} value={j > idx ? j : j + 1}>Después de {j + 1}. {nombreDeItem(otro)}</option>
                    )))}
                    {idx !== total - 1 && <option value={total - 1}>Al final</option>}
                  </select>
                </div>
              );
            })}
          </div>
        ) : visibleServiceOrder.map((item, idx) => {
          const meta = TYPE_META[item.type];
          const filaArrastre = arrastre.filaProps(idx);
          if (item.type === "seccion") {
            const linkedMinistry = item.ministryId ? ministries.find((m) => m.id === item.ministryId) : null;
            // La planificación que aparece es la que tiene la MISMA fecha que este evento (no siempre la
            // primera de la lista) — así, por ejemplo, la Escuelita bíblica trae sola el tema de ese domingo.
            const currentPlan = linkedMinistry && event.date ? linkedMinistry.plan.find((p) => p.date === event.date) : null;
            const planStatusText = !linkedMinistry ? null : !event.date ? "Este evento no tiene fecha de calendario — asígnale una para traer la planificación sola." : currentPlan ? null : "Sin planificación cargada para esta fecha.";
            // Los recursos también son por mes — se traen los del mes de ESTE evento (no "el mes actual",
            // para que un evento pasado siga mostrando los recursos que de verdad usó ese día).
            const eventMonth = event.date ? event.date.slice(0, 7) : null;
            const resourcesForEventMonth = linkedMinistry ? linkedMinistry.resources.filter((r) => r.month === eventMonth) : [];
            // Quien no es administrador (Miembro, Músico, Multimedia, Supervisor...) ve el equipo
            // asignado de una, sin tener que tocar el botón de "Encargados" para desplegarlo — mismo
            // espíritu que ya tenía la vista de Limpieza, ahora aplicado a todo el Setlist.
            const isExpanded = isAdminViewer ? !!expandedSections[item.id] : true;
            const canEdit = canEditItem(item);
            return (
              <div
                key={item.id} {...filaArrastre} data-item-id={item.id}
                style={{
                  background: "rgba(124,140,216,0.16)", border: "1px solid #5661B3", borderRadius: 14, padding: "12px 14px", marginBottom: 8,
                  ...arrastre.estiloFila(idx),
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input
                      value={item.title} onChange={(e) => onUpdateSeccionText(item.id, "title", e.target.value)} readOnly={!canEdit}
                      style={{ border: "none", background: "transparent", outline: "none", fontSize: 14, fontWeight: 700, color: "var(--wf-text)", width: "100%", padding: 0, fontFamily: "inherit" }}
                    />
                    {linkedMinistry ? (
                      // Solo el título de la planificación acá (no el detalle completo, que sería
                      // ilegible en una sola línea) — tocarlo despliega el bosquejo completo y los
                      // recursos del ministerio abajo, mismo interruptor que el botón de encargados.
                      <div
                        onClick={() => setExpandedSections((e) => ({ ...e, [item.id]: !e[item.id] }))}
                        title={isExpanded ? "Ocultar planificación" : "Ver planificación"}
                        style={{ fontSize: 12, color: "var(--wf-text-2)", marginTop: 2, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{currentPlan ? currentPlan.title : planStatusText}</span>
                        {isExpanded ? <ChevronUp size={12} style={{ flexShrink: 0 }} /> : <ChevronDown size={12} style={{ flexShrink: 0 }} />}
                      </div>
                    ) : (
                      <input
                        value={item.description} onChange={(e) => onUpdateSeccionText(item.id, "description", e.target.value)} readOnly={!canEdit}
                        placeholder="Descripción del bloque..."
                        style={{ border: "none", background: "transparent", outline: "none", fontSize: 12, color: "var(--wf-text-2)", marginTop: 2, width: "100%", padding: 0, fontFamily: "inherit" }}
                      />
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                    {/* Para quien no es administrador el equipo ya está siempre visible abajo (ver
                        isExpanded) — el botón no tendría nada que desplegar, así que se cambia por un
                        conteo de solo lectura en vez de un botón que no hace nada. */}
                    {isAdminViewer ? (
                      <EncargadosToggleButton
                        count={isWorshipBlock(item) ? (event.worshipRoles || []).reduce((acc, r) => acc + r.members.length, 0) : (item.encargados || []).length}
                        onClick={() => setExpandedSections((e) => ({ ...e, [item.id]: !e[item.id] }))}
                      />
                    ) : (
                      <span title="Personas asignadas a este bloque" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", padding: "0 4px" }}>
                        <Users size={14} />
                        {isWorshipBlock(item) ? (event.worshipRoles || []).reduce((acc, r) => acc + r.members.length, 0) : (item.encargados || []).length}
                      </span>
                    )}
                    {canEditNow && botonMenu(item)}
                  </div>
                </div>
                {bosquejoInfo?.puede(item) && (
                  <div style={{ marginTop: 10 }}><BotonBosquejo bosquejo={bosquejoInfo.bosquejos[item.id]} onAbrir={() => bosquejoInfo.abrir(item.id)} /></div>
                )}
                {!bosquejoInfo?.puede(item) && esBloquePredicacion(item) && bosquejoInfo?.bosquejos[item.id]?.enviadoAt && (
                  <div style={{ marginTop: 8 }}><EtiquetaBosquejoListo /></div>
                )}

                {isExpanded && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(124,140,216,0.3)" }}>
                    {canEditNow && (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>VINCULAR A UN MINISTERIO</div>
                        <select value={item.ministryId || ""} onChange={(e) => onLinkMinistry(item.id, e.target.value)} style={inputStyle}>
                          <option value="">Sin vincular (usar descripción escrita arriba)</option>
                          {ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        {/* Marca a mano el bloque de la predicación (2026-11-04): así el bosquejo, el escenario y
                            su temporizador funcionan aunque el bloque no se llame "Predicación". */}
                        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10, marginBottom: linkedMinistry ? 10 : 0, cursor: "pointer" }}>
                          <input
                            type="checkbox" checked={esBloquePredicacion(item)}
                            onChange={(e) => onUpdateSeccionText(item.id, "esPredicacion", e.target.checked)}
                            style={{ width: 18, height: 18, accentColor: "#E8821E", marginTop: 1, flexShrink: 0 }}
                          />
                          <span>
                            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Este bloque es la predicación</span>
                            <span style={{ display: "block", fontSize: 11, color: "var(--wf-muted)" }}>Quien esté asignado aquí podrá armar su bosquejo. También activa la pantalla de escenario y su temporizador.</span>
                          </span>
                        </label>
                      </>
                    )}
                    {linkedMinistry && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 12, background: `${linkedMinistry.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Users size={14} color={linkedMinistry.color} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{linkedMinistry.name}</div>
                          <div style={{ fontSize: 11, color: "var(--wf-muted)" }}>Líder: {linkedMinistry.leaderName || "Sin asignar"}</div>
                        </div>
                        <button onClick={() => onViewMinistry(linkedMinistry.id)} style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>Ver ministerio <ExternalLink size={12} /></button>
                      </div>
                    )}
                    {/* Bosquejo completo de la semana — el título ya se ve arriba sin desplegar, acá va
                        el detalle completo para quien esté encargado de este bloque. */}
                    {linkedMinistry && currentPlan?.detail && (
                      <div style={{ background: "var(--wf-card)", borderRadius: 12, padding: "10px 12px", marginBottom: 10, boxShadow: "0 3px 14px rgba(22,50,79,0.09)" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4 }}>PLANIFICACIÓN DE ESTA SEMANA</div>
                        <div style={{ fontSize: 12.5, color: "var(--wf-text-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{currentPlan.detail}</div>
                      </div>
                    )}
                    {/* Recursos del ministerio (enlaces a documentos, videos, etc.) — antes solo se veían
                        entrando al ministerio; ahora quien lleva este bloque los tiene aquí mismo. */}
                    {linkedMinistry && resourcesForEventMonth.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>RECURSOS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {resourcesForEventMonth.map((r) => (
                            <a key={r.id} href={r.link || undefined} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--wf-card)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", textDecoration: "none", color: "var(--wf-text)", fontSize: 12, fontWeight: 600 }}>
                              <FolderOpen size={13} color="var(--wf-faint)" />
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
                              {r.link && <ExternalLink size={12} color="#2F5FA8" style={{ flexShrink: 0 }} />}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {isWorshipBlock(item) ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>EQUIPO DE ALABANZA (compartido con Alabanza/Adoración)</div>
                        <WorshipRolesEditor
                          roles={event.worshipRoles || []}
                          canEdit={canEditNow || (lideraBloque(item, gruposQueLidero) && !!linkedMinistry?.permisosLider?.equipo)}
                          allUsuarios={usuariosReales}
                          onAddRole={onAddWorshipRole}
                          onRemoveRole={onRemoveWorshipRole}
                          onAddMember={onAddWorshipRoleMember}
                          onSetStatus={onSetWorshipRoleMemberStatus}
                          onSetLead={onSetWorshipRoleMemberLead}
                          onRemoveMember={onRemoveWorshipRoleMember}
                          vistasPorUsuario={vistasPorUsuario}
                          showVistas={isAdminViewer}
                        />
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 6 }}>ENCARGADOS DE ESTE BLOQUE</div>
                        <EncargadosList
                          encargados={item.encargados || []}
                          canEdit={canEdit}
                          allUsuarios={usuariosReales}
                          onAddEncargado={(usuario) => onAddEncargado(item.id, usuario)}
                          onSetStatus={(mi, status) => onSetEncargadoStatus(item.id, mi, status)}
                          onSetLead={(mi) => onSetEncargadoLead(item.id, mi)}
                          onRemove={(mi) => onRemoveEncargado(item.id, mi)}
                          vistasPorUsuario={vistasPorUsuario}
                          showVistas={isAdminViewer}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          }
          // En el celular las diapositivas no se muestran (pedido de Eldin, 2026-10-10): ahí solo sirven
          // los cantos y el orden; las diapositivas se preparan y proyectan desde la computadora.
          // Excepción (2026-10-25, diseñador en el celular): las diapositivas DISEÑADAS sí se ven, para poder
          // abrir y retocar desde el teléfono los anuncios que se hicieron ahí.
          if (isCompact && item.type === "slide" && !item.isSermonPoint && !esGrupoDiapositivas(item)) return null;
          const song = item.type === "cancion" ? library.find((s) => s.id === item.songId) : null;
          const effectiveKey = song ? item.keyOverride || song.key : null;
          const Icon = meta.icon;
          const canEdit = canEditItem(item);
          // Miniatura solo de lo que se proyecta tal cual (diseño propio o página importada); las de texto
          // simple usan el estilo en vivo del momento y se siguen mostrando con su ícono.
          const diapsItem = esGrupoDiapositivas(item) || esPaginaPresentacion(item) ? diapositivasDeItem(item) : null;
          return (
            <div key={item.id} style={{ marginBottom: 8 }}>
              <div
                {...filaArrastre}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--wf-card)", boxShadow: "0 3px 14px rgba(22,50,79,0.09)",
                  ...arrastre.estiloFila(idx),
                }}
              >
                {item.type === "cancion" && song ? (
                  <>
                    {canEdit ? (
                      <select
                        value={effectiveKey}
                        onChange={(e) => onSetSongKey(item.id, e.target.value, song.key)}
                        title="Tonalidad para este evento"
                        style={{ width: getNotacion() === "solfeo" ? 62 : 46, borderRadius: 10, border: `1px solid ${item.keyOverride ? "var(--wf-brand-accent)" : "var(--wf-border-soft)"}`, fontSize: 10, fontWeight: 700, padding: "3px 2px", color: item.keyOverride ? "var(--wf-brand-accent)" : "var(--wf-text-2)", background: "var(--wf-card)", flexShrink: 0 }}
                      >
                        {(() => {
                          const opciones = opcionesTonalidadSetlist(song.key);
                          // Un cambio viejo que no encaje (ej. hecho antes de esta regla) se sigue mostrando tal cual.
                          return (opciones.includes(effectiveKey) ? opciones : [effectiveKey, ...opciones]).map((k) => <option key={k} value={k}>{acordeEn(k)}</option>);
                        })()}
                      </select>
                    ) : (
                      <span style={{ minWidth: 22, height: 22, padding: "0 4px", boxSizing: "border-box", borderRadius: 11, border: "1px solid var(--wf-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{acordeEn(effectiveKey)}</span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--wf-muted)", background: "var(--wf-hover)", borderRadius: 16, padding: "3px 8px", flexShrink: 0 }}>{song.tempo} bpm</span>
                    <span onClick={() => onOpenSong(song.id, item.id)} title="Abrir para tocar en vivo" style={{ fontSize: 13, fontWeight: 600, flex: 1, cursor: "pointer" }}>{song.title}</span>
                    {song.hasAttachment && <Paperclip size={14} color="var(--wf-faint)" />}
                  </>
                ) : (
                  <>
                    {esCuentaRegresiva(item) ? (
                      <div style={{ position: "relative", width: 64, aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", flexShrink: 0, background: "#000", boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}><RelojCuentaRegresiva cuenta={{ ...item.cuentaRegresiva, fondo: "propio" }} muestra={(normalizarCuenta(item.cuentaRegresiva).minutos || 5) * 60} quieto /></div>
                    ) : diapsItem?.length ? (
                      <div style={{ position: "relative", width: 64, aspectRatio: "16/9", borderRadius: 6, overflow: "hidden", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.25)" }}><DiapositivaDisenada diapositiva={diapsItem[0]} /></div>
                    ) : (
                      <div style={{ width: 26, height: 26, borderRadius: 10, background: `${meta.color}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={13} color={meta.color} /></div>
                    )}
                    {esCuentaRegresiva(item) ? (
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>Cuenta regresiva</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--wf-muted)" }}>{normalizarCuenta(item.cuentaRegresiva).modo === "hora" && event.hora ? `Hasta las ${String(event.hora).slice(0, 5)}` : `${normalizarCuenta(item.cuentaRegresiva).minutos} min`} · {estiloCuenta(normalizarCuenta(item.cuentaRegresiva).estilo).nombre}</span>
                      </span>
                    ) : <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.type === "biblia" ? item.reference : item.name || item.title}</span>}
                    {diapsItem?.length > 1 && <span style={{ fontSize: 11, color: "var(--wf-muted)", background: "var(--wf-hover)", borderRadius: 14, padding: "2px 8px", flexShrink: 0 }}>{diapsItem.length} diapositivas</span>}
                    {esCuentaRegresiva(item) && isAdminViewer && onEditarItem && (
                      <button onClick={() => setCuentaModal({ item })} title="Editar la cuenta regresiva" style={{ ...iconGhost, color: "#2F5FA8" }}><Pencil size={14} /></button>
                    )}
                    {item.type === "slide" && !esCuentaRegresiva(item) && isAdminViewer && !esGrupoDiapositivas(item) && onEditarItem && (
                      <button onClick={() => abrirEditarTexto(item)} title="Editar el texto" style={{ ...iconGhost, color: "#2F5FA8" }}><Pencil size={14} /></button>
                    )}
                    {item.type === "slide" && isAdminViewer && esGrupoDiapositivas(item) && onAbrirEditor && (
                      <button onClick={() => onAbrirEditor(item.id)} title="Editar el diseño" style={{ ...iconGhost, color: "#2F5FA8" }}><Pencil size={14} /></button>
                    )}
                    {item.isSermonPoint && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--wf-heading)", background: "var(--wf-hover)", borderRadius: 14, padding: "2px 8px", flexShrink: 0 }}>BOSQUEJO</span>}
                  </>
                )}
                {/* Asignar encargados (Encargados) es solo de bloques — una canción/versículo/slide
                    individual ya no lo ofrece, no tiene sentido asignar una persona "responsable" de
                    proyectar una diapositiva puntual. */}
                {canEditNow && botonMenu(item)}
              </div>
            </div>
          );
        })}
      </div>
      {animEvento && (() => {
        const it = event.serviceOrder.find((x) => x.id === animEvento.id);
        const song = it ? library.find((x) => x.id === it.songId) : null;
        const deCancion = song?.animacion?.general ? ANIMACIONES[song.animacion.general]?.nombre || null : null;
        return (
          <ModalShell title="Animación en este evento" icon={Sparkles} color="#B15EA0" onClose={() => setAnimEvento(null)}>
            <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10, lineHeight: 1.5 }}>
              Solo para "{song?.title || "esta canción"}" en este evento. {deCancion ? `La canción tiene "${deCancion}".` : "La canción no tiene un estilo propio."} Lo demás de la canción (momentos especiales, latido) se mantiene.
            </div>
            <SelectEstilo aria-label="Estilo en este evento" valor={animEvento.valor} vacio="Como la canción" onCambiar={(v) => setAnimEvento((a) => ({ ...a, valor: v }))} />
            <button onClick={() => { onEditarItem(animEvento.id, { animacion: animEvento.valor ? { general: animEvento.valor } : null }); setAnimEvento(null); }} style={{ ...primaryBtn, marginTop: 12 }}>Guardar</button>
          </ModalShell>
        );
      })()}
      {cuentaModal && (
        <CuentaRegresivaModal
          inicial={cuentaModal.item?.cuentaRegresiva || null} evento={event} editando={!!cuentaModal.item}
          onClose={() => setCuentaModal(null)}
          onGuardar={(c) => {
            if (cuentaModal.item) onEditarItem(cuentaModal.item.id, { cuentaRegresiva: c });
            else { onAddCuenta(c); setShowAgregar(false); }
            setCuentaModal(null);
          }}
        />
      )}
      {showBibleForm && <BibleModal onClose={() => setShowBibleForm(false)} onAdd={addBible} splitVersesIndividually />}
      {showSlideForm && <SlideModal iglesiaId={myIglesiaId} draft={slideDraft} setDraft={setSlideDraft} onClose={() => setShowSlideForm(false)} onAdd={addSlide} />}
      {editTexto && (
        <SlideModal iglesiaId={myIglesiaId} title="Editar diapositiva" submitLabel="Guardar cambios" draft={editTexto.draft}
          setDraft={(d) => setEditTexto((e) => ({ ...e, draft: d }))} onClose={() => setEditTexto(null)}
          onAdd={() => { onEditarItem(editTexto.id, editTexto.draft); setEditTexto(null); }} />
      )}
      {showSermonForm && (
        <ModalShell title="Agregar punto del bosquejo" icon={Mic2} color="var(--wf-heading)" onClose={() => setShowSermonForm(false)}>
          <div style={{ fontSize: 11, color: "var(--wf-muted)", marginBottom: 10 }}>Cada punto se agrega como su propia diapositiva, en el orden en que los escribas — así Multimedia los proyecta uno por uno mientras predicas.</div>
          <textarea value={sermonPointText} onChange={(e) => setSermonPointText(e.target.value)} placeholder="Ej. Dios cumple sus promesas a su tiempo" style={{ ...inputStyle, height: 80, resize: "none" }} autoFocus />
          <button onClick={addSermonPoint} style={{ ...primaryBtn, marginTop: 10 }}>Agregar punto</button>
        </ModalShell>
      )}
      {/* Menú "⋯" de un elemento del Setlist */}
      {itemDelMenu && (() => {
        const it = itemDelMenu;
        const indice = event.serviceOrder.findIndex((x) => x.id === it.id);
        const opcion = (Icon, label, accion, peligro) => (
          <button key={label} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setMenuItem(null); accion(); }}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "transparent", border: "none", borderRadius: 8, padding: "10px 12px", cursor: "pointer", color: peligro ? "#C23B32" : "var(--wf-text)", fontSize: 14, textAlign: "left", fontFamily: "inherit" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--wf-hover)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <Icon size={16} /> {label}
          </button>
        );
        return createPortal(
          <div onPointerDown={(e) => e.stopPropagation()} role="menu" style={{ position: "fixed", left: Math.max(8, menuItem.x), top: menuItem.y, zIndex: 3000, width: 210, background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: 4, boxShadow: "0 12px 30px rgba(0,0,0,0.3)" }}>
            {esCuentaRegresiva(it) && onEditarItem && opcion(Timer, "Editar cuenta regresiva", () => setCuentaModal({ item: it }))}
            {it.type === "slide" && !esCuentaRegresiva(it) && !esGrupoDiapositivas(it) && onEditarItem && opcion(Pencil, "Editar texto", () => abrirEditarTexto(it))}
            {it.type === "slide" && !esCuentaRegresiva(it) && onAbrirEditor && opcion(PenTool, esGrupoDiapositivas(it) ? "Editar diseño" : "Diseñar (imágenes, plantillas)", () => onAbrirEditor(it.id))}
            {it.type === "cancion" && opcion(Music, "Abrir la canción", () => onOpenSong(it.songId, it.id))}
            {it.type === "cancion" && onEditarItem && opcion(Sparkles, "Animación en este evento", () => setAnimEvento({ id: it.id, valor: it.animacion?.general || null }))}
            {it.type === "seccion" && opcion(Users, expandedSections[it.id] ? "Ocultar encargados" : "Ver encargados", () => setExpandedSections((e) => ({ ...e, [it.id]: !e[it.id] })))}
            {opcion(Copy, "Duplicar", () => onDuplicate(it.id))}
            {indice > 0 && opcion(ChevronUp, "Subir", () => moverItem(it, -1))}
            {indice < event.serviceOrder.length - 1 && opcion(ChevronDown, "Bajar", () => moverItem(it, 1))}
            <div style={{ height: 1, background: "var(--wf-border)", margin: "4px 8px" }} />
            {opcion(Trash2, it.type === "seccion" ? "Quitar el bloque" : "Quitar", () => quitarConDeshacer(it), true)}
          </div>,
          document.body,
        );
      })()}
      {/* "+ Agregar": todas las formas de agregar algo, cada una con su explicación. */}
      {showAgregar && (
        <ModalShell title="Agregar al culto" icon={Plus} color="var(--wf-brand-accent)" onClose={() => setShowAgregar(false)}>
          {onDestinoAgregar && <ElegirParteDelCulto orden={event.serviceOrder} valor={destinoAgregar} onCambiar={onDestinoAgregar} textoSinElegir="Al final del culto" />}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, margin: "0 -6px" }}>
            {opcionesAgregar.map((o) => (
              <button key={o.clave} onClick={() => { setShowAgregar(false); o.accion(); }} className="hoverable"
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 12, padding: "10px 8px", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: `color-mix(in srgb, ${o.color} 16%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><o.Icon size={19} color={o.color} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{o.titulo}</span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--wf-muted)" }}>{o.detalle}</span>
                </span>
                <ChevronRight size={16} color="var(--wf-faint)" />
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--wf-faint)", marginTop: 10 }}>Luego lo puedes mover con ⋯ → Subir/Bajar, o con el botón Ordenar.</div>
        </ModalShell>
      )}
      {/* Buscar y agregar canciones (en el celular es la forma de agregarlas; en computadora también
          está la biblioteca a la izquierda). Se queda abierto para agregar varias seguidas. */}
      {pickerCancion && (
        <ModalShell alto title="Agregar canciones" icon={Music} color="#1F8A73" onClose={() => { setPickerCancion(false); onDestinoAgregar?.(null); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 10px", marginBottom: 10, flexShrink: 0 }}>
              <Search size={13} color="var(--wf-faint)" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar canción..." style={{ background: "transparent", border: "none", outline: "none", color: "var(--wf-text)", fontSize: 13, width: "100%" }} />
            </div>
          <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4, marginBottom: 10, flexShrink: 0 }}>
            {[["todos", "Todos"], ...clasificacionesActuales.map((c) => [c.clave, c.nombre])].map(([key, label]) => (
              <button key={key} onClick={() => setLibraryCategoryFilter(key)} style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, padding: "6px 11px", borderRadius: 20, border: "none", background: libraryCategoryFilter === key ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: libraryCategoryFilter === key ? "var(--wf-brand-primary)" : "var(--wf-text)", cursor: "pointer" }}>{label}</button>
            ))}
          </div>
          {/* Antes la lista medía media pantalla y en el celular solo se veían ~7 canciones, sin notarse que
              había más (pedido de Eldin, 2026-10-25). Ahora usa casi todo el alto y dice cuántas hay. */}
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", margin: "0 2px 6px", flexShrink: 0 }}>
            {filtered.length} {filtered.length === 1 ? "canción" : "canciones"}{libraryCategoryFilter !== "todos" ? ` en ${clasificacionesActuales.find((c) => c.clave === libraryCategoryFilter)?.nombre || "esta sección"}` : ""}{filtered.length > 6 ? " · desliza para ver todas" : ""}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>
            {filtered.map((s) => {
              const veces = event.serviceOrder.filter((i) => i.type === "cancion" && i.songId === s.id).length;
              const numeros = numerosElegida(s.id);
              return (
                <button key={s.id} onClick={() => { if (!handleAddSong(s.id)) return; setElegidasPicker((l) => [...l, s.id]); showToast(`"${s.title}" se agregó al culto (${elegidasPicker.length + 1}).`, "info"); }} className="hoverable" style={{ width: "100%", textAlign: "left", padding: "10px 10px", marginBottom: 6, borderRadius: 12, background: numeros.length ? "var(--wf-active-bg)" : "transparent", border: numeros.length ? "1px solid #1F8A73" : "1px solid var(--wf-border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "var(--wf-text)", fontFamily: "inherit" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{numeros.length > 0 && <span aria-label={`elegida en el lugar ${numeros.join(" y ")}`} style={{ color: "#1F8A73", fontWeight: 800, marginRight: 6 }}>({numeros.join(", ")})</span>}{s.title}</span>
                    <span style={{ display: "block", fontSize: 11.5, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(s.key)} · {s.tempo} bpm{veces ? <span style={{ color: "var(--wf-muted)", fontFamily: "'Poppins', sans-serif" }}> · ya está en el culto</span> : null}</span>
                  </span>
                  <Plus size={18} color="var(--wf-brand-accent)" />
                </button>
              );
            })}
            {filtered.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 12, padding: "6px 0" }}>Ninguna canción coincide.</div>}
          </div>
          <button onClick={() => { setPickerCancion(false); onDestinoAgregar?.(null); }} style={{ ...primaryBtn, marginTop: 10, flexShrink: 0 }}>{elegidasPicker.length ? `Listo · ${elegidasPicker.length} ${elegidasPicker.length === 1 ? "canción agregada" : "canciones agregadas"}` : "Listo"}</button>
        </ModalShell>
      )}
      {showImportar && (
        <ImportarPresentacion
          iglesiaId={myIglesiaId} destino="Entra al final del culto. Luego la puedes mover con ⋯ → Subir/Bajar."
          onClose={() => setShowImportar(false)}
          onImportar={(items) => { onAddItems(items); setShowImportar(false); }}
        />
      )}
      {showSeccionForm && (
        <ModalShell title="Agregar bloque del culto" icon={ListMusic} color="#5661B3" onClose={() => setShowSeccionForm(false)}>
          <Field label="Título" required><input value={seccionDraft.title} onChange={(e) => setSeccionDraft({ ...seccionDraft, title: e.target.value })} placeholder="Ej. Bloque de Alabanza" style={inputStyle} autoFocus /></Field>
          <div style={{ height: 10 }} />
          <Field label="Descripción"><textarea value={seccionDraft.description} onChange={(e) => setSeccionDraft({ ...seccionDraft, description: e.target.value })} placeholder="Ej. Guiar a la congregación a una expresión activa de gozo y gratitud." style={{ ...inputStyle, height: 80, resize: "none" }} /></Field>
          <button onClick={confirmAddSeccion} disabled={!seccionDraft.title.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: seccionDraft.title.trim() ? 1 : 0.4, cursor: seccionDraft.title.trim() ? "pointer" : "not-allowed" }}>Agregar bloque</button>
        </ModalShell>
      )}
    </div>
  );
}
