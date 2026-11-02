// Lo que se ve en la pantalla de proyección (la usan la consola, las mini-vistas y la pantalla pública). Separada de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { useState } from "react";
import { definicionAnimacion, armarLineasAnimadas, velocidadLetra, FondoAnimado, claseAnimacion } from "../components/LetrasAnimadas.jsx";
import DiapositivaDisenada from "../components/DiapositivaDisenada.jsx";
import { esPaginaPresentacion } from "../lib/importarPresentacion.js";
import { Mic2, Radio, Music } from "lucide-react";
import AutoFitText from "../components/AutoFitText.jsx";
import { LIVE_FONTS, LIVE_THEMES, LIVE_SOMBRAS, LIVE_ALINEACIONES, LIVE_POSICIONES, TYPE_META } from "./compartido.jsx";

// ---------- Estilo en vivo de la proyección: fondo y tipografía, ajustables por multimedia mientras transmite ----------
// Letra animada sobre fondo propio: mínimo de oscurecido, sombra extra y colores casi transparentes más
// visibles (ej. las palabras que esperan en "Karaoke") — ver ProjectionPanel.
const OSCURECER_MINIMO_ANIMADA = 0.4;

export function reforzarSombraAnimada(sombra) {
  const extra = "0 0.05em 0.3em rgba(0,0,0,.8)";
  return !sombra || sombra === "none" ? extra : `${sombra}, ${extra}`;
}

