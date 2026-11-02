// Grupos (ministerios): lista y detalle con planificación y recursos. Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState, useRef, useEffect } from "react";
import { monthKey, monthLabelFromKey } from "../lib/dates.js";
import { Plus, Users, LayoutGrid, ArrowLeft, Trash2, ChevronLeft, ChevronRight, StickyNote, ChevronDown, ChevronUp, ClipboardList, FolderOpen, ExternalLink, Pencil, Paperclip, X } from "lucide-react";
import { subirArchivoRecurso, getResumenMensual, guardarResumenMensual } from "../lib/ministerios.js";
import { notifyError } from "../lib/toast.js";
import { PERMISOS_LIDER } from "../lib/roles.js";
import { iconGhost, ModalShell, Field, inputStyle, primaryBtn, nextMinistryChildId, miniBtnStyle, addBtnStyle } from "./compartido.jsx";

const MINISTRY_COLORS = ["var(--wf-brand-accent)", "#2E86AB", "#B15EA0", "#1F8A73", "#C23B32", "#5661B3"];

export function MinistriesList({ ministries, usuariosReales, isAdminViewer, onSelect, onCreate }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", leaderId: "", color: MINISTRY_COLORS[0] });
  const hoy = new Date();
  const mesActual = monthKey(hoy.getFullYear(), hoy.getMonth());

  const submit = () => {
    if (!form.name.trim()) return;
    onCreate(form);
    setForm({ name: "", leaderId: "", color: MINISTRY_COLORS[0] });
    setShowForm(false);
  };

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: 0 }}>Ministerios</h2>
        {isAdminViewer && <button onClick={() => setShowForm(true)} style={{ ...iconGhost, width: 30, height: 30, background: "var(--wf-hover)", border: "1px solid var(--wf-border)" }}><Plus size={16} /></button>}
      </div>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 16 }}>Cada ministerio tiene su propio espacio para compartir la planificación del mes y recursos con su equipo. Cualquier miembro puede ser el líder de un grupo.</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {ministries.map((m) => (
          <button key={m.id} onClick={() => onSelect(m.id)} className="hoverable" style={{ textAlign: "left", background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 16, padding: 16, cursor: "pointer" }}>
            <div style={{ width: 34, height: 34, borderRadius: 12, background: `${m.color}22`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Users size={17} color={m.color} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{m.name}</div>
            <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>Líder: {m.leaderName || "Sin asignar"}</div>
            <div style={{ fontSize: 12, color: "var(--wf-faint)", marginTop: 2 }}>{m.memberCount} miembros · {m.plan.filter((p) => (p.date || "").slice(0, 7) === mesActual).length} planes este mes</div>
          </button>
        ))}
      </div>

      {showForm && (
        <ModalShell title="Nuevo ministerio" icon={LayoutGrid} color="#5661B3" onClose={() => setShowForm(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Nombre" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Ministerio de Matrimonios" style={inputStyle} /></Field>
            <Field label="Líder">
              <select value={form.leaderId} onChange={(e) => setForm({ ...form, leaderId: e.target.value })} style={inputStyle}>
                <option value="">Sin asignar</option>
                {usuariosReales.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </Field>
            <Field label="Color">
              <div style={{ display: "flex", gap: 8 }}>
                {MINISTRY_COLORS.map((c) => (<button key={c} onClick={() => setForm({ ...form, color: c })} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: form.color === c ? "2px solid #fff" : "1px solid var(--wf-border)", cursor: "pointer" }} />))}
              </div>
            </Field>
          </div>
          <button onClick={submit} disabled={!form.name.trim()} style={{ ...primaryBtn, marginTop: 14, opacity: form.name.trim() ? 1 : 0.4 }}>Crear ministerio</button>
        </ModalShell>
      )}
    </div>
  );
}

export function MinistryDetail({ myIglesiaId, ministry, usuariosReales, isAdminViewer, canEdit, onBack, onSavePlan, onAddResource, onEditResource, onRemoveResource, onSetLeader, onSetName, onSetColor, onSetPermisosLider, onDelete }) {
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resourceDraft, setResourceDraft] = useState({ title: "", link: "" });
  // null = agregando uno nuevo; con valor = editando ese recurso ya existente (mismo modal para los dos).
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [subiendoArchivoRecurso, setSubiendoArchivoRecurso] = useState(false);
  const [errorArchivoRecurso, setErrorArchivoRecurso] = useState("");
  const resourceFileInputRef = useRef(null);
  // El enlace de un recurso puede venir de pegarlo a mano O de subir un archivo (ver abajo) -- en
  // ambos casos termina siendo una URL normal en resourceDraft.link, pero una URL de Storage es larga
  // y fea para mostrarla tal cual en el campo de texto; esto la detecta para mostrar "Archivo
  // adjunto ✓" en su lugar.
  const esArchivoSubido = (link) => (link || "").includes("/storage/v1/object/public/recursos-ministerio/");
  const adjuntarArchivoRecurso = async (file) => {
    if (!file || !myIglesiaId) return;
    setSubiendoArchivoRecurso(true); setErrorArchivoRecurso("");
    try {
      const url = await subirArchivoRecurso(myIglesiaId, file);
      setResourceDraft((d) => ({ ...d, link: url, title: d.title || file.name.replace(/\.[^.]+$/, "") }));
    } catch (e) {
      setErrorArchivoRecurso(e.message || "No se pudo subir el archivo.");
    } finally {
      setSubiendoArchivoRecurso(false);
    }
  };

  // Planificación y recursos ahora viven por mes — cada ministerio puede tener años de historial, y
  // mezclar todos los meses en una sola lista larga (sobre todo los recursos, que antes no tenían
  // fecha) hacía difícil encontrar lo de AHORA. El mes elegido es solo de navegación (no se guarda);
  // siempre arranca en el mes actual al entrar al grupo.
  const hoy = new Date();
  const [selectedMonth, setSelectedMonth] = useState(monthKey(hoy.getFullYear(), hoy.getMonth()));
  const changeMonth = (delta) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(monthKey(d.getFullYear(), d.getMonth()));
  };

  // La planificación se edita en un borrador LOCAL, no letra por letra contra Supabase — antes cada
  // tecla disparaba un guardado (borra-todo-y-reinserta) que la sincronización en tiempo real podía
  // llegar a pisar a mitad de camino (llega un refresco de otro dispositivo mientras el guardado de ESTE
  // todavía va de salida, y agarra la base de datos en el instante en que ya se borró lo viejo pero
  // todavía no se insertó lo nuevo). Ahora nada se manda hasta tocar "Guardar planificación".
  const [planDraft, setPlanDraft] = useState(ministry?.plan || []);
  const [planDirty, setPlanDirty] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  // El detalle de cada semana arranca colapsado (solo el título se ve de una) — con muchas semanas
  // cargadas, un cuadro de texto grande por cada una hacía la lista larguísima. La flechita lo
  // despliega para escribir o leer, y "Guardar planificación" vuelve a colapsar todo.
  const [expandedPlanIds, setExpandedPlanIds] = useState({});
  useEffect(() => {
    if (!planDirty) setPlanDraft(ministry?.plan || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministry?.id, ministry?.plan]);

  // Resumen del mes: texto libre aparte de la planificación semana a semana, para que el líder deje
  // un cierre general ("este mes nos enfocamos en...", asistencia, lo que destaca). Se carga/guarda
  // bajo demanda por mes (no viaja con el resto del ministerio) — ver la nota junto a
  // getResumenMensual en lib/ministerios.js sobre por qué.
  const [resumenGuardado, setResumenGuardado] = useState("");
  const [resumenDraft, setResumenDraft] = useState("");
  const [loadingResumen, setLoadingResumen] = useState(true);
  const [savingResumen, setSavingResumen] = useState(false);
  // Mismo criterio que expandedPlanIds más abajo (y que "Editar/Guardar" en el Setlist): colapsado por
  // defecto mostrando el texto fijo, un botón lo despliega para editar (o solo leer, si no puede
  // editar), y "Guardar" lo vuelve a colapsar — así no queda un cuadro de texto abierto todo el tiempo.
  const [expandedResumen, setExpandedResumen] = useState(false);
  useEffect(() => {
    if (!ministry) return;
    let cancelado = false;
    setLoadingResumen(true);
    getResumenMensual(ministry.id, selectedMonth)
      .then((texto) => { if (!cancelado) { setResumenGuardado(texto); setResumenDraft(texto); } })
      .catch((e) => { if (!cancelado) notifyError("No se pudo cargar el resumen del mes", e); })
      .finally(() => { if (!cancelado) setLoadingResumen(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministry?.id, selectedMonth]);
  const resumenDirty = resumenDraft !== resumenGuardado;
  const saveResumen = async () => {
    setSavingResumen(true);
    try {
      await guardarResumenMensual(ministry.id, selectedMonth, resumenDraft);
      setResumenGuardado(resumenDraft);
      setExpandedResumen(false);
    } catch (e) {
      notifyError("No se pudo guardar el resumen del mes", e);
    } finally {
      setSavingResumen(false);
    }
  };
  const cancelEditResumen = () => { setResumenDraft(resumenGuardado); setExpandedResumen(false); };

  if (!ministry) return null;

  const addDraftPlanItem = () => {
    const newId = nextMinistryChildId();
    setPlanDraft((plan) => [...plan, { id: newId, date: `${selectedMonth}-01`, title: "", detail: "" }]);
    setExpandedPlanIds((e) => ({ ...e, [newId]: true }));
    setPlanDirty(true);
  };
  const updateDraftPlanItem = (itemId, field, value) => { setPlanDraft((plan) => plan.map((p) => (p.id === itemId ? { ...p, [field]: value } : p))); setPlanDirty(true); };
  const removeDraftPlanItem = (itemId) => { setPlanDraft((plan) => plan.filter((p) => p.id !== itemId)); setPlanDirty(true); };
  const togglePlanExpanded = (itemId) => setExpandedPlanIds((e) => ({ ...e, [itemId]: !e[itemId] }));
  const savePlan = async () => {
    setSavingPlan(true);
    try {
      await onSavePlan(planDraft);
      setPlanDirty(false);
      setExpandedPlanIds({});
    } catch (e) {
      notifyError("No se pudo guardar la planificación", e);
    } finally {
      setSavingPlan(false);
    }
  };

  const submitResource = () => {
    if (!resourceDraft.title.trim()) return;
    if (editingResourceId) onEditResource(editingResourceId, { title: resourceDraft.title, link: resourceDraft.link });
    else onAddResource({ ...resourceDraft, month: selectedMonth });
    closeResourceForm();
  };
  const closeResourceForm = () => {
    setShowResourceForm(false);
    setEditingResourceId(null);
    setResourceDraft({ title: "", link: "" });
    setErrorArchivoRecurso("");
  };
  const startAddingResource = () => { setEditingResourceId(null); setResourceDraft({ title: "", link: "" }); setShowResourceForm(true); };
  const startEditingResource = (r) => { setEditingResourceId(r.id); setResourceDraft({ title: r.title, link: r.link || "" }); setShowResourceForm(true); };
  const planForMonth = planDraft.filter((p) => (p.date || "").slice(0, 7) === selectedMonth);
  const resourcesForMonth = ministry.resources.filter((r) => r.month === selectedMonth);

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 820, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={onBack} style={iconGhost}><ArrowLeft size={16} /></button>
        {/* Borrar un grupo es más consecuente que editarlo (afecta a los bloques del Setlist vinculados
            en cualquier evento), así que se restringe a administradores — el líder puede editar nombre/
            color/líder pero no borrar el grupo entero. */}
        {isAdminViewer && <button onClick={onDelete} title="Eliminar grupo" style={iconGhost}><Trash2 size={16} color="#C23B32" /></button>}
      </div>
      <div style={{ borderRadius: 16, background: `linear-gradient(135deg, ${ministry.color}33, var(--wf-hover))`, padding: 20, marginBottom: 20 }}>
        {isAdminViewer ? (
          <input
            value={ministry.name} onChange={(e) => onSetName(e.target.value)}
            style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 8, border: "none", background: "transparent", outline: "none", width: "100%", padding: 0 }}
          />
        ) : (
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{ministry.name}</div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--wf-text-2)", marginBottom: isAdminViewer ? 10 : 0 }}>
          Líder:
          {isAdminViewer ? (
            <select value={ministry.leaderId || ""} onChange={(e) => onSetLeader(e.target.value || null)} style={{ ...inputStyle, width: "auto", padding: "4px 8px", fontSize: 12 }}>
              <option value="">Sin asignar</option>
              {usuariosReales.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          ) : (
            <span style={{ fontWeight: 700 }}>{ministry.leaderName || "Sin asignar"}</span>
          )}
        </div>
        {/* Qué puede hacer el líder (permisos por grupo, 2026-10-30) — así no hace falta darle un rol aparte. */}
        {isAdminViewer && (
          <div style={{ background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: "10px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4 }}>QUÉ PUEDE HACER EL LÍDER</div>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", margin: "3px 0 4px", lineHeight: 1.4 }}>Siempre: editar este grupo y, en cada evento, el título y los encargados de los bloques vinculados a él. Además:</div>
            {PERMISOS_LIDER.map((p) => {
              const activo = !!ministry.permisosLider?.[p.clave];
              return (
                <div key={p.clave} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: "1px solid var(--wf-divider)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{p.etiqueta}</div>
                    <div style={{ fontSize: 11, color: "var(--wf-muted)", marginTop: 1 }}>{p.detalle}</div>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={activo} aria-label={p.etiqueta}
                    onClick={() => onSetPermisosLider({ ...(ministry.permisosLider || {}), [p.clave]: !activo })}
                    style={{ flexShrink: 0, width: 42, height: 24, borderRadius: 14, border: "none", position: "relative", cursor: "pointer", background: activo ? "var(--wf-brand-accent)" : "var(--wf-border)" }}
                  >
                    <span style={{ position: "absolute", top: 3, left: activo ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {isAdminViewer && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {MINISTRY_COLORS.map((c) => (
              <button key={c} onClick={() => onSetColor(c)} title="Color del grupo" style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: ministry.color === c ? "2px solid var(--wf-text)" : "1px solid rgba(0,0,0,0.15)", cursor: "pointer" }} />
            ))}
          </div>
        )}
      </div>

      {/* Selector de mes: planificación y recursos viven todos en las mismas dos tablas sin importar
          el mes (se filtran acá por fecha/mes), así que cambiar de mes no pierde nada de lo ya
          cargado en otros meses — solo cambia qué parte de esa lista se ve y a qué mes se etiqueta
          lo nuevo que se agregue. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 16, background: "var(--wf-hover)", borderRadius: 14, padding: "8px 12px" }}>
        <button onClick={() => changeMonth(-1)} className="hoverable" style={iconGhost}><ChevronLeft size={16} /></button>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 140, textAlign: "center" }}>{monthLabelFromKey(selectedMonth)}</span>
        <button onClick={() => changeMonth(1)} className="hoverable" style={iconGhost}><ChevronRight size={16} /></button>
      </div>

      {/* Resumen del mes: nota de cierre general, aparte de la planificación semana a semana de abajo —
          a diferencia de esta, no se carga junto con el resto del ministerio (ver getResumenMensual). */}
      <div style={{ background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          <StickyNote size={15} color={ministry.color} /> Resumen de {monthLabelFromKey(selectedMonth)}
        </div>
        {loadingResumen ? (
          <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>Cargando…</div>
        ) : !expandedResumen ? (
          // Colapsado por defecto (y después de cada "Guardar") — el texto queda fijo, con solo una
          // vista previa de una línea; tocar acá lo despliega, ya sea para editarlo o solo para leerlo
          // completo si no se puede editar.
          <div onClick={() => setExpandedResumen(true)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12.5, color: resumenGuardado ? "var(--wf-text-2)" : "var(--wf-faint)" }}>
              {resumenGuardado || (canEdit ? "Sin resumen todavía — tocar para escribir uno." : "Sin resumen todavía.")}
            </span>
            <ChevronDown size={14} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
          </div>
        ) : canEdit ? (
          <>
            <textarea
              autoFocus
              value={resumenDraft} onChange={(e) => setResumenDraft(e.target.value)}
              placeholder="Ej. este mes nos enfocamos en identidad en Cristo, 4 reuniones, buena asistencia..."
              rows={4} style={{ ...inputStyle, resize: "vertical" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
              <button onClick={saveResumen} disabled={!resumenDirty || savingResumen} className="hoverable" style={{ ...primaryBtn, width: "auto", padding: "7px 16px", fontSize: 12.5, opacity: resumenDirty && !savingResumen ? 1 : 0.5, cursor: resumenDirty && !savingResumen ? "pointer" : "default" }}>
                {savingResumen ? "Guardando…" : "Guardar resumen"}
              </button>
              {!savingResumen && <button onClick={cancelEditResumen} style={{ ...iconGhost, width: "auto", padding: "0 8px", fontSize: 12, fontWeight: 700 }}>Cancelar</button>}
              {resumenDirty && !savingResumen && <span style={{ fontSize: 11, color: "var(--wf-brand-accent)", fontWeight: 700 }}>● Cambios sin guardar</span>}
            </div>
          </>
        ) : (
          <div onClick={() => setExpandedResumen(false)} className="hoverable" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 12.5, color: "var(--wf-text-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{resumenGuardado || "Sin resumen todavía."}</div>
            <ChevronUp size={14} color="var(--wf-faint)" style={{ marginTop: 6 }} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><ClipboardList size={15} color={ministry.color} /> Planificación de {monthLabelFromKey(selectedMonth)}</div>
        {canEdit && <button onClick={addDraftPlanItem} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar fecha</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {planForMonth.map((p) => {
          const isExpanded = !!expandedPlanIds[p.id];
          return (
          <div key={p.id} style={{ background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isExpanded ? 8 : 0 }}>
              <input type="date" disabled={!canEdit} title="Fecha del domingo (o día) al que corresponde esta planificación" value={p.date || ""} onChange={(e) => updateDraftPlanItem(p.id, "date", e.target.value)} style={{ ...inputStyle, width: 150, fontSize: 12, fontWeight: 700, flexShrink: 0 }} />
              <input disabled={!canEdit} value={p.title} onChange={(e) => updateDraftPlanItem(p.id, "title", e.target.value)} placeholder="Título de la semana" style={{ ...inputStyle, flex: 1, fontWeight: 700 }} />
              <button onClick={() => togglePlanExpanded(p.id)} title={isExpanded ? "Ocultar detalle" : "Ver detalle"} style={iconGhost}>{isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              {canEdit && <button onClick={() => removeDraftPlanItem(p.id)} style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>}
            </div>
            {isExpanded && (
              canEdit ? (
                <textarea autoFocus value={p.detail} onChange={(e) => updateDraftPlanItem(p.id, "detail", e.target.value)} placeholder="Detalle, recursos necesarios, responsables..." rows={6} style={{ ...inputStyle, resize: "vertical" }} />
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--wf-text-2)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{p.detail || "Sin detalle."}</div>
              )
            )}
          </div>
          );
        })}
        {planForMonth.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>Aún no hay planificación para {monthLabelFromKey(selectedMonth)}.</div>}
      </div>
      {/* Nada de lo de arriba se guarda solo — a propósito, para no disparar un guardado por cada tecla
          (ver el comentario junto al estado planDraft). Este botón es el único momento en que se manda
          todo a Supabase de una vez. */}
      {canEdit && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <button onClick={savePlan} disabled={!planDirty || savingPlan} className="hoverable" style={{ ...primaryBtn, width: "auto", padding: "9px 18px", opacity: planDirty && !savingPlan ? 1 : 0.5, cursor: planDirty && !savingPlan ? "pointer" : "default" }}>
            {savingPlan ? "Guardando…" : "Guardar planificación"}
          </button>
          {planDirty && !savingPlan && <span style={{ fontSize: 11, color: "var(--wf-brand-accent)", fontWeight: 700 }}>● Cambios sin guardar</span>}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700 }}><FolderOpen size={15} color={ministry.color} /> Recursos de {monthLabelFromKey(selectedMonth)}</div>
        {canEdit && <button onClick={startAddingResource} className="hoverable" style={miniBtnStyle}><Plus size={12} /> Agregar recurso</button>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {resourcesForMonth.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--wf-card)", border: "none", boxShadow: "0 3px 14px rgba(22,50,79,0.09)", borderRadius: 12, padding: "10px 12px" }}>
            <FolderOpen size={14} color="var(--wf-faint)" />
            <span style={{ fontSize: 13, flex: 1 }}>{r.title}</span>
            {r.link && <a href={r.link} target="_blank" rel="noreferrer" style={{ color: "#2F5FA8" }}><ExternalLink size={14} /></a>}
            {canEdit && <button onClick={() => startEditingResource(r)} title="Editar" style={{ ...iconGhost, color: "#2F5FA8" }}><Pencil size={14} /></button>}
            {canEdit && <button onClick={() => onRemoveResource(r.id)} title="Eliminar" style={{ ...iconGhost, color: "#C23B32" }}><Trash2 size={14} /></button>}
          </div>
        ))}
        {resourcesForMonth.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13 }}>No hay recursos compartidos para {monthLabelFromKey(selectedMonth)}.</div>}
      </div>

      {showResourceForm && (
        <ModalShell title={editingResourceId ? "Editar recurso" : "Agregar recurso"} icon={FolderOpen} color={ministry.color} onClose={closeResourceForm}>
          <Field label="Título" required><input value={resourceDraft.title} onChange={(e) => setResourceDraft({ ...resourceDraft, title: e.target.value })} placeholder="Ej. Guía de manualidades" style={inputStyle} /></Field>
          <div style={{ height: 10 }} />
          <Field label="Enlace (opcional si adjuntas un archivo)">
            <input
              value={esArchivoSubido(resourceDraft.link) ? "" : resourceDraft.link}
              onChange={(e) => setResourceDraft({ ...resourceDraft, link: e.target.value })}
              placeholder="https://..."
              style={inputStyle}
            />
          </Field>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => resourceFileInputRef.current?.click()} disabled={subiendoArchivoRecurso} className="hoverable" style={{ ...addBtnStyle, flex: 1, opacity: subiendoArchivoRecurso ? 0.6 : 1 }}>
              <Paperclip size={13} color={ministry.color} />
              <span>{subiendoArchivoRecurso ? "Subiendo…" : esArchivoSubido(resourceDraft.link) ? "Archivo adjunto ✓ — tocar para cambiar" : "O adjuntar un archivo"}</span>
            </button>
            {esArchivoSubido(resourceDraft.link) && !subiendoArchivoRecurso && (
              <button type="button" onClick={() => setResourceDraft((d) => ({ ...d, link: "" }))} title="Quitar archivo" style={{ ...iconGhost, color: "#C23B32" }}><X size={14} /></button>
            )}
          </div>
          <input ref={resourceFileInputRef} type="file" style={{ display: "none" }} onChange={(e) => { adjuntarArchivoRecurso(e.target.files?.[0]); e.target.value = ""; }} />
          {errorArchivoRecurso && <div style={{ fontSize: 11, color: "#C23B32", marginTop: 6 }}>{errorArchivoRecurso}</div>}
          <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Hasta 20 MB — PDF, imagen, audio, lo que sea.</div>
          <button onClick={submitResource} disabled={subiendoArchivoRecurso} style={{ ...primaryBtn, marginTop: 14, opacity: subiendoArchivoRecurso ? 0.6 : 1 }}>{editingResourceId ? "Guardar cambios" : "Agregar"}</button>
        </ModalShell>
      )}
    </div>
  );
}
