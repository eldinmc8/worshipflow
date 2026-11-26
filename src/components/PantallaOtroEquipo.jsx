import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, MessageCircle, MonitorSmartphone, RefreshCw, Clock, Tv, Smartphone, Video, Lock } from "lucide-react";
import { usePlan, tiene, abrirPlanes, nombrePlanRequerido } from "../lib/planes.js";
import qrcode from "qrcode-generator";
import { supabase } from "../lib/supabaseClient.js";
import { enlacePantalla, enlaceEscenario, enlaceTransmision } from "../lib/enlacePantalla.js";
import { obtenerCodigoPantalla, renovarCodigoPantalla } from "../lib/liveSession.js";
import { vincularTv, direccionTv } from "../lib/conectarTv.js";

import { useCerrarConAtras } from "../lib/atras.js";
// "Pantallas y TV" (todo en una sola opción de Ajustes, 2026-11-02): conectar un Smart TV o caja con un
// número de 6 dígitos, o abrir en celular/tablet/computadora con QR y enlace. Antes "Pantalla en otro
// equipo" (pedido de Eldin, 2026-10-18): la proyección se puede abrir en cualquier
// TV, tablet o computadora con navegador y se sincroniza sola por internet. Aquí se muestra el enlace
// corto de la iglesia (/p/<slug>) para copiarlo, mandarlo por WhatsApp o escanearlo con el QR.
// tipo "escenario" (2026-11-01): lo mismo para la Pantalla de escenario (/e/<slug>), el monitor de la plataforma.
export default function PantallaOtroEquipo({ iglesiaId, slug: slugInicial, onCerrar, tipo: tipoInicial = "proyeccion" }) {
  useCerrarConAtras(true, onCerrar); // atrás del teléfono cierra esta ventana (ver lib/atras.js)
  // Se puede cambiar entre las dos pantallas desde aquí mismo (Proyección · Escenario).
  // "transmision" (2026-11-20): la salida para OBS, con fondo transparente y la letra en una franja.
  const [tipo, setTipo] = useState(tipoInicial === "escenario" || tipoInicial === "transmision" ? tipoInicial : "proyeccion");
  const esEscenario = tipo === "escenario";
  const esTransmision = tipo === "transmision";
  // Escenario y OBS: desde el plan Ministerio (Eldin, 2026-11-26). La proyección normal y la TV, en todos.
  const extrasOk = tiene(usePlan(), "pantallas_extra");
  const bloqueada = tipo !== "proyeccion" && !extrasOk;
  // Código secreto que va en el enlace (vence solo al finalizar cada transmisión). undefined = cargando;
  // null = la base todavía no lo tiene (enlace de siempre, sin código).
  const [codigo, setCodigo] = useState(undefined);
  const [renovando, setRenovando] = useState(false);
  const [avisoRenovar, setAvisoRenovar] = useState("");
  useEffect(() => { let vivo = true; obtenerCodigoPantalla().then((c) => { if (vivo) setCodigo(c); }); return () => { vivo = false; }; }, []);
  const renovar = async () => {
    setRenovando(true); setAvisoRenovar("");
    try { setCodigo(await renovarCodigoPantalla()); setCopiado(false); setAvisoRenovar("Listo: las pantallas abiertas se desconectan. Vuelve a conectarlas con el número o el QR nuevo."); }
    catch { setAvisoRenovar("Solo Multimedia o un administrador puede renovar el enlace."); }
    finally { setRenovando(false); }
  };
  const [slug, setSlug] = useState(slugInicial || null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (slug || !iglesiaId) return;
    supabase.from("iglesias").select("slug").eq("id", iglesiaId).single().then(({ data }) => { if (data?.slug) setSlug(data.slug); });
  }, [slug, iglesiaId]);
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const enlace = esTransmision ? enlaceTransmision(slug, origen, codigo) : esEscenario ? enlaceEscenario(slug, origen, codigo) : enlacePantalla(slug, origen, codigo);
  const svgQr = useMemo(() => {
    if (!slug || codigo === undefined) return "";
    const qr = qrcode(0, "M");
    qr.addData(enlace);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [enlace, slug, codigo]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2200); }
    catch { window.prompt?.("Copia este enlace:", enlace); }
  };
  const textoWhatsApp = esEscenario
    ? `Pantalla de escenario de WorshipFlow (para el monitor de la plataforma) — ábrela en el TV o tablet y toca la pantalla una vez para ponerla completa:\n${enlace}`
    : `Pantalla de proyección de WorshipFlow — ábrela en el TV, tablet o computadora y toca la pantalla una vez para ponerla completa:\n${enlace}`;

  // ---- Conectar un TV con el número de 6 dígitos (ver ConectarTv.jsx) ----
  const [numeroTv, setNumeroTv] = useState("");
  const [conectandoTv, setConectandoTv] = useState(false);
  const [resultadoTv, setResultadoTv] = useState(null); // { ok, texto }
  const conectarTv = async () => {
    setConectandoTv(true); setResultadoTv(null);
    try {
      await vincularTv(numeroTv, tipo);
      setResultadoTv({ ok: true, texto: `¡Listo! El TV se está abriendo con la ${esEscenario ? "pantalla de escenario" : "proyección"}.` });
      setNumeroTv("");
    } catch (e) {
      setResultadoTv({ ok: false, texto: e.message });
    } finally {
      setConectandoTv(false);
    }
  };
  const dirTv = direccionTv(origen).replace(/^https?:\/\//, "");

  const boton = { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", flex: 1, fontFamily: "inherit" };
  const tarjeta = { background: "var(--wf-card)", borderRadius: 16, padding: 14, boxShadow: "0 1px 3px rgba(22,50,79,0.08)", marginBottom: 12 };
  const tituloTarjeta = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--wf-heading)", marginBottom: 8 };
  const paso = { display: "flex", gap: 8, fontSize: 12.5, color: "var(--wf-text)", lineHeight: 1.5, marginBottom: 8 };
  const numPaso = { width: 20, height: 20, borderRadius: 10, background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 };
  return createPortal(
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,16,28,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Pantallas y TV" onClick={(e) => e.stopPropagation()} style={{ width: "min(480px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--wf-bg, #F4F6FA)", borderRadius: 18, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--wf-brand-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MonitorSmartphone size={18} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--wf-heading)", flex: 1 }}>Pantallas y TV</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--wf-muted)", display: "flex" }}><X size={18} /></button>
        </div>
        <div role="tablist" aria-label="Qué pantalla abrir" style={{ display: "flex", gap: 4, background: "var(--wf-hover)", borderRadius: 12, padding: 4, marginBottom: 10 }}>
          {[["proyeccion", "Proyección", "Para la congregación"], ["escenario", "Escenario", "Para la plataforma"], ["transmision", "Transmisión", "Para OBS"]].map(([clave, titulo, sub]) => (
            <button key={clave} type="button" role="tab" aria-selected={tipo === clave} onClick={() => { setTipo(clave); setCopiado(false); setResultadoTv(null); }}
              style={{ flex: 1, border: "none", borderRadius: 9, padding: "7px 8px", cursor: "pointer", fontFamily: "inherit", background: tipo === clave ? "var(--wf-brand-accent)" : "transparent", color: tipo === clave ? "var(--wf-on-brand-accent)" : "var(--wf-text)" }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontSize: 13, fontWeight: 700 }}>{clave !== "proyeccion" && !extrasOk && <Lock size={11} />}{titulo}</span>
              <span style={{ display: "block", fontSize: 10.5, opacity: 0.8 }}>{sub}</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--wf-muted)", lineHeight: 1.5, margin: "0 0 12px" }}>
          {esTransmision
            ? "Para poner la letra encima de la cámara en OBS. Tiene su propio tamaño y no cambia la pantalla del templo."
            : esEscenario
            ? "El monitor del escenario: la letra al aire, lo que sigue, la siguiente canción y tus mensajes."
            : "Lo mismo que ve la congregación. Cambia solo, sin iniciar sesión."}
        </p>

        {bloqueada && (
          <div style={{ ...tarjeta, textAlign: "center" }}>
            <div style={{ ...tituloTarjeta, justifyContent: "center" }}><Lock size={17} color="var(--wf-brand-accent)" /> Plan {nombrePlanRequerido("pantallas_extra")} o superior</div>
            <p style={{ fontSize: 12.5, color: "var(--wf-text-2)", lineHeight: 1.5, margin: "0 0 12px" }}>
              {esTransmision ? "La letra para OBS" : "La pantalla de escenario"} es parte del plan {nombrePlanRequerido("pantallas_extra")}. En el plan Gratis puedes usar la proyección normal y la TV.
            </p>
            <button type="button" onClick={() => { onCerrar?.(); abrirPlanes(); }} style={{ ...boton, width: "100%", border: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)" }}>Ver planes</button>
          </div>
        )}

        {!bloqueada && esTransmision && (
          <div style={tarjeta}>
            <div style={tituloTarjeta}><Video size={17} color="var(--wf-brand-accent)" /> En OBS (o Streamlabs)</div>
            <div style={paso}><span style={numPaso}>1</span><span>Copia este enlace:</span></div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-heading)", background: "var(--wf-bg, #F4F6FA)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "9px 12px", wordBreak: "break-all", userSelect: "all", marginBottom: 8 }}>{enlace}</div>
            <button type="button" onClick={copiar} style={{ ...boton, width: "100%", marginBottom: 10 }}>{copiado ? <Check size={16} color="#1F8A73" /> : <Copy size={16} />}{copiado ? "Copiado" : "Copiar enlace"}</button>
            <div style={paso}><span style={numPaso}>2</span><span>En OBS agrega una fuente <b>Navegador</b>, pega el enlace y pon el ancho y alto de tu transmisión (por ejemplo 1920 × 1080).</span></div>
            <div style={paso}><span style={numPaso}>3</span><span>Ponla encima de la cámara <b>sin achicarla</b>: el fondo es transparente y solo sale la letra.</span></div>
            {codigo && <div style={{ fontSize: 11.5, color: "var(--wf-text)", lineHeight: 1.5, marginBottom: 6 }}><b>Antes de cada culto</b> vuelve a copiar el enlace: cambia cada vez que se finaliza la transmisión. En OBS, doble clic en la fuente y pega el nuevo.</div>}
            <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5 }}>El tamaño de la letra, si sale abajo o arriba y la franja oscura se cambian en la consola, pestaña <b>Estilo → Transmisión (OBS)</b>.</div>
          </div>
        )}

        {/* 1. Smart TV: número de 6 dígitos */}
        {!bloqueada && !esTransmision && <div style={tarjeta}>
          <div style={tituloTarjeta}><Tv size={17} color="var(--wf-brand-accent)" /> En un Smart TV</div>
          <div style={paso}><span style={numPaso}>1</span><span>En el navegador del TV abre <b style={{ color: "var(--wf-heading)" }}>{dirTv}</b> (guárdala en favoritos: es siempre la misma).</span></div>
          <div style={paso}><span style={numPaso}>2</span><span>Escribe aquí el número que aparece en el TV:</span></div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={numeroTv} onChange={(e) => { setNumeroTv(e.target.value.replace(/\D/g, "").slice(0, 6)); setResultadoTv(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && numeroTv.length === 6) conectarTv(); }}
              inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label="Número que aparece en el TV"
              style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 700, letterSpacing: 6, textAlign: "center", fontVariantNumeric: "tabular-nums", background: "var(--wf-bg, #F4F6FA)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "8px 10px", color: "var(--wf-heading)", outline: "none", fontFamily: "inherit" }}
            />
            <button type="button" onClick={conectarTv} disabled={numeroTv.length !== 6 || conectandoTv}
              style={{ ...boton, flex: "none", border: "none", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", opacity: numeroTv.length === 6 && !conectandoTv ? 1 : 0.5 }}>
              {conectandoTv ? "Conectando…" : "Conectar"}
            </button>
          </div>
          {resultadoTv && <div role="status" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: resultadoTv.ok ? "#1F8A73" : "#C23B32" }}>{resultadoTv.texto}</div>}
        </div>}

        {/* 2. Celular, tablet o computadora: QR y enlace */}
        {!bloqueada && !esTransmision && <div style={tarjeta}>
          <div style={tituloTarjeta}><Smartphone size={17} color="var(--wf-brand-accent)" /> En un celular, tablet o computadora</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div aria-label="Código QR del enlace" style={{ width: 180, height: 180, background: "#fff", borderRadius: 14, padding: 8, boxSizing: "border-box", boxShadow: "0 3px 14px rgba(22,50,79,0.12)" }}
              dangerouslySetInnerHTML={{ __html: svgQr || "" }} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-heading)", background: "var(--wf-bg, #F4F6FA)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "9px 12px", wordBreak: "break-all", userSelect: "all", marginBottom: 10 }}>{enlace}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={copiar} style={boton}>{copiado ? <Check size={16} color="#1F8A73" /> : <Copy size={16} />}{copiado ? "Copiado" : "Copiar enlace"}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`} target="_blank" rel="noopener noreferrer" style={boton}><MessageCircle size={16} color="#1F8A73" /> WhatsApp</a>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5, marginTop: 8 }}>Escanea el QR con la cámara o abre el enlace, y toca la pantalla una vez para ponerla completa.</div>
          {!esEscenario && <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5, marginTop: 6 }}>¿Transmites con OBS y quieres la letra encima de la cámara? Usa la pestaña <b>Transmisión</b>: sale más grande y con fondo transparente.</div>}
        </div>}

        {!bloqueada && codigo && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(232,130,30,0.12)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
            <Clock size={16} color="var(--wf-brand-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, fontSize: 12.5, color: "var(--wf-text)", lineHeight: 1.5 }}>
              <b>El acceso vence solo</b> cuando Multimedia finaliza la transmisión. Para el próximo culto: el TV mostrará un número nuevo, y el QR de aquí también cambia.
              <button type="button" onClick={renovar} disabled={renovando} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, background: "transparent", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", fontFamily: "inherit" }}>
                <RefreshCw size={13} /> {renovando ? "Renovando…" : "Cortar el acceso ahora"}
              </button>
              {avisoRenovar && <div style={{ marginTop: 6, fontSize: 12, color: "var(--wf-muted)" }}>{avisoRenovar}</div>}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5 }}>
          Necesita internet. Puede haber varias pantallas abiertas a la vez. Si la computadora está conectada al TV por cable HDMI, usa mejor "Abrir proyección" en la consola en vivo.
        </div>
      </div>
    </div>,
    document.body,
  );
}
