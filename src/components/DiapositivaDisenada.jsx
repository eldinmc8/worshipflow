import { familiaDe, LIENZO_ANCHO } from "../lib/diapositivas.js";

// Dibuja una diapositiva con diseño (ver lib/diapositivas.js) a cualquier tamaño: el lienzo 16:9 se
// ajusta dentro de su contenedor (con bandas negras si no es 16:9) y todo se mide en unidades del
// propio lienzo (cqw), así una miniatura, el editor y el proyector se ven idénticos.
// hijos: lo que se dibuja ENCIMA del lienzo con sus mismas coordenadas (el editor pone ahí sus asas).
const enCqw = (px) => `${(px / LIENZO_ANCHO) * 100}cqw`;

export function CapaDisenada({ capa }) {
  const base = { position: "absolute", left: `${capa.x}%`, top: `${capa.y}%`, width: `${capa.w}%`, height: `${capa.h}%`, boxSizing: "border-box" };
  if (capa.tipo === "imagen") {
    return (
      <img
        src={capa.url} alt="" draggable={false}
        style={{ ...base, objectFit: capa.ajuste || "contain", borderRadius: enCqw(capa.radio || 0), opacity: capa.opacidad ?? 1, pointerEvents: "none", userSelect: "none" }}
      />
    );
  }
  const alinear = capa.alinear || "center";
  return (
    <div
      style={{
        ...base, display: "flex", flexDirection: "column",
        justifyContent: capa.vertical === "top" ? "flex-start" : capa.vertical === "bottom" ? "flex-end" : "center",
        background: capa.caja || "transparent", borderRadius: enCqw(capa.radio || 0),
        padding: capa.caja ? `${enCqw(18)} ${enCqw(32)}` : 0, overflow: "hidden",
        pointerEvents: "none", userSelect: "none",
      }}
    >
      <div style={{
        fontFamily: familiaDe(capa.fuente), fontSize: enCqw(capa.tamano || 64), color: capa.color || "#fff",
        fontWeight: capa.negrita ? 700 : 400, fontStyle: capa.cursiva ? "italic" : "normal",
        textAlign: alinear, lineHeight: 1.2, whiteSpace: "pre-wrap", overflowWrap: "break-word",
        textShadow: capa.caja ? "none" : `0 ${enCqw(3)} ${enCqw(14)} rgba(0,0,0,0.35)`,
      }}>{capa.texto}</div>
    </div>
  );
}

export function FondoDisenado({ fondo }) {
  const f = fondo || {};
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: f.color || "#000" }} />
      {f.tipo === "imagen" && f.url && <img src={f.url} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: f.ajuste || "cover", pointerEvents: "none", userSelect: "none" }} />}
      {f.tipo === "video" && f.url && <video src={f.url} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: f.ajuste || "cover", pointerEvents: "none" }} />}
    </>
  );
}

export default function DiapositivaDisenada({ diapositiva, blanked = false, children, fondoMarco = "#000", lienzoRef, onPointerDownLienzo }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: fondoMarco, containerType: "size", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div
        ref={lienzoRef}
        onPointerDown={onPointerDownLienzo}
        style={{ position: "relative", width: "min(100cqw, calc(100cqh * 16 / 9))", height: "min(100cqh, calc(100cqw * 9 / 16))", containerType: "inline-size", overflow: "hidden", flexShrink: 0 }}
      >
        {!blanked && diapositiva && (
          <>
            <FondoDisenado fondo={diapositiva.fondo} />
            {(diapositiva.capas || []).map((c) => <CapaDisenada key={c.id} capa={c} />)}
          </>
        )}
        {children}
      </div>
    </div>
  );
}
