import { useEffect, useMemo, useState } from "react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { showToast } from "./lib/toast.js";
import { confirmDialog, promptDialog } from "./lib/confirm.js";
import { parseIsoDateLocal, todayLocal, buildMonthWeeks, MONTH_NAMES_FULL, DOW_LABELS, formatFullDate } from "./lib/dates.js";
import { validarPassword } from "./lib/passwordSegura.js";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "multimedia", label: "Multimedia" },
  { value: "musico", label: "Músico" },
  { value: "miembro", label: "Miembro" },
  { value: "supervisor", label: "Supervisor" },
];
const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v;

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const primaryBtn = { background: "var(--wf-brand-accent)", border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "var(--wf-brand-primary)", cursor: "pointer" };
const ghostBtn = { background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };
const cardStyle = { background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: "12px 14px", marginBottom: 8 };

// Todos los eventos (reales, no plantillas) donde este usuario aparece como encargado — ya sea de un
// ítem del Setlist (miembros_rol.item_servicio_id) o de un rol del equipo de alabanza
// (miembros_rol.rol_id) — para armar su pestaña "Horario".
async function fetchScheduleForUser(usuarioId) {
  const { data: miembros, error: e1 } = await supabase.from("miembros_rol").select("item_servicio_id, rol_id").eq("usuario_id", usuarioId);
  if (e1) throw e1;
  const itemIds = [...new Set(miembros.map((m) => m.item_servicio_id).filter(Boolean))];
  const roleIds = [...new Set(miembros.map((m) => m.rol_id).filter(Boolean))];

  const eventoIds = new Set();
  if (itemIds.length) {
    const { data, error } = await supabase.from("items_servicio").select("evento_id").in("id", itemIds);
    if (error) throw error;
    data.forEach((r) => eventoIds.add(r.evento_id));
  }
  if (roleIds.length) {
    const { data, error } = await supabase.from("roles_evento").select("evento_id").in("id", roleIds);
    if (error) throw error;
    data.forEach((r) => eventoIds.add(r.evento_id));
  }
  if (!eventoIds.size) return [];
  const { data, error } = await supabase.from("eventos").select("id, titulo, fecha, fecha_label, ubicacion").in("id", [...eventoIds]).eq("es_plantilla", false).order("fecha", { ascending: true });
  if (error) throw error;
  return data;
}

