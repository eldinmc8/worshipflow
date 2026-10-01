import { useEffect, useState } from "react";
import { listarRoles, crearRol, actualizarRol, eliminarRol, PERMISOS_APP } from "./lib/roles.js";
import { showToast } from "./lib/toast.js";
import { confirmDialog } from "./lib/confirm.js";

const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const primaryBtn = { background: "#E8821E", border: "none", borderRadius: 12, padding: "9px 16px", fontSize: 13, fontWeight: 700, color: "#16324F", cursor: "pointer" };
const ghostBtn = { background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer" };
const cardStyle = { background: "var(--wf-card)", borderRadius: 14, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: "12px 14px", marginBottom: 8 };

// Fila de interruptor para un permiso — igual de simple que "Estado de la cuenta" en UsersAdmin, solo
// que aquí cada permiso tiene además una línea de explicación (PERMISOS_APP.detalle) porque el nombre
// solo no siempre deja claro qué desbloquea exactamente.
function PermisoToggle({ permiso, activo, disabled, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--wf-hover)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{permiso.etiqueta}</div>
        <div style={{ fontSize: 11, color: "var(--wf-muted)", marginTop: 1 }}>{permiso.detalle}</div>
      </div>
      <button
        type="button"
        onClick={() => !disabled && onToggle(!activo)}
        disabled={disabled}
        style={{
          flexShrink: 0, width: 42, height: 24, borderRadius: 14, border: "none", position: "relative",
          background: activo ? "#E8821E" : "var(--wf-border)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ position: "absolute", top: 3, left: activo ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </div>
  );
}

function RoleEditor({ role, onBack, onSaved, onDeleted }) {
  const isNew = !role;
  const [nombre, setNombre] = useState(role?.nombre || "");
  const [permisos, setPermisos] = useState(role?.permisos || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const protegido = !!role?.protegido;

  const togglePermiso = (clave, valor) => setPermisos((p) => ({ ...p, [clave]: valor }));

  const guardar = async () => {
    if (!nombre.trim()) { setError("Ponle un nombre al rol."); return; }
    setBusy(true); setError("");
    try {
      if (isNew) {
        await crearRol({ nombre, permisos });
        showToast("Rol creado.", "info");
      } else {
        await actualizarRol(role.id, { nombre: nombre.trim(), permisos });
        showToast("Rol actualizado.", "info");
      }
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const borrar = async () => {
    if (!(await confirmDialog(`¿Eliminar el rol "${role.nombre}"? Esto no se puede deshacer.`, { danger: true, textoConfirmar: "Eliminar" }))) return;
    setBusy(true); setError("");
    try {
      await eliminarRol(role.id);
      showToast("Rol eliminado.", "info");
      onDeleted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen-enter" style={{ maxWidth: 480, margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...ghostBtn, marginBottom: 14 }}>← Volver a Roles</button>

      <div style={cardStyle}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)" }}>Nombre del rol</label>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={protegido} style={{ ...inputStyle, marginTop: 4, opacity: protegido ? 0.7 : 1 }} placeholder="Ej. Supervisor de sonido" />
        {protegido && <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Este rol es protegido — siempre tiene todos los permisos, para que la iglesia nunca se quede sin nadie con control total.</div>}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-faint)", marginBottom: 4, textTransform: "uppercase" }}>Qué puede hacer este rol</div>
        {PERMISOS_APP.map((p) => (
          <PermisoToggle key={p.clave} permiso={p} activo={protegido ? true : !!permisos[p.clave]} disabled={protegido} onToggle={(v) => togglePermiso(p.clave, v)} />
        ))}
      </div>

      {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 12, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={guardar} disabled={busy} style={{ ...primaryBtn, flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : isNew ? "Crear rol" : "Guardar cambios"}</button>
        {!isNew && !protegido && (
          <button onClick={borrar} disabled={busy} style={{ ...ghostBtn, color: "#C23B32" }}>Eliminar</button>
        )}
      </div>
    </div>
  );
}

export default function RolesAdmin({ onExit }) {
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState("");
  const [editingRole, setEditingRole] = useState(undefined); // undefined = lista · null = crear nuevo · objeto = editar

  const load = async () => {
    setError("");
    try {
      setRoles(await listarRoles());
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const volverALista = () => { setEditingRole(undefined); load(); };

  if (editingRole !== undefined) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
        <RoleEditor role={editingRole} onBack={volverALista} onSaved={volverALista} onDeleted={volverALista} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--wf-bg)", fontFamily: "'Poppins', sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div className="screen-enter">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: "var(--wf-heading)", margin: 0 }}>Roles</h1>
            <button onClick={onExit} style={ghostBtn}>← Volver a la app</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 16 }}>Crea roles a la medida de esta iglesia y decide exactamente qué puede hacer cada uno. Los roles de fábrica (Administrador, Multimedia, Músico, Miembro, Supervisor) siguen funcionando igual — puedes editarlos o crear otros nuevos junto a ellos.</div>

          {error && <div style={{ background: "#FDECEA", border: "1px solid #C23B32", color: "#8A2A24", borderRadius: 12, padding: "8px 12px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

          <button onClick={() => setEditingRole(null)} style={{ ...primaryBtn, marginBottom: 16 }}>+ Crear rol</button>

          <div style={{ background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", overflow: "hidden" }}>
            {roles === null && <div style={{ padding: 20, color: "var(--wf-faint)", fontSize: 13 }}>Cargando…</div>}
            {roles?.map((r) => {
              const activos = r.protegido ? PERMISOS_APP.length : PERMISOS_APP.filter((p) => r.permisos?.[p.clave]).length;
              return (
                <button key={r.id} onClick={() => setEditingRole(r)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", padding: "12px 16px", borderBottom: "1px solid var(--wf-hover)", cursor: "pointer" }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>
                      {r.nombre} {r.protegido && <span style={{ fontSize: 10, fontWeight: 700, color: "#2F5FA8", background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 16, padding: "2px 8px", marginLeft: 6 }}>PROTEGIDO</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>{activos} de {PERMISOS_APP.length} permisos activos</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
