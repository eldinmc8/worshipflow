import { useEffect, useState } from "react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "multimedia", label: "Multimedia" },
  { value: "musico", label: "Músico" },
  { value: "miembro", label: "Miembro" },
];
const roleLabel = (v) => ROLES.find((r) => r.value === v)?.label || v;

const inputStyle = { width: "100%", background: "#FFFFFF", border: "1px solid #C7D0DD", borderRadius: 8, padding: "9px 10px", fontSize: 13, color: "#16233A", outline: "none", boxSizing: "border-box" };
const primaryBtn = { background: "#E8821E", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "#16324F", cursor: "pointer" };
const ghostBtn = { background: "#EEF1F6", border: "1px solid #C7D0DD", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "#16233A", cursor: "pointer" };

export default function UsersAdmin({ myEmail, onExit }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ nombre: "", email: "", password: "", rol: "miembro" });

  const load = async () => {
    setError("");
    const { data, error } = await supabase.from("usuarios").select("*").order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setRows(data);
  };
  useEffect(() => { load(); }, []);

  const addUser = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await callUsersFunction("crear-usuario", draft);
      setDraft({ nombre: "", email: "", password: "", rol: "miembro" });
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
      window.alert("Contraseña actualizada.");
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
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F4F6FA", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "#16324F", margin: 0 }}>Usuarios</h1>
          <button onClick={onExit} style={ghostBtn}>← Volver a la app</button>
        </div>

        {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <form onSubmit={addUser} style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: 16, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>Nombre</label>
            <input required value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 180px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>Correo</label>
            <input type="email" required value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>Contraseña inicial</label>
            <input type="text" required minLength={6} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 150px" }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64707F" }}>Rol</label>
            <select value={draft.rol} onChange={(e) => setDraft({ ...draft, rol: e.target.value })} style={inputStyle}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>+ Agregar usuario</button>
        </form>

        <div style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", overflow: "hidden" }}>
          {rows === null && <div style={{ padding: 20, color: "#8996A6", fontSize: 13 }}>Cargando…</div>}
          {rows?.length === 0 && <div style={{ padding: 20, color: "#8996A6", fontSize: 13 }}>Todavía no hay usuarios.</div>}
          {rows?.map((row) => (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #EEF1F6", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#16233A" }}>{row.nombre} {row.email === myEmail && <span style={{ fontSize: 10, color: "#8996A6" }}>(tú)</span>}</div>
                <div style={{ fontSize: 12, color: "#64707F", overflow: "hidden", textOverflow: "ellipsis" }}>{row.email}</div>
              </div>
              <select value={row.rol} onChange={(e) => updateField(row.id, "rol", e.target.value)} style={{ ...inputStyle, width: 160, flex: "0 0 auto" }}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <button onClick={() => updateField(row.id, "estado", row.estado === "activo" ? "inactivo" : "activo")} style={{ ...ghostBtn, background: row.estado === "activo" ? "#E9F7EF" : "#FDECEA", color: row.estado === "activo" ? "#1F8A73" : "#C23B32", border: "none" }}>
                {row.estado === "activo" ? "Activo" : "Inactivo"}
              </button>
              <button onClick={() => resetPassword(row.id)} style={ghostBtn}>Reiniciar contraseña</button>
              <button onClick={() => removeUser(row)} disabled={row.email === myEmail} style={{ ...ghostBtn, color: "#C23B32", opacity: row.email === myEmail ? 0.4 : 1, cursor: row.email === myEmail ? "not-allowed" : "pointer" }}>Eliminar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