function UserProfile({ user, myEmail, busy, rolesApp, onUpdateField, onChangeRole, onBack, onResetPassword, onRemoveUser }) {
  const [tab, setTab] = useState("info"); // info | horario
  const [showRoleSelect, setShowRoleSelect] = useState(false);
  // Roles personalizados que un administrador haya creado en Ajustes → Roles, aparte de los 5 de
  // fábrica (esos siguen viniendo de ROLES arriba, con su propio valor de texto en usuarios.rol).
  const rolesPersonalizados = (rolesApp || []).filter((r) => !ROLES.some((legacy) => legacy.label === r.nombre));
  const currentRoleValue = user.rol_id && rolesPersonalizados.some((r) => r.id === user.rol_id) ? `custom:${user.rol_id}` : `legacy:${user.rol}`;
  const currentRoleLabel = user.rol_id && rolesPersonalizados.find((r) => r.id === user.rol_id)?.nombre || roleLabel(user.rol);
  const [schedule, setSchedule] = useState(null); // null = cargando
  const today = todayLocal();
  const [viewedMonth, setViewedMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const isViewingCurrentMonth = viewedMonth.year === today.getFullYear() && viewedMonth.month === today.getMonth();

  useEffect(() => {
    setSchedule(null);
    fetchScheduleForUser(user.id).then(setSchedule).catch(() => setSchedule([]));
  }, [user.id]);

  const eventsByDay = useMemo(() => {
    const map = {};
    (schedule || []).forEach((ev) => {
      const d = parseIsoDateLocal(ev.fecha);
      if (!d || d.getFullYear() !== viewedMonth.year || d.getMonth() !== viewedMonth.month) return;
      (map[d.getDate()] ||= []).push(ev);
    });
    return map;
  }, [schedule, viewedMonth]);
  const weeks = useMemo(() => buildMonthWeeks(viewedMonth.year, viewedMonth.month), [viewedMonth]);
  const changeMonth = (delta) => {
    setViewedMonth(({ year, month }) => { const d = new Date(year, month + delta, 1); return { year: d.getFullYear(), month: d.getMonth() }; });
    setSelectedDay(null);
  };
  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];
  const initials = user.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const isSelf = user.email === myEmail;

  return (
    <div className="screen-enter" style={{ maxWidth: 480, margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 14 }}>← Volver a Usuarios</button>

      <div style={{ textAlign: "center", marginBottom: 18 }}>
        {user.foto_url ? (
          <img src={user.foto_url} alt="" style={{ width: 74, height: 74, borderRadius: "50%", objectFit: "cover", margin: "0 auto 10px", display: "block" }} />
        ) : (
          <div style={{ width: 74, height: 74, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, color: "#fff", margin: "0 auto 10px" }}>{initials}</div>
        )}
        <div style={{ fontSize: 17, fontWeight: 700, color: "var(--wf-text)" }}>{user.nombre}</div>
        <span style={{ display: "inline-block", marginTop: 4, background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700, color: "#2F5FA8" }}>{currentRoleLabel.toUpperCase()}</span>
        {!user.perfil_completo && (
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--wf-active-text)", background: "var(--wf-active-bg)", border: "1px solid var(--wf-brand-accent)", borderRadius: 20, padding: "3px 12px", display: "inline-block" }}>Todavía no completó su perfil — este nombre es provisional</div>
        )}
      </div>

      <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 14, padding: 4, marginBottom: 16 }}>
        <button onClick={() => setTab("info")} style={{ flex: 1, border: "none", borderRadius: 12, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: tab === "info" ? "var(--wf-brand-accent)" : "transparent", color: tab === "info" ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>Información personal</button>
        <button onClick={() => setTab("horario")} style={{ flex: 1, border: "none", borderRadius: 12, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: tab === "horario" ? "var(--wf-brand-accent)" : "transparent", color: tab === "horario" ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>Horario</button>
      </div>

      {tab === "info" ? (
        <div>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-faint)", marginBottom: 2 }}>CORREO ELECTRÓNICO</div>
            <div style={{ fontSize: 14, color: "var(--wf-text)" }}>{user.email}</div>
          </div>

          <button onClick={() => setShowRoleSelect((v) => !v)} style={{ ...cardStyle, width: "100%", textAlign: "left", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Cambiar rol</div>
            <span style={{ fontSize: 12, color: "var(--wf-muted)" }}>{currentRoleLabel} {showRoleSelect ? "▲" : "▼"}</span>
          </button>
          {showRoleSelect && (
            <div style={{ ...cardStyle, marginTop: -4 }}>
              <select
                value={currentRoleValue}
                onChange={(e) => {
                  const [tipo, valor] = e.target.value.split(":");
                  // Un rol personalizado no tiene equivalente en el texto viejo (usuarios.rol) — se deja
                  // en "miembro" como base segura (sin ningún acceso especial de los 5 roles de fábrica),
                  // y todo lo que ese rol personalizado sí permite viene de rol_id (ver tienePermiso en
                  // PrototipoWorshipFlow.jsx).
                  if (tipo === "custom") onChangeRole(user.id, { rol: "miembro", rol_id: valor });
                  else onChangeRole(user.id, { rol: valor, rol_id: null });
                }}
                style={inputStyle}
              >
                <optgroup label="Roles de fábrica">
                  {ROLES.map((r) => <option key={r.value} value={`legacy:${r.value}`}>{r.label}</option>)}
                </optgroup>
                {rolesPersonalizados.length > 0 && (
                  <optgroup label="Roles personalizados">
                    {rolesPersonalizados.map((r) => <option key={r.id} value={`custom:${r.id}`}>{r.nombre}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          <div style={{ ...cardStyle, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Estado de la cuenta</div>
            <button onClick={() => onUpdateField(user.id, "estado", user.estado === "activo" ? "inactivo" : "activo")} style={{ ...ghostBtn, background: user.estado === "activo" ? "#E9F7EF" : "#FDECEA", color: user.estado === "activo" ? "#1F8A73" : "#C23B32", border: "none" }}>
              {user.estado === "activo" ? "Activo" : "Inactivo"}
            </button>
          </div>

          <button onClick={() => onResetPassword(user.id)} disabled={busy} style={{ ...cardStyle, width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>
            Reiniciar contraseña
          </button>

          <button onClick={() => onRemoveUser(user)} disabled={isSelf || busy} style={{ ...cardStyle, width: "100%", textAlign: "left", border: "none", cursor: isSelf ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 700, color: "#C23B32", opacity: isSelf ? 0.4 : 1 }}>
            Eliminar miembro
          </button>
          {isSelf && <div style={{ fontSize: 11, color: "var(--wf-faint)", padding: "0 4px" }}>No puedes eliminar tu propia cuenta.</div>}
        </div>
      ) : (
        <div style={cardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => changeMonth(-1)} style={ghostBtn}>‹</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-heading)" }}>{MONTH_NAMES_FULL[viewedMonth.month]} {viewedMonth.year}</span>
              <button onClick={() => changeMonth(1)} style={ghostBtn}>›</button>
            </div>
            {!isViewingCurrentMonth && (
              <button onClick={() => { setViewedMonth({ year: today.getFullYear(), month: today.getMonth() }); setSelectedDay(today.getDate()); }} style={{ ...ghostBtn, fontSize: 10 }}>Hoy</button>
            )}
          </div>
          {schedule === null ? (
            <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "10px 0" }}>Cargando horario…</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                {DOW_LABELS.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--wf-faint)" }}>{d}</div>)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                {weeks.map((week, wi) => (
                  <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {week.map((day, di) => {
                      if (day === null) return <div key={di} />;
                      const dayEvents = eventsByDay[day] || [];
                      const isSelected = day === selectedDay;
                      const isToday = isViewingCurrentMonth && day === today.getDate();
                      return (
                        <button
                          key={di}
                          onClick={() => setSelectedDay(day)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, height: 36,
                            borderRadius: 12, border: isToday && !isSelected ? "1.5px solid #2F5FA8" : "1.5px solid transparent",
                            background: isSelected ? "var(--wf-brand-accent)" : dayEvents.length ? "var(--wf-hover)" : "transparent",
                            cursor: "pointer", padding: 0,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: isSelected ? 800 : 600, color: isSelected ? "#fff" : "var(--wf-text-2)" }}>{day}</span>
                          {dayEvents.length > 0 && <span style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "#fff" : "var(--wf-brand-accent)" }} />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--wf-hover)", paddingTop: 10 }}>
                {selectedDayEvents.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>Sin eventos asignados este día.</div>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <div key={ev.id} style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{ev.titulo}</div>
                      <div style={{ fontSize: 11, color: "var(--wf-muted)" }}>{formatFullDate(ev.fecha)}{ev.fecha_label ? ` · ${ev.fecha_label}` : ""}{ev.ubicacion ? ` · ${ev.ubicacion}` : ""}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function UsersAdmin({ myEmail, iglesiaId, onExit }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ email: "", rol: "miembro" });
  const [selectedUserId, setSelectedUserId] = useState(null);
  // Roles personalizados (Ajustes → Roles) para poder asignárselos a alguien desde su perfil, además
  // de los 5 de fábrica de arriba.
  const [rolesApp, setRolesApp] = useState([]);
  useEffect(() => { supabase.from("roles_app").select("id, nombre").order("orden").then(({ data }) => setRolesApp(data || [])); }, []);
  // Quién SÍ tiene notificaciones push activadas en al menos un dispositivo — push_subscriptions solo
  // deja leer la propia fila por RLS (correcto, no se toca), así que esto pasa por una función aparte
  // (usuarios_con_push, ver migración 20261003000200) que solo devuelve usuario_id, nunca el endpoint/
  // llaves de la suscripción de nadie. Con eso basta para marcar en la lista a quien le falta.
  const [usuariosConPush, setUsuariosConPush] = useState(null); // null = cargando
  useEffect(() => {
    supabase.rpc("usuarios_con_push", { p_iglesia_id: iglesiaId })
      .then(({ data, error }) => setUsuariosConPush(error ? new Set() : new Set((data || []).map((r) => r.usuario_id))));
  }, [iglesiaId]);

  // Abrir el perfil de alguien empuja su propia entrada del historial ("usuarios-profile") — así el
  // botón/gesto "atrás" regresa a la lista de Usuarios en vez de salir de la app de un salto.
  useEffect(() => {
    const onPopState = (e) => {
      if (e.state?.screen !== "usuarios-profile" && e.state?.screen !== "usuarios-root") return;
      setSelectedUserId(e.state.screen === "usuarios-profile" ? e.state.selectedUserId : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const openUserProfile = (id) => {
    window.history.pushState({ screen: "usuarios-profile", selectedUserId: id }, "");
    setSelectedUserId(id);
  };

  const load = async () => {
    setError("");
    // Solo los de esta iglesia: un super administrador también puede leer los de otras (Consola general).
    const { data, error } = await supabase.from("usuarios").select("*").eq("iglesia_id", iglesiaId).order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setRows(data);
  };
  useEffect(() => { load(); }, []);

  // Ya no se le pide contraseña al admin: se manda una invitación por correo y la persona elige su
  // propia contraseña al aceptarla (ver crear-usuario/index.ts y AuthGate.jsx → SetPassword).
  const addUser = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await callUsersFunction("crear-usuario", draft);
      setDraft({ email: "", rol: "miembro" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const updateField = async (id, field, value) => {
    setError("");
    const { error } = await supabase.from("usuarios").update({ [field]: value }).eq("id", id);
    if (error) setError(error.message);
    else load();
  };

  const changeRole = async (id, patch) => {
    setError("");
    const { error } = await supabase.from("usuarios").update(patch).eq("id", id);
    if (error) setError(error.message);
    else load();
  };

  const resetPassword = async (id) => {
    const password = await promptDialog("Nueva contraseña (mínimo 8 caracteres, con letras y números):", { esPassword: true, textoConfirmar: "Guardar" });
    if (!password) return;
    const errPassword = validarPassword(password);
    if (errPassword) { setError(errPassword); return; }
    setBusy(true); setError("");
    try {
      await callUsersFunction("reiniciar-password", { id, password });
      showToast("Contraseña actualizada.", "info");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeUser = async (row) => {
    if (!(await confirmDialog(`¿Eliminar la cuenta de ${row.nombre} (${row.email})? Esto no se puede deshacer.`, { danger: true, textoConfirmar: "Eliminar" }))) return;
    setBusy(true); setError("");
    try {
      await callUsersFunction("eliminar-usuario", { id: row.id });
      setSelectedUserId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedUser = rows?.find((r) => r.id === selectedUserId) || null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        {selectedUser ? (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
              <button onClick={onExit} style={ghostBtn}>← Volver a la app</button>
            </div>
            {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 12, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <UserProfile user={selectedUser} myEmail={myEmail} busy={busy} rolesApp={rolesApp} onBack={() => window.history.back()} onUpdateField={updateField} onChangeRole={changeRole} onResetPassword={resetPassword} onRemoveUser={removeUser} />
          </>
        ) : (
          <div className="screen-enter">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "var(--wf-heading)", margin: 0 }}>Usuarios</h1>
              <button onClick={onExit} style={ghostBtn}>← Volver a la app</button>
            </div>

            {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 12, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <form onSubmit={addUser} style={{ background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: 16, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)" }}>Correo</label>
                <input type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)" }}>Rol</label>
                <select value={draft.rol} onChange={(e) => setDraft({ ...draft, rol: e.target.value })} style={inputStyle}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Enviando…" : "✉ Invitar por correo"}</button>
            </form>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: -12, marginBottom: 20 }}>Le llegará un correo para crear su propia contraseña y elegir su nombre (y foto, si entra con Google) al aceptar.</div>

            <div style={{ background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", overflow: "hidden" }}>
              {rows === null && <div style={{ padding: 20, color: "var(--wf-faint)", fontSize: 13 }}>Cargando…</div>}
              {rows?.length === 0 && <div style={{ padding: 20, color: "var(--wf-faint)", fontSize: 13 }}>Todavía no hay usuarios.</div>}
              {rows?.map((row) => (
                <button key={row.id} onClick={() => openUserProfile(row.id)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", padding: "12px 16px", borderBottom: "1px solid var(--wf-hover)", cursor: "pointer" }}>
                  {row.foto_url ? (
                    <img src={row.foto_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                      {row.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>
                      {row.nombre} {row.email === myEmail && <span style={{ fontSize: 10, color: "var(--wf-faint)" }}>(tú)</span>}
                      {!row.perfil_completo && <span title="Todavía no completó su perfil" style={{ fontSize: 9, fontWeight: 700, color: "var(--wf-active-text)", background: "var(--wf-active-bg)", border: "1px solid var(--wf-brand-accent)", borderRadius: 14, padding: "1px 6px", marginLeft: 6 }}>PENDIENTE</span>}
                      {usuariosConPush && !usuariosConPush.has(row.id) && <span title="No tiene notificaciones push activadas en ningún dispositivo — no le llegan avisos de asignaciones ni recordatorios" style={{ fontSize: 9, fontWeight: 700, color: "#C23B32", background: "#FBEAE8", border: "1px solid #C23B32", borderRadius: 14, padding: "1px 6px", marginLeft: 6 }}>SIN PUSH</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{row.email}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 20, padding: "2px 10px", flexShrink: 0 }}>{row.rol_id && rolesApp.find((r) => r.id === row.rol_id && !ROLES.some((legacy) => legacy.label === r.nombre))?.nombre || roleLabel(row.rol)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0, color: row.estado === "activo" ? "#1F8A73" : "#C23B32" }}>{row.estado === "activo" ? "Activo" : "Inactivo"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
