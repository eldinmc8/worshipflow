// Salida para la transmisión (OBS, Streamlabs…), pedido de Eldin, 2026-11-20: una iglesia puso la
// proyección en OBS y la achicó para verla encima de la cámara; como esa fuente es la MISMA imagen que la
// pantalla del templo (letra proporcional al tamaño de la imagen), la letra quedaba diminuta. Esta es una
// salida aparte (/t/<iglesia>/<código>): fondo transparente, solo la letra en una franja, con su propio
// tamaño, posición y fondo (liveStyle.transmision). Nada de esto cambia la pantalla del templo.

export const TAMANOS_TRANSMISION = { min: 0.6, max: 1.6, paso: 0.1, defecto: 1 };

export const POSICIONES_TRANSMISION = {
  abajo: { label: "Abajo" },
  arriba: { label: "Arriba" },
};

export const FONDOS_TRANSMISION = {
  franja: { label: "Franja oscura" },
  sombra: { label: "Solo la letra" },
};

// Ajustes con los valores por defecto y dentro de sus límites, aunque el estilo guardado venga vacío o raro.
export function ajustesTransmision(liveStyle) {
  const t = liveStyle && typeof liveStyle.transmision === "object" && liveStyle.transmision ? liveStyle.transmision : {};
  const n = Number(t.tamano);
  const tamano = Number.isFinite(n) ? Math.min(TAMANOS_TRANSMISION.max, Math.max(TAMANOS_TRANSMISION.min, n)) : TAMANOS_TRANSMISION.defecto;
  return {
    tamano,
    posicion: POSICIONES_TRANSMISION[t.posicion] ? t.posicion : "abajo",
    fondo: FONDOS_TRANSMISION[t.fondo] ? t.fondo : "franja",
  };
}

// Alto de la franja, como parte del alto de la imagen de la transmisión: 22% con tamaño normal.
export function altoFranja(tamano) {
  return Math.min(0.45, Math.max(0.12, 0.22 * tamano));
}

// Qué texto sale en la transmisión según lo que está al aire. null = nada (videos, imágenes, cuenta
// regresiva, diapositivas de diseño: eso ya se ve en la pantalla del templo, no hace falta encima de la cámara).
export function textoParaTransmision(slide) {
  if (!slide || typeof slide !== "object") return null;
  if (slide.type === "cancion") {
    const lineas = (slide.lines || []).map((l) => String(l ?? "").trim()).filter(Boolean);
    return lineas.length ? { lineas, referencia: "" } : null;
  }
  if (slide.type === "biblia") {
    const texto = String(slide.text || "").trim();
    if (!texto) return null;
    return { lineas: [texto], referencia: [slide.reference, slide.version].filter(Boolean).join(" · ") };
  }
  if (slide.type === "slide" && !slide.diseno) {
    const lineas = String(slide.title || "").split("\n").map((l) => l.trim()).filter(Boolean);
    const sub = String(slide.subtitle || "").trim();
    if (!lineas.length && !sub) return null;
    return lineas.length ? { lineas, referencia: sub } : { lineas: [sub], referencia: "" };
  }
  return null;
}
