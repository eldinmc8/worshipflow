// Ventana "Copiar de otro culto" (lib/copiarCantos.js): 1) elegir el culto, 2) sus cantos salen ya
// marcados, se desmarcan los que no van y se copian juntos, con su tono y su orden para ese culto.
import { useMemo, useState } from "react";
import { Copy, ArrowLeft, Check, ChevronRight, ListOrdered } from "lucide-react";
import { ModalShell, primaryBtn } from "../pantallas/compartido.jsx";
import { cultosParaCopiar, cantosDeCulto, cantosACopiar } from "../lib/copiarCantos.js";
import { formatFullDate } from "../lib/dates.js";
import { acordeEn } from "../lib/preferencias.js";
import { ordenEventoDe } from "../lib/ordenEvento.js";

export default function CopiarDeOtroCulto({ eventos, eventoActualId, library, onCerrar, onCopiar }) {
  const { pasados, proximos } = useMemo(() => cultosParaCopiar(eventos, eventoActualId), [eventos, eventoActualId]);
  const [culto, setCulto] = useState(null);
  const [desmarcados, setDesmarcados] = useState(() => new Set());
  const porId = useMemo(() => new Map((library || []).map((s) => [s.id, s])), [library]);
  const cantos = culto ? cantosDeCulto(culto) : [];
  const elegidos = cantos.filter((it) => porId.has(it.songId) && !desmarcados.has(it.id));

  const abrir = (e) => { setCulto(e); setDesmarcados(new Set()); };
  const alternar = (id) => setDesmarcados((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const copiar = () => {
    const items = cantosACopiar(elegidos, library);
    if (!items.length) return;
    onCopiar(items, culto);
  };

  const filaCulto = (e) => {
    const n = cantosDeCulto(e).length;
    const fecha = formatFullDate(e.date);
    const titulo = e.title || fecha || "Culto sin nombre";
    return (
      <button key={e.id} onClick={() => abrir(e)} className="hoverable"
        style={{ width: "100%", textAlign: "left", padding: "11px 10px", marginBottom: 6, borderRadius: 12, background: "transparent", border: "1px solid var(--wf-border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: "var(--wf-text)", fontFamily: "inherit" }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</span>
          <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)" }}>{fecha && fecha !== titulo && !titulo.includes(fecha.split(" de ").slice(0, 2).join(" de ")) ? `${fecha} · ` : ""}{n} {n === 1 ? "canto" : "cantos"}</span>
        </span>
        <ChevronRight size={16} color="var(--wf-faint)" />
      </button>
    );
  };
  const subtitulo = { fontSize: 11.5, fontWeight: 800, color: "var(--wf-muted)", textTransform: "uppercase", letterSpacing: 0.4, margin: "10px 2px 6px" };

  return (
    <ModalShell alto title={culto ? "Elige los cantos" : "Copiar de otro culto"} icon={Copy} color="#1F8A73" onClose={onCerrar}>
      {!culto && (
        <>
          <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginBottom: 6, flexShrink: 0 }}>Elige el culto. Sus cantos se copian con el mismo tono y el mismo orden que tenían.</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>
            {pasados.length > 0 && <div style={subtitulo}>Cultos anteriores</div>}
            {pasados.map(filaCulto)}
            {proximos.length > 0 && <div style={subtitulo}>Próximos cultos</div>}
            {proximos.map(filaCulto)}
            {pasados.length + proximos.length === 0 && <div style={{ color: "var(--wf-faint)", fontSize: 13, padding: "10px 2px" }}>Todavía no hay otro culto con cantos.</div>}
          </div>
        </>
      )}
      {culto && (
        <>
          <button onClick={() => setCulto(null)} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: "2px 0", marginBottom: 6, fontSize: 12.5, fontWeight: 700, color: "var(--wf-brand-accent)", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <ArrowLeft size={14} /> Otros cultos
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, flexShrink: 0 }}>{culto.title || formatFullDate(culto.date)}</div>
          <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 8, flexShrink: 0 }}>Quita la marca de los que no van.</div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", margin: "0 -4px", padding: "0 4px" }}>
            {cantos.map((it) => {
              const song = porId.get(it.songId);
              const marcado = !!song && !desmarcados.has(it.id);
              const especial = song && ordenEventoDe(it);
              return (
                <button key={it.id} disabled={!song} onClick={() => alternar(it.id)} className="hoverable"
                  style={{ width: "100%", textAlign: "left", padding: "10px 10px", marginBottom: 6, borderRadius: 12, background: marcado ? "var(--wf-active-bg)" : "transparent", border: marcado ? "1px solid #1F8A73" : "1px solid var(--wf-border)", cursor: song ? "pointer" : "default", opacity: song ? 1 : 0.55, display: "flex", alignItems: "center", gap: 10, color: "var(--wf-text)", fontFamily: "inherit" }}>
                  <span aria-hidden style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: marcado ? "#1F8A73" : "transparent", border: marcado ? "none" : "1.5px solid var(--wf-faint)" }}>
                    {marcado && <Check size={15} color="#fff" strokeWidth={3} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600 }}>{song ? song.title : "Canción que ya no está en la biblioteca"}</span>
                    {song && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>
                        {acordeEn(it.keyOverride || song.key)}
                        {especial && <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--wf-muted)", fontFamily: "var(--wf-font-ui)" }}><ListOrdered size={12} /> orden especial</span>}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={copiar} disabled={!elegidos.length} style={{ ...primaryBtn, marginTop: 10, flexShrink: 0, opacity: elegidos.length ? 1 : 0.5, cursor: elegidos.length ? "pointer" : "default" }}>
            {elegidos.length ? `Copiar ${elegidos.length} ${elegidos.length === 1 ? "canto" : "cantos"} a este culto` : "Marca al menos un canto"}
          </button>
        </>
      )}
    </ModalShell>
  );
}
