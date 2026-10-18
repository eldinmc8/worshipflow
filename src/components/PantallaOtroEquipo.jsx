import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, MessageCircle, MonitorSmartphone } from "lucide-react";
import qrcode from "qrcode-generator";
import { supabase } from "../lib/supabaseClient.js";
import { enlacePantalla } from "../lib/enlacePantalla.js";

// "Pantalla en otro equipo" (pedido de Eldin, 2026-10-18): la proyección se puede abrir en cualquier
// TV, tablet o computadora con navegador y se sincroniza sola por internet. Aquí se muestra el enlace
// corto de la iglesia (/p/<slug>) para copiarlo, mandarlo por WhatsApp o escanearlo con el QR.
export default function PantallaOtroEquipo({ iglesiaId, slug: slugInicial, onCerrar }) {
  const [slug, setSlug] = useState(slugInicial || null);
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (slug || !iglesiaId) return;
    supabase.from("iglesias").select("slug").eq("id", iglesiaId).single().then(({ data }) => { if (data?.slug) setSlug(data.slug); });
  }, [slug, iglesiaId]);
  const enlace = enlacePantalla(slug);
  const svgQr = useMemo(() => {
    if (!slug) return "";
    const qr = qrcode(0, "M");
    qr.addData(enlace);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [enlace, slug]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace); setCopiado(true); setTimeout(() => setCopiado(false), 2200); }
    catch { window.prompt?.("Copia este enlace:", enlace); }
  };
  const textoWhatsApp = `Pantalla de proyección de WorshipFlow — ábrela en el TV, tablet o computadora y toca la pantalla una vez para ponerla completa:\n${enlace}`;

  const boton = { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--wf-border)", background: "var(--wf-card)", color: "var(--wf-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", textDecoration: "none", flex: 1 };
  return createPortal(
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 9000, background: "rgba(10,16,28,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div role="dialog" aria-label="Pantalla en otro equipo" onClick={(e) => e.stopPropagation()} style={{ width: "min(460px, 100%)", maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "var(--wf-bg, #F4F6FA)", borderRadius: 18, padding: 18, boxShadow: "0 24px 60px rgba(0,0,0,.35)", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--wf-brand-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><MonitorSmartphone size={18} /></span>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--wf-heading)", flex: 1 }}>Pantalla en otro equipo</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--wf-muted)", display: "flex" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: "var(--wf-muted)", lineHeight: 1.5, margin: "0 0 14px" }}>
          Abre este enlace en un TV, tablet, celular u otra computadora: muestra lo mismo que la proyección y cambia solo, sin iniciar sesión.
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div aria-label="Código QR del enlace" style={{ width: 200, height: 200, background: "#fff", borderRadius: 14, padding: 8, boxSizing: "border-box", boxShadow: "0 3px 14px rgba(22,50,79,0.12)" }}
            dangerouslySetInnerHTML={{ __html: svgQr || "" }} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.4, marginBottom: 6 }}>ENLACE</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wf-heading)", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "10px 12px", wordBreak: "break-all", userSelect: "all", marginBottom: 10 }}>{enlace}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button type="button" onClick={copiar} style={boton}>{copiado ? <Check size={16} color="#1F8A73" /> : <Copy size={16} />}{copiado ? "Copiado" : "Copiar enlace"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp)}`} target="_blank" rel="noopener noreferrer" style={boton}><MessageCircle size={16} color="#1F8A73" /> Enviar por WhatsApp</a>
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, listStyle: "decimal", fontSize: 12.5, color: "var(--wf-text)", lineHeight: 1.6 }}>
          <li>Escanea el código con la cámara del otro equipo, o escribe el enlace en su navegador.</li>
          <li>Toca la pantalla una vez para ponerla en pantalla completa.</li>
          <li>Inicia el evento en esta consola: lo que pongas al aire aparece allá.</li>
        </ol>
        <div style={{ fontSize: 11.5, color: "var(--wf-faint)", lineHeight: 1.5, marginTop: 10 }}>
          Necesita internet en los dos equipos. Puede haber más de una pantalla abierta a la vez (por ejemplo, otra para los músicos).
        </div>
      </div>
    </div>,
    document.body,
  );
}
