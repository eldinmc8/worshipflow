// Ventanas sueltas de Ajustes y del Setlist (contraseña, identidad de la iglesia, ajustes de la proyección, selector de fondos). Separadas de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState, useEffect, useRef } from "react";
import SelectorZonaHoraria from "../components/SelectorZonaHoraria.jsx";
import { etiquetaZona } from "../lib/zonasHorarias.js";
import { supabase } from "../lib/supabaseClient.js";
import { Radio, Palette, Download, KeyRound, Play, Image as ImgIcon, LayoutGrid, Trash2, Clock } from "lucide-react";
import { FORMATOS_LETRA } from "../lib/dividirTexto.js";
import AppLogo from "../AppLogo.jsx";
import { validarPassword } from "../lib/passwordSegura.js";
import MedidorPassword from "../MedidorPassword.jsx";
import { listarFondos, subirFondo, borrarFondo } from "../lib/multimedia.js";
import { confirmDialog } from "../lib/confirm.js";
import { notifyError, showToast, esFalloDeConexion } from "../lib/toast.js";
import { ModalShell, Field, primaryBtn, inputStyle, addBtnStyle } from "./compartido.jsx";
import { avisoDeEnlace } from "../lib/videoEnlace.js";

// +502 4054 4813, sin "+" ni espacios para wa.me

// Cambiar la propia contraseña sin depender de un administrador — a diferencia de "Reiniciar
// contraseña" en Usuarios (que un admin usa para OTRA persona), esto es autoservicio: updateUser()
// de Supabase Auth ya cambia la contraseña de la sesión actual sin pedir la anterior.

// Fase 5: nombre, zona horaria, logo y colores de ESTA iglesia — antes de esto, lo único que existía
// era la base de datos lista para guardarlos (Fase 3) y mostrarlos (ver myIglesia en
// WorshipFlowPrototype), pero ningún administrador podía cambiarlos desde la app. Recarga la página
// al guardar en vez de propagar el cambio en memoria -- es la forma más simple y confiable de que el
// logo/colores nuevos se vean de una en TODA la app (nav, header, botones...), y esto no se usa
// seguido como para que valga la pena evitar ese recargo.
// Peso máximo que deja subir el bucket "logos-iglesias" (ver migración 20261001000100) — se
// comprueba también acá, antes de intentar subir, para un error inmediato en vez de esperar a que
// el servidor lo rechace.
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

const LOGO_TIPOS_VALIDOS = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