export function colorLegibleAnimada(color) {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(color || "");
  if (!m || Number(m[4]) >= 0.55) return color;
  return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.55)`;
}

// ---------------- PROYECCIÓN ----------------
// Ajusta el tamaño de letra automáticamente (como el autofit de PowerPoint): el slider de tamaño en
// Multimedia define el tamaño DESEADO, pero este componente lo mide contra el espacio real disponible y
// lo va reduciendo hasta que quepa entero — así, sin importar cuántas líneas tenga la diapositiva ni qué
// tan arriba se suba el slider, el texto nunca se corta ni se sale de la pantalla.

export function ProjectionPanel({ slide, blanked, split, liveStyle, compactHeight, thumbnail }) {
  const font = LIVE_FONTS[liveStyle?.font || "elegante"];
  const scale = liveStyle?.fontScale ?? 1;
  // Tamaño real (medido, en px) al que AutoFitText terminó dejando el texto del versículo después de
  // achicarlo para que quepa — puede ser bastante menor que el "deseado" (bibliaRatio) si el versículo
  // es largo. La cita se calcula a partir de ESTE valor medido (no del tamaño deseado) para que nunca
  // pueda verse más grande que el propio versículo, sin importar cuánto se haya tenido que achicar.
  const [bibliaFontPx, setBibliaFontPx] = useState(null);
  // Tamaño real al que quedó el contenido de una diapositiva de texto: el texto pequeño de abajo sigue
  // ese tamaño (escalaSubtitulo, 65% por defecto) en vez de un px fijo — pedido de Eldin, 2026-10-11.
  const [slideFontPx, setSlideFontPx] = useState(null);
  // Fondo por canción: solo si quien transmite lo activó y ESTA canción tiene uno propio — si no, el
  // fondo general de siempre (que también es el de la Biblia y las diapositivas).
  const fondoCancion = liveStyle?.fondoPorCancion && slide?.type === "cancion" && slide.songId ? liveStyle.fondosCanciones?.[slide.songId] : null;
  const fondo = fondoCancion ? { ...liveStyle, ...fondoCancion } : liveStyle;
  // Prioridad de fondo: video propio de esta slide > video de fondo global (Estilo > Video) > imagen
  // propia de esta slide > imagen de fondo global (Estilo > Imagen) > tema de color.
  const slideVideoBg = slide?.type === "slide" && slide.bgType === "video" && slide.videoUrl;
  // Bug real: antes esto no miraba customBgType -- con liveStyle.customVideo puesto alguna vez
  // (queda guardado aunque ya no se esté usando, por si se vuelve a esa pestaña), el video ganaba
  // SIEMPRE, sin importar que la pestaña activa fuera "Imagen" con una imagen ya elegida -- cambiar a
  // imagen no se veía nunca. customBgType (la pestaña que de verdad está activa en Estilo) es lo que
  // decide cuál de los dos usar, no solo cuál de los dos campos tiene algo guardado.
  // Letras animadas (ver components/LetrasAnimadas.jsx): el fondo animado del estilo reemplaza al fondo
  // general, salvo que se haya elegido "Mi fondo", o que la diapositiva o la canción traigan uno propio.
  const animDef = definicionAnimacion(liveStyle);
  const animKey = animDef?.clave || null;
  const anim = animDef?.def || null;
  const slideTraeFondo = slide?.type === "slide" && ((slide.bgType === "video" && slide.videoUrl) || (slide.bgType === "imagen" && slide.imageUrl));
  const fondoAnimado = anim && liveStyle?.animFondo !== "propio" && !fondoCancion && !slideTraeFondo ? anim.fondo : null;
  const customBgEsVideo = !fondoAnimado && fondo?.theme === "custom" && (fondo.customBgType || "imagen") === "video";
  const customBgEsImagen = !fondoAnimado && fondo?.theme === "custom" && (fondo.customBgType || "imagen") === "imagen";
  const globalVideoBg = !slideVideoBg && customBgEsVideo && fondo.customVideo;
  const videoSrc = slideVideoBg ? slide.videoUrl : globalVideoBg ? fondo.customVideo : null;
  const slideImageBg = !videoSrc && slide?.type === "slide" && slide.bgType === "imagen" && slide.imageUrl;
  const globalImageBg = !videoSrc && !slideImageBg && customBgEsImagen && fondo.customImage;
  const imageSrc = slideImageBg || globalImageBg || null;
  // Bug real (no de hoy, ya existía): al tocar la pestaña "Imagen" o "Video (movimiento)" del fondo
  // global, liveStyle.theme pasa a "custom" DE UNA -- antes incluso de subir o elegir algo -- pero
  // "custom" nunca fue una clave de LIVE_THEMES. Mientras no hubiera ni video ni imagen todavía (justo
  // el instante entre tocar la pestaña y terminar de subir el archivo), esto hacía LIVE_THEMES["custom"]
  // undefined y el siguiente .bg reventaba -- se caía TODA la app (sin pantalla de error, solo en
  // blanco/negro), tanto en la vista previa del panel de control como en la Proyección real, porque las
  // dos usan este mismo componente. El `|| LIVE_THEMES.stage` cubre ese y cualquier otro valor de tema
  // que no sea una clave real.
  const theme = videoSrc || imageSrc ? null : (LIVE_THEMES[fondo?.theme || "stage"] || LIVE_THEMES.stage);
  const bg = fondoAnimado && !videoSrc && !imageSrc ? "#000" : videoSrc ? "#000" : imageSrc ? `center / cover no-repeat url(${imageSrc})` : theme.bg;
  // El tamaño de letra "deseado" viene del slider (liveStyle.fontScale) multiplicando una proporción del
  // alto del contenedor (ver AutoFitText) en vez de un px fijo — así se ve igual de grande en la
  // mini-preview y en la pantalla real, y ese mismo % sigue aplicando de una diapositiva a la siguiente
  // (liveStyle.fontScale es un solo valor compartido, no por diapositiva) sin nunca desbordarse, porque
  // AutoFitText siempre lo achica más si hace falta para esa diapositiva en particular.
  // Piso en 94% de este tamaño (minRatio, ver AutoFitText) SOLO en los formatos de pantalla chica
  // (diapositivas reorganizadas: traen baseLines, ver reorganizarLetra): ahí todas quedan más o menos
  // del mismo tamaño y una línea larga se parte en dos renglones en vez de achicarse. En "2 líneas por
  // diapositiva" (pantallas grandes) no: cada línea debe verse completa en su renglón, así que se
  // achica lo necesario, como siempre.
  const cancionRatio = 0.16 * scale;
  // Antes 0.12 — bastante más chica que la letra de canción (0.16), lo que la hacía difícil de leer
  // desde lejos en la pantalla real, incluso para quienes siguen con su propia Biblia en mano.
  const bibliaRatio = 0.155 * scale;
  const slideRatio = 0.18 * scale;
  const textColor = liveStyle?.textColor || "#FFFFFF";
  // Ajustes finos (ver LIVE_SOMBRAS y compañía) — sin valor, como siempre.
  const espaciadoLetras = liveStyle?.espaciado != null ? `${liveStyle.espaciado}em` : font.tracking;
  const sombraTexto = (LIVE_SOMBRAS[liveStyle?.sombra] || LIVE_SOMBRAS.ninguna).css;
  const alineacion = LIVE_ALINEACIONES[liveStyle?.alineacion] || LIVE_ALINEACIONES.centro;
  const posicion = LIVE_POSICIONES[liveStyle?.posicion] || LIVE_POSICIONES.centro;
  // Letra animada sobre un fondo propio (imagen o video de Estilo, de la canción o de la diapositiva):
  // los colores del estilo están pensados para su fondo oscuro, así que se oscurece al menos un 40% y la
  // letra lleva sombra (2026-11-02, "que la letra animada siempre se lea").
  const animSobreFondoPropio = !!anim && !fondoAnimado;
  const oscurecerFondo = animSobreFondoPropio ? Math.max(liveStyle?.oscurecer ?? 0.45, OSCURECER_MINIMO_ANIMADA) : (liveStyle?.oscurecer ?? 0.45);
  const ubicacion = { alinearH: alineacion.flex, alinearV: posicion.flex };
  // Diseño de transmisión (solo canciones, ver LINE_STYLES): cambia cómo se destaca la 2a línea de la
  // diapositiva (la que cierra la frase) -- nunca la 1a, y nunca si la diapositiva es de una sola
  // línea (no hay "2a línea" que destacar). "tradicional" no toca nada (ambas líneas iguales, como
  // siempre fue).
  const lineStyleMode = liveStyle?.lineStyle || "tradicional";
  // Con letra animada el estilo ya decide cómo se ve cada línea: el "diseño de las letras" no aplica.
  const animarLetra = !!anim && slide?.type === "cancion" && Array.isArray(slide?.lines);
  const lineasAnimadas = animarLetra ? armarLineasAnimadas(anim, slide.lines, slide.slideId, velocidadLetra(liveStyle)) : null;
  const cancionLineStyles =
    slide?.type === "cancion" && lineStyleMode !== "tradicional" && !animarLetra
      ? slide.lines.map((_, i) => {
          // Más contraste (pedido de Eldin, 2026-10-05): antes la línea en minúscula no tenía ningún
          // estilo propio, así que heredaba el peso de la fuente elegida en TIPOGRAFÍA -- con una
          // fuente ya gruesa (ej. Audaz, Extra negrita) casi no se notaba diferencia contra la 2a
          // línea en mayúscula. Ahora la 1a línea fuerza un peso liviano sin importar la fuente, y la
          // 2a además de mayúscula/negrita queda más grande y con más espacio entre letras.
          if (lineStyleMode === "mayuscula") return i === 0 ? { fontWeight: 400 } : i === 1 ? { textTransform: "uppercase", fontWeight: 900, fontSize: "1.1em", letterSpacing: "0.03em" } : undefined;
          if (lineStyleMode === "acento") return i === 1 ? { color: "var(--wf-brand-accent)" } : undefined;
          if (lineStyleMode === "editorial") return i === 1 ? { fontStyle: "italic", fontFamily: "'Playfair Display', serif" } : undefined;
          // La línea principal más grande, la segunda (como un eco/aclaración) más chica -- al revés
          // de mayuscula/acento, que destacan la 2a línea; acá se destaca la 1a.
          if (lineStyleMode === "descendente") return i === 0 ? { fontSize: "1.15em" } : i === 1 ? { fontSize: "0.78em" } : undefined;
          // Asimétrico a propósito (no centrado) -- cada línea ocupa el ancho completo del bloque de
          // texto (ver nota en AutoFitText: los <div> hijos son block-level, heredan el ancho del
          // contenedor ya encogido a la línea más larga) así que left/right sí se nota.
          if (lineStyleMode === "revista") return i === 0 ? { textAlign: "left" } : i === 1 ? { textAlign: "right" } : undefined;
          // Fundido/deslizante: las DOS líneas animan (no solo la 2a, como mayuscula/acento) con un
          // pequeño desfase entre ellas -- "both" como fill-mode para que la línea se quede invisible
          // ANTES de que le toque su turno, en vez de destellar visible un instante y luego animar.
          if (lineStyleMode === "fundido") return { animation: `wfLyricFadeIn 0.6s ease ${i * 0.35}s both` };
          if (lineStyleMode === "deslizante") return { animation: `wfLyricSlideIn 0.55s ease ${i * 0.3}s both` };
          return undefined; // "cita" y "franja": no tocan el estilo de línea (ver más abajo)
        })
      : undefined;
  const estiloRaiz = { flex: thumbnail ? "none" : compactHeight ? "none" : split ? 1.3 : 1, width: thumbnail ? "100%" : "auto", height: thumbnail ? "100%" : compactHeight || "auto", minHeight: thumbnail ? "auto" : compactHeight || "auto", background: bg, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", padding: thumbnail ? 10 : 32, minWidth: thumbnail ? 0 : 320, overflow: "hidden" };
  // Página de una presentación importada (PDF, Canva...): se proyecta TAL CUAL, completa (sin recortar),
  // sobre negro, sin oscurecer ni letra encima — ya trae su propio diseño. "Pantalla en negro" sí la
  // esconde: aquí la imagen ES el contenido, no un fondo.
  // Diapositiva con diseño propio (editor de diapositivas / presentación agrupada): se dibuja tal cual.
  if (slide?.diseno) {
    return (
      <div style={{ ...estiloRaiz, background: "#000", padding: 0 }}>
        <DiapositivaDisenada diapositiva={slide.diseno} blanked={blanked} animar={!thumbnail} paso={slide.paso ?? 0} />
      </div>
    );
  }
  if (esPaginaPresentacion(slide)) {
    return (
      <div style={{ ...estiloRaiz, background: "#000", padding: 0 }}>
        {blanked ? <div style={{ color: "#2A3140" }}><Mic2 size={thumbnail ? 20 : 40} /></div>
          : <img src={slide.imageUrl} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />}
      </div>
    );
  }
  return (
    <div style={estiloRaiz}>
      {/* Etiquetas chicas (este letrero, la sección de la canción, el título abajo) solo en la vista
          previa del propio operador (thumbnail) -- útiles ahí para ubicarse entre los paneles del
          control, pero de la pantalla real que ve la congregación se quitan: solo debe verse el
          contenido en sí, sin nada de chrome encima (pedido de Eldin, 2026-10-04). */}
      {thumbnail && <div style={{ position: "absolute", top: 18, left: 22, display: "flex", alignItems: "center", gap: 6, color: "#5B6472", fontSize: 11, fontWeight: 700, letterSpacing: 1, zIndex: 2 }}><Radio size={12} /> PANTALLA DE PROYECCIÓN</div>}
      {/* El fondo (video/imagen propios, o el de la slide) se renderiza SIEMPRE, incluso con "Pantalla
          en negro" -- antes vivía adentro del bloque de abajo (solo cuando NO estaba en negro), así que
          "pantalla en negro" con un video de fondo se veía como negro sólido de verdad (el <video> ni
          se montaba) en vez de seguir el video andando sin la letra encima, que es lo que de verdad se
          quiere: ocultar SOLO la letra/texto que se está transmitiendo, no el fondo. */}
      {fondoAnimado && !videoSrc && !imageSrc && <FondoAnimado tipo={fondoAnimado} pulso={slide?.slideId ?? slide?.reference ?? slide?.title} chico={!!thumbnail} quieto={!!thumbnail} ajustes={anim?.ajustesFondo} />}
      {animarLetra && anim.flash && !blanked && <div key={`flash-${slide.slideId}`} className="wfa-flash" />}
      {videoSrc && (
        <>
          <video src={videoSrc} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
          <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${oscurecerFondo})`, zIndex: 0 }} />
        </>
      )}
      {imageSrc && <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${oscurecerFondo})`, zIndex: 0 }} />}
      {blanked || !slide ? (
        <div style={{ color: "#2A3140", position: "relative", zIndex: 1 }}><Mic2 size={thumbnail ? 20 : 40} /></div>
      ) : (
        <>
          {!videoSrc && !fondoAnimado && <div className="spotlight-glow" style={{ position: "absolute", width: thumbnail ? 140 : 420, height: thumbnail ? 140 : 420, borderRadius: "50%", background: `radial-gradient(circle, ${TYPE_META[slide.type].color}22 0%, transparent 70%)` }} />}
          {slide.type === "cancion" && (
            <>
              {thumbnail && <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "var(--wf-brand-accent)", marginBottom: 6, zIndex: 1 }}>{slide.blockLabel.toUpperCase()}</div>}
              {/* "Cita destacada": una comilla grande y translúcida detrás del texto -- a diferencia de
                  los demás diseños, este no cambia el estilo de ninguna línea (ver cancionLineStyles),
                  solo agrega este adorno detrás. */}
              {lineStyleMode === "cita" && !animarLetra && (
                <div aria-hidden style={{ position: "absolute", top: thumbnail ? 4 : 10, left: "50%", transform: "translateX(-50%)", fontFamily: "'Fraunces', serif", fontSize: thumbnail ? 50 : 160, lineHeight: 1, color: textColor, opacity: 0.18, zIndex: 1, pointerEvents: "none" }}>❝</div>
              )}
              {(() => {
                const cancionAutoFit = (
                  <AutoFitText
                    key={slide.slideId}
                    lines={slide.lines} targetRatio={cancionRatio} minRatio={slide.baseLines ? cancionRatio * 0.94 : undefined} minPx={thumbnail ? 7 : 15} maxWidth="90%" {...ubicacion}
                    // whiteSpace:nowrap es lo que de verdad garantiza "2 líneas nada más" (pedido de
                    // Eldin, 2026-10-05): sin esto, una sola línea larga podía ENVOLVER a una fila
                    // visual extra (el ajuste automático de tamaño permitía eso, porque envolver
                    // también baja el ancho usado) -- con nowrap, la única forma de caber es achicar
                    // la letra hasta que esa línea quepa completa en una sola fila, nunca partirla.
                    // key={slide.slideId}: fuerza a React a desmontar/montar de nuevo en cada
                    // diapositiva -- sin esto, "fundido"/"deslizante" solo se verían la PRIMERA vez
                    // (los mismos <div> de línea se reutilizan, así que la animación CSS no se repite
                    // sola con solo cambiar el texto adentro).
                    style={animarLetra
                      ? { fontFamily: anim.fuente.family, fontWeight: anim.fuente.weight, textTransform: anim.fuente.transform || "none", letterSpacing: anim.fuente.tracking || "normal", textAlign: alineacion.text, zIndex: 1, lineHeight: liveStyle?.interlineado ?? 1.25, textShadow: animSobreFondoPropio ? reforzarSombraAnimada(anim.sombra) : anim.sombra, color: animSobreFondoPropio ? colorLegibleAnimada(anim.color) : anim.color, whiteSpace: "nowrap", ...lineasAnimadas.vars }
                      : { fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: espaciadoLetras, fontStyle: font.italic ? "italic" : "normal", textAlign: alineacion.text, zIndex: 1, lineHeight: liveStyle?.interlineado ?? 1.35, textShadow: sombraTexto, color: textColor, whiteSpace: "nowrap", textWrap: "balance" }}
                    lineStyles={cancionLineStyles}
                    className={animarLetra ? claseAnimacion(animKey) : undefined}
                    contenidoLineas={lineasAnimadas?.lineas}
                  />
                );
                // "Franja inferior": en vez de centrada en toda la pantalla, la letra vive en una
                // barra angosta abajo con su propio fondo semitransparente -- deja ver mucho más del
                // fondo/video arriba, estilo noticiero. Necesita su propio contenedor flex con alto
                // definido (a diferencia del resto, que usa el alto completo del panel) para que
                // AutoFitText (flex:1 por dentro) tenga contra qué medirse.
                if (lineStyleMode !== "franja" || animarLetra) return cancionAutoFit;
                return (
                  <div style={{ position: "absolute", left: thumbnail ? 8 : 28, right: thumbnail ? 8 : 28, bottom: thumbnail ? 8 : 36, height: thumbnail ? "42%" : "30%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,10,14,0.55)", borderRadius: thumbnail ? 8 : 16, padding: thumbnail ? "4px 8px" : "10px 28px", zIndex: 1, boxSizing: "border-box" }}>
                    {cancionAutoFit}
                  </div>
                );
              })()}
              {thumbnail && <div style={{ position: "absolute", bottom: 18, display: "flex", alignItems: "center", gap: 8, color: "#5B6472", fontSize: 12, zIndex: 1 }}><Music size={12} /> {slide.songTitle}</div>}
            </>
          )}
          {slide.type === "biblia" && (
            <>
              {/* Antes la cita vivía como hermana de AutoFitText dentro del mismo flex column: al medir
                  su tamaño DESDE bibliaFontPx (ver abajo) y compartir el mismo alto disponible, cambiar
                  su tamaño encogía/agrandaba el espacio que le quedaba al versículo, lo que disparaba el
                  ResizeObserver de AutoFitText de nuevo, que volvía a medir, volvía a cambiar bibliaFontPx,
                  volvía a cambiar el tamaño de la cita... un ciclo sin fin que se veía como parpadeo/
                  "el texto se agranda y achica solo" en algunos versículos (los que quedaban cerca del
                  punto donde ese vaivén no se estabilizaba). Reservando aquí un espacio FIJO (no depende
                  de bibliaFontPx) y sacando la cita del flujo con position:absolute, el alto que mide
                  AutoFitText deja de depender de su propio resultado anterior — se rompe el ciclo. */}
              {/* paddingBottom fijo (NO depende de `scale`): antes crecía junto con el control de tamaño de
                  letra (`* scale`) — así que subir el tamaño del versículo al mismo tiempo le quitaba
                  espacio disponible para ese mismo versículo, compitiendo consigo mismo. En un versículo
                  largo (que ya necesita achicarse para caber) ese espacio perdido podía anular por
                  completo el aumento pedido, o incluso dejarlo más chico que antes — el control de tamaño
                  se sentía "roto" justo en los casos donde más hacía falta. */}
              {/* flexDirection:"column" es lo que de verdad arregla el tamaño de letra de los versículos:
                  sin esto (display:flex por defecto es "row"), align-items:center pasa a controlar el
                  eje vertical (cruzado en una fila) y este div, en vez de estirarse al alto real
                  disponible, se encoge al tamaño de SU PROPIO contenido -- que es circular con lo que
                  AutoFitText está midiendo. El resultado: container.clientHeight quedaba casi en 0/20px
                  sin importar la pantalla, así que el tamaño "deseado" (containerHeight * bibliaRatio)
                  siempre caía al piso mínimo (minPx) y el control de tamaño de letra no tenía ningún
                  efecto real -- por eso el versículo se seguía viendo chico pase lo que pase. */}
              <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: thumbnail ? 22 : 76 }}>
                <AutoFitText
                  lines={`"${slide.text}"`} targetRatio={bibliaRatio} minPx={thumbnail ? 7 : 14} maxWidth="90%" {...ubicacion}
                  onFontSize={setBibliaFontPx}
                  style={{ fontFamily: font.family, fontWeight: font.weight, textTransform: font.transform, letterSpacing: espaciadoLetras, textAlign: alineacion.text, zIndex: 1, lineHeight: liveStyle?.interlineado ?? 1.4, textShadow: sombraTexto, fontStyle: font.italic || font.family.includes("Fraunces") ? "italic" : "normal", color: liveStyle?.bibliaTextColor || textColor }}
                />
              </div>
              {/* La cita ("Génesis 6:6") tiene que leerse desde lejos SIN necesidad de escuchar — hay gente
                  que sigue con su propia Biblia en mano y solo mira la pantalla para ubicar el pasaje.
                  Pero nunca debe verse MÁS grande que el propio versículo: en vez de un tamaño calculado
                  aparte (que no sabía cuánto se había achicado el versículo para caber), se deriva del
                  tamaño ya medido de arriba (bibliaFontPx) — así siempre queda un porcentaje fijo de él,
                  se achique lo que se achique el versículo. */}
              <div style={{ position: "absolute", left: 0, right: 0, bottom: thumbnail ? 6 : 28, textAlign: "center", fontSize: thumbnail ? 10 : Math.round((bibliaFontPx || 20) * 0.62), color: liveStyle?.bibliaReferenciaColor || "#6E9BD1", fontWeight: 800, zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.3em" }}>
                {slide.reference}
                {!thumbnail && slide.version && <span style={{ fontSize: "0.4em", background: "rgba(110,155,209,0.2)", borderRadius: 10, padding: "0.2em 0.6em" }}>{slide.version}</span>}
              </div>
            </>
          )}
          {slide.type === "slide" && (
            <div style={{ textAlign: "center", zIndex: 1, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <AutoFitText
                // Un renglón vacío se proyecta como espacio (pedido de Eldin, 2026-10-11): una línea "" medía
                // 0 de alto y el texto quedaba junto. Solo se quitan los renglones vacíos de las orillas.
                lines={(slide.title || "").replace(/^\s*\n+|\n+\s*$/g, "").split("\n").map((l) => (l.trim() === "" ? "\u00A0" : l))} targetRatio={slideRatio} onFontSize={setSlideFontPx} minPx={thumbnail ? 8 : 16} maxPx={thumbnail ? 30 : 130} maxWidth="90%" {...ubicacion}
                // Con texto pequeño: el contenido se pega a él (abajo de su espacio) y un espacio debajo
                // los centra juntos como un solo bloque, en vez de quedar uno arriba y otro abajo.
                {...(slide.subtitle && slide.title && posicion.flex !== "flex-start" ? { alinearV: "flex-end" } : {})}
                style={{ fontFamily: font.family, fontWeight: Math.max(font.weight, 600), textTransform: font.transform, letterSpacing: espaciadoLetras, fontStyle: font.italic ? "italic" : "normal", textAlign: alineacion.text, lineHeight: liveStyle?.interlineado ?? undefined, textShadow: sombraTexto, color: textColor }}
              />
              {slide.subtitle && (
                <div style={{
                  fontSize: slide.title && slideFontPx ? Math.max(thumbnail ? 5 : 14, slideFontPx * (slide.escalaSubtitulo ?? 0.65)) : thumbnail ? 9 : 44,
                  fontFamily: font.family, fontWeight: 500, color: textColor, opacity: 0.85, textShadow: sombraTexto, textAlign: alineacion.text,
                  marginTop: "0.4em", flexShrink: 0, whiteSpace: "pre-line", maxWidth: "90%", lineHeight: 1.25, zIndex: 1,
                  display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden",
                }}>{slide.subtitle}</div>
              )}
              {slide.subtitle && slide.title && posicion.flex === "center" && <div style={{ flex: 0.55, minHeight: 0 }} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
