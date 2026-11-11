// Asistente con IA (chat). Separado de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState, useRef, useEffect } from "react";
import { obtenerReglasAsistente, guardarReglasAsistente, enviarMensajeAsistente, aplicarPlanAsistente, obtenerUsoAsistente } from "../lib/asistente.js";
import { ClipboardList, X, Paperclip, Send } from "lucide-react";
import { iconGhost, ModalShell, inputStyle, primaryBtn } from "./compartido.jsx";

// ---------------- MINISTERIOS ----------------
// Reduce una foto (puede venir pesada directo de la cámara del celular) antes de mandarla al
// asistente — 1568px del lado más largo es el tamaño que igual usa internamente el modelo de
// visión, mandarla más grande solo gasta más y tarda más sin ganar nada de lectura.
// Una foto de celular reducida a 1568px/calidad alta TODAVÍA puede pesar varios MB (fotos con mucho
// detalle, o el celular que sea) — más grande de lo que el servidor acepta, y eso corta la conexión
// ANTES de que llegue cualquier respuesta ("Failed to fetch" críptico, en vez de un error claro).
// Por eso se intenta en pasos cada vez más chicos hasta quedar bajo un tamaño seguro, en vez de un
// solo intento con la esperanza de que alcance.
function reducirImagenParaAsistente(file) {
  const intentos = [
    { maxDim: 1400, calidad: 0.75 },
    { maxDim: 1100, calidad: 0.6 },
    { maxDim: 850, calidad: 0.5 },
    { maxDim: 650, calidad: 0.4 },
  ];
  const LIMITE_BASE64 = 2_500_000; // deja margen bajo el límite real del servidor
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.onload = () => {
        let ultimo = null;
        for (const { maxDim, calidad } of intentos) {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const escala = maxDim / Math.max(width, height);
            width = Math.round(width * escala);
            height = Math.round(height * escala);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", calidad);
          const data = dataUrl.split(",")[1];
          ultimo = { mediaType: "image/jpeg", data, previewUrl: dataUrl };
          if (data.length <= LIMITE_BASE64) { resolve(ultimo); return; }
        }
        reject(new Error("Esta foto sigue pesando mucho incluso reducida — intenta recortarla o mandar una más chica."));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Asistente de chat admin-only: en vez de que alguien escriba directo a la base de datos por fuera
// de la app (el riesgo real: se le olvida un recordatorio, o deja a alguien sin usuario_id
// enlazado — invisible para siempre a las notificaciones, sin ningún indicio en pantalla), el
// modelo arma un plan y este SOLO se guarda cuando el admin toca "Aplicar" — ver
// supabase/functions/asistente-chat/index.ts para la ejecución real (determinista, sin IA de por
// medio) y la auto-verificación de lo que acaba de escribir.
export function AsistenteChatScreen() {
  const [messages, setMessages] = useState([]); // [{role:'user'|'assistant', content}]
  const [input, setInput] = useState("");
  const [pendingPlan, setPendingPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  // Tope diario de mensajes de la iglesia (2026-11-03): { usados, limite } o null si no hay tope.
  const [uso, setUso] = useState(null);
  useEffect(() => { let vivo = true; obtenerUsoAsistente().then((u) => { if (vivo) setUso(u); }); return () => { vivo = false; }; }, []);
  const agotado = !!uso && uso.usados >= uso.limite;

  // Reglas/excepciones fijas: a diferencia de la conversación (que se borra al salir de esta
  // pantalla), esto vive en Supabase y el asistente lo lee SIEMPRE, en cada mensaje — así no hay
  // que repetírselas cada vez ("en Multimedia, cuando el domingo caiga en fin de mes va Fulano...").
  const [showReglas, setShowReglas] = useState(false);
  const [reglasTexto, setReglasTexto] = useState("");
  const [reglasLoading, setReglasLoading] = useState(false);
  const [reglasSaving, setReglasSaving] = useState(false);
  const abrirReglas = () => {
    setShowReglas(true);
    setReglasLoading(true);
    obtenerReglasAsistente().then((res) => setReglasTexto(res.reglas || "")).catch((e) => setError(e.message)).finally(() => setReglasLoading(false));
  };
  const guardarReglas = () => {
    setReglasSaving(true);
    guardarReglasAsistente(reglasTexto).then(() => setShowReglas(false)).catch((e) => setError(e.message)).finally(() => setReglasSaving(false));
  };

  // Foto adjunta al PRÓXIMO mensaje (ej. una lista de canciones escrita a mano) — solo viaja una
  // vez, en el mensaje en el que se manda; los turnos siguientes del historial vuelven a ser texto
  // plano nada más (ver enviarMensajeAsistente).
  const [pendingImage, setPendingImage] = useState(null); // { mediaType, data, previewUrl } | null
  const [imageError, setImageError] = useState("");
  const fileInputRef = useRef(null);
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!file) return;
    setImageError("");
    try {
      setPendingImage(await reducirImagenParaAsistente(file));
    } catch (err) {
      setImageError(err.message || "No se pudo leer la imagen.");
    }
  };

  const send = async () => {
    const texto = input.trim();
    if ((!texto && !pendingImage) || loading || pendingPlan || agotado) return;
    const imagenParaEnviar = pendingImage;
    const nuevoHistorial = [...messages, { role: "user", content: texto || "(imagen adjunta)", imagePreviewUrl: imagenParaEnviar?.previewUrl }];
    setMessages(nuevoHistorial);
    setInput("");
    setPendingImage(null);
    setError("");
    setLoading(true);
    try {
      const res = await enviarMensajeAsistente(nuevoHistorial, imagenParaEnviar ? { mediaType: imagenParaEnviar.mediaType, data: imagenParaEnviar.data } : null);
      if (res.uso) setUso(res.uso);
      // El plan crudo (tool_use) nunca se vuelve a mandar a Claude tal cual — solo su resumen en
      // texto, así el historial que ve el modelo siempre es texto plano simple.
      if (res.tipo === "plan") {
        setPendingPlan(res.plan);
        setMessages((ms) => [...ms, { role: "assistant", content: res.resumen }]);
      } else {
        setMessages((ms) => [...ms, { role: "assistant", content: res.texto }]);
      }
    } catch (e) {
      if (e.datos?.limiteDiario) {
        // Llegaron al tope de hoy: se dice como un mensaje del asistente, no como un error.
        if (e.datos.uso) setUso(e.datos.uso);
        setMessages((ms) => [...ms, { role: "assistant", content: e.message }]);
      } else {
        setError(e.message || "No se pudo hablar con el asistente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmarPlan = async () => {
    if (!pendingPlan) return;
    setApplying(true);
    setError("");
    try {
      const res = await aplicarPlanAsistente(pendingPlan);
      const partes = [res.resumen];
      if (res.notificados?.length) partes.push(`Se notificó a: ${res.notificados.join(", ")}.`);
      if (res.avisos?.length) partes.push(...res.avisos.map((a) => `⚠️ ${a}`));
      setMessages((ms) => [...ms, { role: "assistant", content: partes.join("\n") }]);
      setPendingPlan(null);
    } catch (e) {
      setError(e.message || "No se pudo aplicar el plan.");
    } finally {
      setApplying(false);
    }
  };

  const cancelarPlan = () => {
    setPendingPlan(null);
    setMessages((ms) => [...ms, { role: "assistant", content: "Plan cancelado. ¿Qué quieres que cambie?" }]);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div>
          <h2 style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.02em", fontSize: 22, margin: 0 }}>Asistente</h2>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 4 }}>Puede crear, editar, borrar o duplicar eventos, su setlist y quién queda a cargo — antes de guardar (o borrar) nada, siempre te muestra el plan para que lo confirmes.</div>
        </div>
        <button onClick={abrirReglas} style={{ ...iconGhost, width: "auto", gap: 6, padding: "6px 10px", background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 10, flexShrink: 0 }}>
          <ClipboardList size={14} /> <span style={{ fontSize: 12, fontWeight: 600 }}>Reglas</span>
        </button>
      </div>

      {showReglas && (
        <ModalShell title="Reglas fijas del asistente" icon={ClipboardList} color="var(--wf-brand-accent)" onClose={() => setShowReglas(false)}>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 10 }}>
            Excepciones y reglas que el asistente debe aplicar SIEMPRE, sin que se las repitas en cada conversación — ej. "en Multimedia, el primer domingo de cada mes va Juan en vez de María". Se guardan aparte de la conversación.
          </div>
          {reglasLoading ? (
            <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div>
          ) : (
            <>
              <textarea
                value={reglasTexto}
                onChange={(e) => setReglasTexto(e.target.value)}
                rows={10}
                placeholder="Ej. Multimedia: los domingos PM siempre va Carlos. Excepto la última semana del mes, que va Ana..."
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              />
              <button onClick={guardarReglas} disabled={reglasSaving} style={{ ...primaryBtn, marginTop: 12, opacity: reglasSaving ? 0.6 : 1 }}>{reglasSaving ? "Guardando…" : "Guardar reglas"}</button>
            </>
          )}
        </ModalShell>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "12px 2px" }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--wf-faint)", textAlign: "center", marginTop: 30 }}>
            Ej. "Crea el culto del domingo 20 de octubre a las 10am, agrega [canción] y pon a [nombre] en Piano." También puedes adjuntar una foto (ej. una lista de canciones escrita a mano) con el clip de abajo.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "80%", padding: "10px 14px", borderRadius: 16,
              background: m.role === "user" ? "var(--wf-brand-primary)" : "var(--wf-card)",
              color: m.role === "user" ? "#fff" : "var(--wf-text)",
              boxShadow: m.role === "user" ? "none" : "0 3px 14px rgba(22,50,79,0.09)",
              whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.45,
            }}>
              {m.imagePreviewUrl && <img src={m.imagePreviewUrl} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: m.content ? 8 : 0, display: "block" }} />}
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 12, color: "var(--wf-faint)" }}>Pensando…</div>}

        {pendingPlan && (
          <div style={{ background: "var(--wf-card)", border: "1px solid color-mix(in srgb, var(--wf-brand-accent) 33%, transparent)", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(22,50,79,0.08)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-brand-accent)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Plan propuesto — todavía no se guardó nada</div>
            <div style={{ fontSize: 13, marginBottom: 12, whiteSpace: "pre-wrap" }}>{pendingPlan.resumen}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={confirmarPlan} disabled={applying} style={{ ...primaryBtn, width: "auto", flex: 1, opacity: applying ? 0.6 : 1 }}>{applying ? "Aplicando…" : "Aplicar"}</button>
              <button onClick={cancelarPlan} disabled={applying} style={{ ...primaryBtn, width: "auto", flex: 1, background: "var(--wf-hover)", color: "var(--wf-text)" }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {(error || imageError) && <div style={{ fontSize: 12, color: "#C23B32", marginBottom: 8 }}>{error || imageError}</div>}

      {pendingImage && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "var(--wf-hover)", borderRadius: 12, padding: 6 }}>
          <img src={pendingImage.previewUrl} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
          <div style={{ fontSize: 12, color: "var(--wf-muted)", flex: 1 }}>Imagen lista para mandar</div>
          <button onClick={() => setPendingImage(null)} style={{ ...iconGhost, width: 24, height: 24 }}><X size={14} /></button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, paddingTop: 8 }}>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
        <button onClick={() => fileInputRef.current?.click()} disabled={loading || !!pendingPlan} style={{ ...iconGhost, width: 40, height: 40, background: "var(--wf-hover)", border: "1px solid var(--wf-border)", opacity: (loading || !!pendingPlan) ? 0.4 : 1, flexShrink: 0 }} title="Adjuntar foto">
          <Paperclip size={17} />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading || !!pendingPlan || agotado}
          placeholder={agotado ? "Se acabaron los mensajes de hoy — vuelve mañana" : pendingPlan ? "Confirma o cancela el plan de arriba primero…" : "Escribe qué quieres armar, o adjunta una foto…"}
          rows={1}
          style={{ ...inputStyle, resize: "none", flex: 1 }}
        />
        <button onClick={send} disabled={loading || !!pendingPlan || agotado || (!input.trim() && !pendingImage)} style={{ ...iconGhost, width: 40, height: 40, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: (loading || !!pendingPlan || (!input.trim() && !pendingImage)) ? 0.4 : 1 }}>
          <Send size={17} />
        </button>
      </div>
      {uso && (
        <div style={{ fontSize: 11.5, color: agotado ? "#C23B32" : uso.limite - uso.usados <= 5 ? "var(--wf-brand-accent)" : "var(--wf-faint)", textAlign: "right", paddingTop: 6 }}>
          {agotado
            ? `Llegaron al límite de hoy (${uso.limite} mensajes). Se renueva a medianoche.`
            : `Te ${uso.limite - uso.usados === 1 ? "queda 1 mensaje" : `quedan ${uso.limite - uso.usados} mensajes`} hoy (de ${uso.limite}).`}
        </div>
      )}
    </div>
  );
}