// Ajustes → Pantalla de proyección (pedido de Eldin, 2026-10-09): todo lo que depende del tamaño de la
// pantalla de cada iglesia, en un solo lugar. Antes "letra de canciones" vivía en Identidad.
export function PantallaProyeccionModal({ iglesiaId, onClose }) {
  const [cargando, setCargando] = useState(true);
  const [formatoLetra, setFormatoLetra] = useState("dos_lineas");
  const [dividirVersiculos, setDividirVersiculos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("iglesias").select("formato_letra, dividir_versiculos").eq("id", iglesiaId).single()
      .then(({ data }) => {
        if (data) {
          setFormatoLetra(data.formato_letra || "dos_lineas");
          setDividirVersiculos(!!data.dividir_versiculos);
        }
        setCargando(false);
      });
  }, [iglesiaId]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase.from("iglesias").update({ formato_letra: formatoLetra, dividir_versiculos: dividirVersiculos }).eq("id", iglesiaId);
    if (error) { setError(error.message); setBusy(false); return; }
    window.location.reload();
  };

  return (
    <ModalShell title="Pantalla de proyección" icon={Radio} color="var(--wf-brand-accent)" onClose={onClose}>
      {cargando ? (
        <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)" }}>Ajusta cómo se reparte el texto según el tamaño de la pantalla de tu iglesia. Se aplica al proyectar: las canciones y versículos guardados no cambian.</div>
          <Field label="Letra de canciones en pantalla">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {FORMATOS_LETRA.map((f) => {
                const elegido = formatoLetra === f.value;
                const ejemplo = f.value === "dos_lineas" ? ["Eres mi refugio eterno", "mi lugar seguro, Señor"]
                  : f.value === "una_linea_dos_renglones" ? ["Eres mi refugio", "eterno, Señor"] : ["Eres mi refugio eterno, Señor"];
                return (
                  <button
                    key={f.value} type="button" onClick={() => setFormatoLetra(f.value)}
                    style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: 8, borderRadius: 12, cursor: "pointer", background: "var(--wf-card)", border: elegido ? "2px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)" }}
                  >
                    <div style={{ width: 92, height: 52, flexShrink: 0, borderRadius: 8, background: "#0C0E13", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 4, boxSizing: "border-box", textAlign: "center", lineHeight: 1.25, fontSize: f.value === "dos_lineas" ? 7 : f.value === "una_linea" ? 7.5 : 10 }}>
                      {ejemplo.map((l, i) => <div key={i} style={f.value === "una_linea_dos_renglones" && i === 1 ? { fontWeight: 800, textTransform: "uppercase" } : undefined}>{l}</div>)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>{f.label}</div>
                      <div style={{ fontSize: 11, color: "var(--wf-muted)" }}>{f.ayuda}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Versículos largos">
            <button
              type="button" onClick={() => setDividirVersiculos((v) => !v)} aria-pressed={dividirVersiculos}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: 10, borderRadius: 12, cursor: "pointer", background: "var(--wf-card)", border: dividirVersiculos ? "2px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)" }}
            >
              <span style={{ width: 40, height: 24, borderRadius: 12, flexShrink: 0, position: "relative", background: dividirVersiculos ? "var(--wf-brand-accent)" : "var(--wf-border)", transition: "background 0.15s" }}>
                <span style={{ position: "absolute", top: 3, left: dividirVersiculos ? 19 : 3, width: 18, height: 18, borderRadius: 9, background: "#fff", transition: "left 0.15s" }} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--wf-text)" }}>Dividir versículos largos en 2 o 3 partes</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--wf-muted)" }}>Para pantallas chicas: cada parte lleva su "(1/2)" en la cita. Apagado, el versículo se proyecta completo.</span>
              </span>
            </button>
          </Field>
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
        </form>
      )}
    </ModalShell>
  );
}

