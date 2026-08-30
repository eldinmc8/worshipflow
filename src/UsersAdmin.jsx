import { useEffect, useMemo, useState } from "react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { showToast } from "./lib/toast.js";
import { parseIsoDateLocal, todayLocal, buildMonthWeeks, MONTH_NAMES_FULL, DOW_LABELS, formatFullDate } from "./lib/dates.js";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "multimedia", label: "Multimedia" },
  { value: "musico", label: "Músico" },
  { value: "miembro", label: "Miembro" },
];
const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v;

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const primaryBtn = { background: "#E8821E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "#16324F", cursor: "pointer" };
const ghostBtn = { background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };
const cardStyle = { background: "var(--wf-card)", borderRadius: 10, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: "12px 14px", marginBottom: 8 };

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

function UserProfile({ user, myEmail, busy, onBack, onUpdateField, onResetPassword, onRemoveUser }) {
  const [tab, setTab] = useState("info"); // info | horario
  const [showRoleSelect, setShowRoleSelect] = useState(false);
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
        <span style={{ display: "inline-block", marginTop: 4, background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 20, padding: "2px 12px", fontSize: 11, fontWeight: 700, color: "#2F5FA8" }}>{roleLabel(user.rol).toUpperCase()}</span>
        {!user.perfil_completo && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#8A4F0E", background: "#FFF4E8", border: "1px solid #E8821E", borderRadius: 20, padding: "3px 12px", display: "inline-block" }}>Todavía no completó su perfil — este nombre es provisional</div>
        )}
      </div>

      <div style={{ display: "flex", background: "var(--wf-hover)", borderRadius: 10, padding: 4, marginBottom: 16 }}>
        <button onClick={() => setTab("info")} style={{ flex: 1, border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: tab === "info" ? "#16324F" : "transparent", color: tab === "info" ? "#fff" : "var(--wf-text-2)" }}>Información personal</button>
        <button onClick={() => setTab("horario")} style={{ flex: 1, border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", background: tab === "horario" ? "#16324F" : "transparent", color: tab === "horario" ? "#fff" : "var(--wf-text-2)" }}>Horario</button>
      </div>

      {tab === "info" ? (
        <div>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-faint)", marginBottom: 2 }}>CORREO ELECTRÓNICO</div>
            <div style={{ fontSize: 14, color: "var(--wf-text)" }}>{user.email}</div>
          </div>

          <button onClick={() => setShowRoleSelect((v) => !v)} style={{ ...cardStyle, width: "100%", textAlign: "left", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Cambiar rol</div>
            <span style={{ fontSize: 12, color: "var(--wf-muted)" }}>{roleLabel(user.rol)} {showRoleSelect ? "▲" : "▼"}</span>
          </button>
          {showRoleSelect && (
            <div style={{ ...cardStyle, marginTop: -4 }}>
              <select value={user.rol} onChange={(e) => onUpdateField(user.id, "rol", e.target.value)} style={inputStyle}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
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
                            borderRadius: 8, border: isToday && !isSelected ? "1.5px solid #2F5FA8" : "1.5px solid transparent",
                            background: isSelected ? "#E8821E" : dayEvents.length ? "var(--wf-hover)" : "transparent",
                            cursor: "pointer", padding: 0,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: isSelected ? 800 : 600, color: isSelected ? "#fff" : "var(--wf-text-2)" }}>{day}</span>
                          {dayEvents.length > 0 && <span style={{ width: 4, height: 4, borderRadius: "50%", background: isSelected ? "#fff" : "#E8821E" }} />}
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

export default function UsersAdmin({ myEmail, onExit }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ email: "", rol: "miembro" });
  const [selectedUserId, setSelectedUserId] = useState(null);

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
    const { data, error } = await supabase.from("usuarios").select("*").order("created_at", { ascending: true });
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

  const resetPassword = async (id) => {
    const password = window.prompt("Nueva contraseña (mínimo 6 caracteres):");
    if (!password) return;
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
    if (!window.confirm(`¿Eliminar la cuenta de ${row.nombre} (${row.email})? Esto no se puede deshacer.`)) return;
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
            {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}
            <UserProfile user={selectedUser} myEmail={myEmail} busy={busy} onBack={() => window.history.back()} onUpdateField={updateField} onResetPassword={resetPassword} onRemoveUser={removeUser} />
          </>
        ) : (
          <div className="screen-enter">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "var(--wf-heading)", margin: 0 }}>Usuarios</h1>
              <button onClick={onExit} style={ghostBtn}>← Volver a la app</button>
            </div>

            {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

            <form onSubmit={addUser} style={{ background: "var(--wf-card)", borderRadius: 12, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: 16, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
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

            <div style={{ background: "var(--wf-card)", borderRadius: 12, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", overflow: "hidden" }}>
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
                      {!row.perfil_completo && <span title="Todavía no completó su perfil" style={{ fontSize: 9, fontWeight: 700, color: "#8A4F0E", background: "#FFF4E8", border: "1px solid #E8821E", borderRadius: 10, padding: "1px 6px", marginLeft: 6 }}>PENDIENTE</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{row.email}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2F5FA8", background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 20, padding: "2px 10px", flexShrink: 0 }}>{roleLabel(row.rol)}</span>
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
