import { useLayoutEffect, useRef, useState } from "react";

// Texto que se ajusta solo al tamaño de su contenedor: arranca grande (proporcional al alto real del
// contenedor, así se ve igual en la mini-preview que en el TV del proyector) y se achica hasta caber.
//
// Arreglos del 2026-10-07 ("la letra se sale del marco"):
// 1. Antes solo se volvía a medir cuando cambiaba el TEXTO. Al cambiar el estilo de letra (mayúscula,
//    contraste editorial, tamaño descendente...) o la fuente en vivo, el tamaño viejo se quedaba y la
//    letra nueva —más ancha— se salía. Ahora cualquier cambio de estilo vuelve a medir.
// 2. Se medía antes de que cargara la fuente de verdad (con la de respaldo, más angosta); cuando la
//    fuente terminaba de cargar, la letra crecía y se salía. Ahora se vuelve a medir al cargar fuentes.
// 3. Con whiteSpace: nowrap (letra de canciones: cada línea en un solo renglón), si una línea es tan
//    larga que ni al tamaño mínimo cabe, se quedaba cortada por el borde. Como último recurso ahora se
//    permite partirla en dos renglones — mejor eso que perder texto en pantalla.
//
// minRatio (opcional, 2026-10-08 — "que todas las letras queden más o menos de este tamaño, no
// menos"): piso proporcional al alto del contenedor. Antes, una línea larga en nowrap se achicaba
// hasta caber en UN renglón y quedaba mucho más chica que las demás diapositivas. Con piso, al
// llegar a él se prefiere partir la línea en dos renglones antes que seguir achicando; solo si ni
// así cabe (texto muy largo) se baja de ahí, como último recurso para no cortar texto.
// alinearH / alinearV (opcionales, valores de justify/align-items de flex): dónde queda el bloque de
// texto dentro del espacio disponible — izquierda/centro/derecha y arriba/centro/abajo (Estilo en vivo).
export default function AutoFitText({ lines, targetRatio, minRatio, minPx = 14, maxPx, style, maxWidth, onFontSize, lineStyles, alinearH = "center", alinearV = "center" }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [fontPx, setFontPx] = useState(minPx);
  const fitKey = Array.isArray(lines) ? lines.join("\n") : lines;
  const styleKey = JSON.stringify(style || {}) + "|" + JSON.stringify(lineStyles || []);
  const whiteSpaceOriginal = style?.whiteSpace || "";

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;
    const fits = () => text.scrollHeight <= container.clientHeight + 1 && text.scrollWidth <= container.clientWidth + 1;
    const achicar = (piso) => {
      // maxPx (opcional): sin esto, un texto CORTO (ej. "Bienvenidos") nunca se desborda a su tamaño
      // "deseado" y se quedaba enorme, limitado solo por el alto de la pantalla.
      let size = Math.max(piso, container.clientHeight * targetRatio);
      if (maxPx) size = Math.min(size, maxPx);
      text.style.fontSize = `${size}px`;
      let guard = 0;
      while (!fits() && size > piso && guard < 120) {
        size = Math.max(piso, size - Math.max(1, Math.round(size * 0.05)));
        text.style.fontSize = `${size}px`;
        guard++;
      }
      return size;
    };
    const fit = () => {
      const piso = Math.max(minPx, minRatio ? container.clientHeight * minRatio : 0);
      text.style.whiteSpace = whiteSpaceOriginal;
      let size = achicar(piso);
      if (!fits() && whiteSpaceOriginal === "nowrap") {
        text.style.whiteSpace = "normal";
        size = achicar(piso);
      }
      if (!fits() && piso > minPx) size = achicar(minPx);
      setFontPx(size);
      if (onFontSize) onFontSize(size);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    let vivo = true;
    const fuentes = typeof document !== "undefined" ? document.fonts : null;
    fuentes?.ready?.then(() => { if (vivo) fit(); });
    const alCargarFuentes = () => { if (vivo) fit(); };
    fuentes?.addEventListener?.("loadingdone", alCargarFuentes);
    return () => {
      vivo = false;
      ro.disconnect();
      fuentes?.removeEventListener?.("loadingdone", alCargarFuentes);
    };
    // onFontSize se omite a propósito: es un callback que cambia en cada render del padre y no debe
    // volver a disparar la medición (antes tampoco estaba).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRatio, minRatio, fitKey, minPx, maxPx, styleKey, whiteSpaceOriginal]);

  return (
    <div ref={containerRef} style={{ width: "100%", maxWidth: maxWidth || "100%", flex: 1, minHeight: 0, display: "flex", alignItems: alinearV, justifyContent: alinearH, overflow: "hidden" }}>
      <div ref={textRef} style={{ ...style, fontSize: fontPx }}>
        {/* lineStyles es opcional, por índice -- pensado para que la letra de una canción pueda
            destacar su 2a línea distinto (mayúscula, color de acento...) sin tocar lines (que sigue
            siendo solo texto plano, para que fitKey arriba no se rompa con objetos React). */}
        {Array.isArray(lines) ? lines.map((l, i) => <div key={i} style={lineStyles?.[i]}>{l}</div>) : lines}
      </div>
    </div>
  );
}