export function IdentidadIglesiaModal({ iglesiaId, onClose }) {
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [zonaHoraria, setZonaHoraria] = useState("Etc/GMT+6");
  const [logoUrl, setLogoUrl] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#16324F");
  const [colorAcento, setColorAcento] = useState("#E8821E");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [mostrarEnlaceManual, setMostrarEnlaceManual] = useState(false);

  useEffect(() => {
    supabase.from("iglesias").select("nombre, zona_horaria, logo_url, color_primario, color_acento").eq("id", iglesiaId).single()
      .then(({ data }) => {
        if (data) {
          setNombre(data.nombre || "");
          setZonaHoraria(data.zona_horaria || "Etc/GMT+6");
          setLogoUrl(data.logo_url || "");
          setColorPrimario(data.color_primario || "#16324F");
          setColorAcento(data.color_acento || "#E8821E");
        }
        setCargando(false);
      });
  }, [iglesiaId]);

  // Un archivo por iglesia, siempre en la MISMA ruta ("<iglesia_id>/logo.<ext>") — volver a subir
  // reemplaza el anterior (upsert). Como el navegador podría tener cacheada la imagen vieja en esa
  // misma URL, se le agrega "?v=<hora>" al guardar para que SIEMPRE pida la versión nueva.
  const subirLogo = async (file) => {
    if (!LOGO_TIPOS_VALIDOS.includes(file.type)) { setError("El logo debe ser una imagen (PNG, JPG, WEBP o SVG)."); return; }
    if (file.size > LOGO_MAX_BYTES) { setError("El logo no puede pesar más de 2 MB."); return; }
    setSubiendoLogo(true); setError("");
    const ext = file.name.split(".").pop().toLowerCase();
    const ruta = `${iglesiaId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from("logos-iglesias").upload(ruta, file, { upsert: true, contentType: file.type });
    if (uploadError) { setError("No se pudo subir el logo: " + uploadError.message); setSubiendoLogo(false); return; }
    const { data } = supabase.storage.from("logos-iglesias").getPublicUrl(ruta);
    setLogoUrl(`${data.publicUrl}?v=${Date.now()}`);
    setSubiendoLogo(false);
  };

  const HEX_VALIDO = /^#[0-9A-Fa-f]{6}$/;
  const submit = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre no puede quedar vacío."); return; }
    // El selector de color SIEMPRE escribe un hex válido, pero el campo de texto a su lado se puede
    // editar a mano -- un valor inválido ahí (ej. "naranja" en vez de "#E8821E") dejaría ese color
    // sin efecto en TODA la app (var() sin valor válido = transparente), no solo en esta pantalla.
    if (!HEX_VALIDO.test(colorPrimario) || !HEX_VALIDO.test(colorAcento)) {
      setError("Los colores deben ser un código hexadecimal válido, ej. #16324F.");
      return;
    }
    setBusy(true); setError("");
    const { error } = await supabase.from("iglesias").update({
      nombre: nombre.trim(), zona_horaria: zonaHoraria,
      logo_url: logoUrl.trim() || null, color_primario: colorPrimario, color_acento: colorAcento,
    }).eq("id", iglesiaId);
    if (error) { setError(error.message); setBusy(false); return; }
    window.location.reload();
  };

  return (
    <ModalShell title="Identidad de la iglesia" icon={Palette} color="var(--wf-brand-accent)" onClose={onClose}>
      {cargando ? (
        <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 2 }}>
            <AppLogo width={64} logoUrl={logoUrl.trim() || null} />
          </div>
          <Field label="Nombre de la iglesia"><input required value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} /></Field>
          <Field label="Logo (opcional)">
            <label className="hoverable" style={{ ...addBtnStyle, justifyContent: "center", opacity: subiendoLogo ? 0.6 : 1, cursor: subiendoLogo ? "not-allowed" : "pointer" }}>
              <Download size={14} style={{ transform: "rotate(180deg)" }} />
              {subiendoLogo ? "Subiendo…" : logoUrl ? "Cambiar imagen" : "Subir una imagen"}
              <input
                type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={subiendoLogo}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = ""; }}
                style={{ display: "none" }}
              />
            </label>
            <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 4 }}>PNG, JPG, WEBP o SVG — máximo 2 MB. Vacío = trazo genérico de WorshipFlow.</div>
            <button type="button" onClick={() => setMostrarEnlaceManual((v) => !v)} style={{ background: "none", border: "none", color: "var(--wf-muted)", fontSize: 11, textDecoration: "underline", cursor: "pointer", padding: "6px 0 0" }}>
              {mostrarEnlaceManual ? "Ocultar enlace manual" : "O pega un enlace en su lugar"}
            </button>
            {mostrarEnlaceManual && (
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" style={{ ...inputStyle, marginTop: 6 }} />
            )}
          </Field>
          <Field label="Color primario (fondos oscuros: encabezado, navegación)">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--wf-border)", borderRadius: 8, background: "none", cursor: "pointer" }} />
              <input value={colorPrimario} onChange={(e) => setColorPrimario(e.target.value)} style={{ ...inputStyle, flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
            </div>
          </Field>
          <Field label="Color de acento (botones, resaltados)">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="color" value={colorAcento} onChange={(e) => setColorAcento(e.target.value)} style={{ width: 40, height: 36, padding: 2, border: "1px solid var(--wf-border)", borderRadius: 8, background: "none", cursor: "pointer" }} />
              <input value={colorAcento} onChange={(e) => setColorAcento(e.target.value)} style={{ ...inputStyle, flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} />
            </div>
          </Field>
          <Field label="Zona horaria">
            <SelectorZonaHoraria value={zonaHoraria} onChange={setZonaHoraria} estiloCampo={inputStyle} />
          </Field>
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
        </form>
      )}
    </ModalShell>
  );
}

// Ajustes → Zona horaria (2026-11-09): a la vista, sin tener que entrar a "Identidad de la iglesia".
// Se guarda en iglesias.zona_horaria (la base solo acepta zonas válidas). La usan los recordatorios
// automáticos, el tope diario del asistente y qué eventos cuentan como "próximos".
export function ZonaHorariaModal({ iglesiaId, actual, onClose, onGuardada }) {
  const [zona, setZona] = useState(actual || "Etc/GMT+6");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guardar = async () => {
    setBusy(true); setError("");
    const { error: err } = await supabase.from("iglesias").update({ zona_horaria: zona }).eq("id", iglesiaId);
    setBusy(false);
    if (err) { setError(esFalloDeConexion(err) ? "Sin conexión. Inténtalo de nuevo." : "No se pudo guardar la zona horaria."); return; }
    showToast(`Zona horaria: ${etiquetaZona(zona)}`, "info");
    onGuardada?.(zona);
    onClose();
  };
  return (
    <ModalShell title="Zona horaria" icon={Clock} color="#2F5FA8" onClose={onClose}>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", lineHeight: 1.45, marginBottom: 12 }}>
        La hora de tu iglesia: con ella salen los recordatorios de los eventos a la hora correcta. Busca tu país o ciudad.
      </div>
      <SelectorZonaHoraria value={zona} onChange={setZona} estiloCampo={inputStyle} />
      <div style={{ fontSize: 12, color: "var(--wf-text-2)", margin: "10px 2px 12px" }}>
        Hora allí ahora: <b>{horaEnZona(zona)}</b>
      </div>
      {error && <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 8 }}>{error}</div>}
      <button onClick={guardar} disabled={busy || zona === actual} style={{ ...primaryBtn, opacity: busy || zona === actual ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar"}</button>
    </ModalShell>
  );
}

function horaEnZona(zona) {
  try { return new Intl.DateTimeFormat("es", { timeZone: zona, hour: "numeric", minute: "2-digit", weekday: "long" }).format(new Date()); } catch { return "—"; }
}

export function ChangePasswordModal({ onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    { const err = validarPassword(password); if (err) { setError(err); return; } }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  };

  return (
    <ModalShell title="Cambiar contraseña" icon={KeyRound} color="var(--wf-heading)" onClose={onClose}>
      {done ? (
        <div style={{ fontSize: 13, color: "#1F8A73", fontWeight: 700 }}>Contraseña actualizada correctamente.</div>
      ) : (
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="password" required placeholder="Nueva contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} autoFocus autoComplete="new-password" />
          <MedidorPassword password={password} />
          <input type="password" required placeholder="Confirmar contraseña" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={inputStyle} />
          {error && <div style={{ fontSize: 12, color: "#C23B32" }}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
        </form>
      )}
    </ModalShell>
  );
}

// Subir una imagen/video de fondo + elegir entre lo ya subido antes -- reemplaza el patrón viejo de
// "subir = FileReader.readAsDataURL" (guardaba el archivo entero como texto base64 dentro del propio
// registro, pesadísimo y sin forma de reutilizarlo). Ahora sube a Supabase Storage (lib/multimedia.js)
// y la galería de abajo deja elegir cualquier archivo ya subido antes por esta iglesia, sin resubirlo.
export function MediaPicker({ iglesiaId, tipo, value, onChange, color = "#B15EA0" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef(null);

  const cargar = () => {
    if (!iglesiaId) return;
    setLoading(true);
    listarFondos(iglesiaId, tipo).then(setItems).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    if (showGallery) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGallery, iglesiaId, tipo]);

  const subir = async (file) => {
    if (!file || !iglesiaId) return;
    setUploading(true); setError("");
    try {
      const url = await subirFondo(iglesiaId, tipo, file);
      onChange(url);
      setShowGallery(true);
      cargar();
    } catch (e) {
      setError(e.message || "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  };

  const eliminar = async (item, e) => {
    e.stopPropagation();
    if (!(await confirmDialog(`¿Quitar "${item.nombre}" de la biblioteca? Donde ya esté puesto como fondo no cambia, pero ya no se podrá volver a elegir.`, { danger: true, textoConfirmar: "Quitar" }))) return;
    try {
      await borrarFondo(item.ruta);
      setItems((its) => its.filter((i) => i.ruta !== item.ruta));
    } catch (err) {
      notifyError("No se pudo quitar el archivo", err);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="hoverable" style={{ ...addBtnStyle, flex: 1, opacity: uploading ? 0.6 : 1 }}>
          {value ? (
            tipo === "imagen"
              ? <span style={{ width: 16, height: 16, borderRadius: 8, backgroundImage: `url(${value})`, backgroundSize: "cover", backgroundPosition: "center", flexShrink: 0 }} />
              : <Play size={13} color={color} />
          ) : tipo === "imagen" ? <ImgIcon size={13} color="var(--wf-faint)" /> : <Play size={13} color="var(--wf-faint)" />}
          <span>{uploading ? "Subiendo…" : value ? "Cambiar — tocar para subir otro" : `Subir ${tipo === "imagen" ? "imagen" : "video"} nuevo`}</span>
        </button>
        <button type="button" onClick={() => setShowGallery((s) => !s)} className="hoverable" title="Elegir de lo ya subido antes" style={{ ...addBtnStyle, width: "auto", padding: "0 12px", whiteSpace: "nowrap" }}>
          <LayoutGrid size={13} color={color} /> Biblioteca
        </button>
      </div>
      <input ref={fileInputRef} type="file" accept={tipo === "imagen" ? "image/*" : "video/*"} style={{ display: "none" }} onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
      {error && <div style={{ fontSize: 11, color: "#C23B32", marginTop: 6 }}>{error}</div>}
      {showGallery && (
        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 8, maxHeight: 220, overflowY: "auto", background: "var(--wf-hover)", borderRadius: 12, padding: 8 }}>
          {loading && <div style={{ fontSize: 11, color: "var(--wf-faint)", gridColumn: "1/-1" }}>Cargando…</div>}
          {!loading && items.length === 0 && <div style={{ fontSize: 11, color: "var(--wf-faint)", gridColumn: "1/-1" }}>Todavía no hay {tipo === "imagen" ? "imágenes" : "videos"} guardados — sube el primero arriba.</div>}
          {items.map((item) => (
            <div key={item.ruta} onClick={() => onChange(item.url)} title={item.nombre} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "#000", border: value === item.url ? `2px solid ${color}` : "1px solid var(--wf-border)" }}>
              {tipo === "imagen" ? (
                <div style={{ width: "100%", height: "100%", backgroundImage: `url(${item.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
              ) : (
                <video src={item.url} muted preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
              <button type="button" onClick={(e) => eliminar(item, e)} title="Quitar de la biblioteca" style={{ position: "absolute", top: 2, right: 2, width: 18, height: 18, borderRadius: 9, border: "none", background: "rgba(0,0,0,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}><Trash2 size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Qué se detectó en el enlace pegado, o por qué no se va a poder reproducir (2026-11-08).
export function AvisoEnlaceVideo({ url }) {
  const aviso = url && /^https?:/i.test(url) ? avisoDeEnlace(url) : null;
  if (!aviso) return null;
  return <div style={{ fontSize: 11.5, fontWeight: 600, color: aviso.ok ? "#1F8A73" : "#C23B32", marginBottom: 8, lineHeight: 1.4 }}>{aviso.texto}</div>;
}

// Agregar un video al Setlist para planificarlo (pedido de Eldin, 2026-11-08): enlace de YouTube/Vimeo/
// .mp4 o un archivo subido, más un nombre para reconocerlo en el orden del culto. Se proyecta como video
// solo: a pantalla completa y con sonido. Queda como una diapositiva de video (type "slide", bgType
// "video"), así que se edita, mueve y proyecta como cualquier otra.
export function VideoModal({ onClose, onAdd, iglesiaId, inicial = null, destino = null }) {
  const [url, setUrl] = useState(inicial?.videoUrl || "");
  const [nombre, setNombre] = useState(inicial?.name && inicial.name !== "Video" ? inicial.name : "");
  // Un video ya subido (no es un enlace de YouTube/Vimeo) se abre en "subir", para verlo y cambiarlo.
  const [subir, setSubir] = useState(!!url && !/youtu|vimeo/i.test(url));
  const aviso = url ? avisoDeEnlace(url) : null;
  const puede = !!url && aviso?.ok !== false;
  return (
    <ModalShell title={inicial ? "Editar video" : "Agregar video al setlist"} icon={Play} color="#C23B32" onClose={onClose}>
      {destino && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>{destino}</div>}
      <label style={etiquetaCampo}>Enlace de YouTube</label>
      {!subir ? (
        <>
          <input autoFocus inputMode="url" placeholder="Pega aquí el enlace de YouTube" value={url} onChange={(e) => setUrl(e.target.value.trim())} style={{ ...inputStyle, marginBottom: 6 }} />
          <AvisoEnlaceVideo url={url} />
          <button type="button" onClick={() => { setSubir(true); setUrl(""); }} style={{ background: "none", border: "none", padding: 0, fontSize: 12, fontWeight: 600, color: "#2F5FA8", cursor: "pointer" }}>¿El video no está en YouTube? Súbelo desde tu equipo</button>
        </>
      ) : (
        <>
          <MediaPicker iglesiaId={iglesiaId} tipo="video" value={url} onChange={(u) => setUrl(u)} color="#C23B32" />
          <button type="button" onClick={() => { setSubir(false); setUrl(""); }} style={{ background: "none", border: "none", padding: 0, marginTop: 8, fontSize: 12, fontWeight: 600, color: "#2F5FA8", cursor: "pointer" }}>Mejor pegar un enlace de YouTube</button>
        </>
      )}
      <label style={{ ...etiquetaCampo, marginTop: 14 }}>Nombre · así sale en el orden del culto</label>
      <input placeholder='Ej. "Testimonio de Juan" o "Video de misiones"' value={nombre} onChange={(e) => setNombre(e.target.value)} style={inputStyle} />
      <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Queda en el orden del culto. Cuando lo toques en la consola sale a pantalla completa, empieza solo y con sonido; lo pausas, detienes o adelantas con los botones debajo de la vista previa.</div>
      <button onClick={() => puede && onAdd({ videoUrl: url, name: nombre.trim() || "Video" })} disabled={!puede} style={{ ...primaryBtn, marginTop: 14, opacity: puede ? 1 : 0.5 }}>{inicial ? "Guardar cambios" : "Agregar al setlist"}</button>
    </ModalShell>
  );
}

const etiquetaCampo = { display: "block", fontSize: 11.5, fontWeight: 800, color: "var(--wf-text)", marginBottom: 6, letterSpacing: 0.2 };

export function SlideModal({ draft, setDraft, onClose, onAdd, title = "Diapositiva de texto", submitLabel = "Agregar al culto", iglesiaId }) {
  const bgOptions = ["#1B2029", "#2A1F33", "#1F2A2C", "#332420"];
  const bgType = draft.bgType || "color";
  return (
    <ModalShell title={title} icon={ImgIcon} color="#B15EA0" onClose={onClose}>
      {/* Textarea, no input: para un texto largo se puede tocar Enter y armar el salto de línea a mano
          (dónde se corta cada línea en la proyección), en vez de dejarlo todo al ajuste automático. */}
      {/* Contenido (lo que se proyecta) separado del NOMBRE (cómo aparece en la lista y en la miniatura)
          — pedido de Eldin, 2026-10-11, para que no se confundan. */}
      <label style={etiquetaCampo}>Contenido · lo que se ve en la pantalla</label>
      <textarea placeholder="Escribe el texto que se va a proyectar (Enter para cambiar de línea). Opcional si es solo imagen o video." value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={{ ...inputStyle, height: 80, resize: "none" }} />
      <textarea placeholder="Texto pequeño debajo (opcional)" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} style={{ ...inputStyle, height: 44, resize: "none", marginTop: 8 }} />
      {(draft.subtitle || "").trim() && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 2 }}>
            <span>Tamaño del texto pequeño (comparado con el contenido)</span><b>{Math.round((draft.escalaSubtitulo ?? 0.65) * 100)}%</b>
          </div>
          <input type="range" min={0.4} max={0.9} step={0.05} value={draft.escalaSubtitulo ?? 0.65} onChange={(e) => setDraft({ ...draft, escalaSubtitulo: parseFloat(e.target.value) })} style={{ width: "100%", accentColor: "var(--wf-brand-accent)" }} />
        </div>
      )}
      <label style={{ ...etiquetaCampo, marginTop: 14 }}>Nombre de la diapositiva · no se proyecta</label>
      <input placeholder={`Ej. "Anuncio de ayuno" — así sale en el orden del culto y en la miniatura`} value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
      <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 5 }}>Si lo dejas vacío, se usa el contenido como nombre.</div>
      <div style={{ fontSize: 11, color: "var(--wf-muted)", fontWeight: 700, margin: "14px 0 8px" }}>FONDO</div>
      <div style={{ display: "flex", gap: 3, background: "var(--wf-hover)", padding: 3, borderRadius: 12, marginBottom: 10, width: "fit-content" }}>
        {[["color", "Color"], ["imagen", "Imagen"], ["video", "Video"]].map(([val, label]) => (
          <button key={val} onClick={() => setDraft({ ...draft, bgType: val })} style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: bgType === val ? "var(--wf-brand-accent)" : "transparent", color: bgType === val ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>{label}</button>
        ))}
      </div>
      {bgType === "color" && (
        <div style={{ display: "flex", gap: 8 }}>
          {bgOptions.map((c) => (<button key={c} onClick={() => setDraft({ ...draft, bg: c })} style={{ width: 34, height: 34, borderRadius: 12, background: c, border: draft.bg === c ? "2px solid var(--wf-brand-accent)" : "1px solid var(--wf-border)", cursor: "pointer" }} />))}
        </div>
      )}
      {bgType === "imagen" && (
        <div>
          <MediaPicker iglesiaId={iglesiaId} tipo="imagen" value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} />
          <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Se estira para cubrir toda la pantalla. Si dejas el título vacío, se proyecta a pantalla completa sin texto encima.</div>
        </div>
      )}
      {bgType === "video" && (
        <div>
          {/* El filtro !startsWith("http") es solo para no mostrar un video base64 viejo (de antes de
              este cambio) hecho ilegible dentro de este campo de texto -- uno nuevo (subido o elegido de
              la biblioteca) siempre es una URL https:// real, así que nunca lo oculta. */}
          <input placeholder="Pega un enlace de YouTube, Vimeo o un .mp4" value={draft.videoUrl && !draft.videoUrl.startsWith("http") ? "" : draft.videoUrl || ""} onChange={(e) => setDraft({ ...draft, videoUrl: e.target.value.trim() })} style={{ ...inputStyle, marginBottom: 6 }} />
          <AvisoEnlaceVideo url={draft.videoUrl} />
          <MediaPicker iglesiaId={iglesiaId} tipo="video" value={draft.videoUrl} onChange={(url) => setDraft({ ...draft, videoUrl: url })} />
          <div style={{ fontSize: 11, color: "var(--wf-faint)", marginTop: 6 }}>Con el contenido vacío se proyecta como video, a pantalla completa y <b>con sonido</b>. Con texto encima queda de fondo, sin sonido y en bucle.</div>
        </div>
      )}
      <button onClick={onAdd} style={{ ...primaryBtn, marginTop: 14 }}>{submitLabel}</button>
    </ModalShell>
  );
}
