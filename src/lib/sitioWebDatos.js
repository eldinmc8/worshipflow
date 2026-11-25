// Textos de la página web que también tienen que leer Google y las IAs (pedido de Eldin, 2026-11-24, para el
// lanzamiento del 30 de noviembre). Sin React ni Supabase: los usa SitioWeb.jsx en pantalla y vite.config.js al
// publicar, para dejar escrito en el HTML (sin JavaScript) el título, la descripción, los datos para Google
// (JSON-LD) y un resumen de la página. Muchos robots de IA no ejecutan JavaScript: sin esto veían una página vacía.
//
// Todo lo que se diga aquí tiene que ser cierto en la app (revisado 2026-11-24): la prueba de 30 días es SOLO del
// plan Iglesia y pide tarjeta; el celular CONTROLA pero proyecta una computadora o pantalla conectada; no hay app en
// las tiendas (es app web); no se anuncian versiones de la Biblia con licencia en los titulares; nada de testimonios
// inventados.
import { PLANES } from "./planesDatos.js";
import { CORREO_SOPORTE, WHATSAPP_SOPORTE } from "./soporte.js";

export const DOMINIO = "https://worshipflowapp.com";
export const TITULO_SITIO = "WorshipFlow | Proyección de letras y Biblia para iglesias, en español";
export const DESCRIPCION_SITIO = "Proyecta letras y la Biblia, arma el setlist y organiza a tus servidores. App web en español, sin instalar programas. Plan Gratis para siempre, sin tarjeta.";
export const RESPALDO_PADDLE = "El cobro lo hace Paddle.com, empresa que procesa pagos de software en todo el mundo y es el comerciante registrado de nuestros pedidos: cobra, emite tu recibo y atiende devoluciones. Nunca vemos ni guardamos tu tarjeta. Cancelas cuando quieras y tienes 14 días después de cualquier pago para pedir el reembolso completo.";
export const CONFIANZA = ["Gratis para siempre, sin tarjeta", "Pagos seguros con Paddle", "Reembolso en 14 días"];

// Redes oficiales (Eldin, 2026-11-24). Sin los parámetros de rastreo con los que se copiaron.
export const REDES = [
  { nombre: "TikTok", url: "https://www.tiktok.com/@worshipflow08" },
  { nombre: "Instagram", url: "https://www.instagram.com/worshipflow_21" },
  { nombre: "Facebook", url: "https://www.facebook.com/share/1F87CZZGSC/" },
];

// Rutas de la página para el mapa del sitio y la dirección "oficial" (canonical) de cada una.
export const RUTAS_SITIO = { "/web": "/", "/web/precios": "/web/precios", "/web/terminos": "/web/terminos", "/web/privacidad": "/web/privacidad", "/web/reembolsos": "/web/reembolsos" };
export const DESCRIPCIONES_RUTA = {
  "/web/precios": "Planes de WorshipFlow: Gratis para siempre sin tarjeta, Ministerio $9.99, Crecimiento $19.99 e Iglesia $29.99 al mes. Prueba de 30 días del plan Iglesia y reembolso en 14 días.",
  "/web/terminos": "Términos del servicio de WorshipFlow.",
  "/web/privacidad": "Política de privacidad de WorshipFlow.",
  "/web/reembolsos": "Política de reembolsos de WorshipFlow: reembolso completo dentro de los 14 días siguientes a cualquier pago, procesado por Paddle.com.",
};

export const PREGUNTAS = [
  ["¿Puedo usar WorshipFlow gratis y sin tarjeta?", "Sí. El plan Gratis es para siempre y no pide tarjeta: proyección en vivo de letras, la Biblia y diapositivas de texto, pantalla de escenario, eventos y setlist, con hasta 5 miembros y 20 canciones."],
  ["¿Necesito instalar algo o una computadora potente?", "No hay que instalar programas. WorshipFlow funciona en el navegador del celular, tablet o computadora, y se puede instalar como app desde el mismo navegador. Para proyectar basta una computadora sencilla o una pantalla con navegador conectada al proyector o la TV; desde el celular controlas las diapositivas."],
  ["¿Sirve para una iglesia con muchos servidores y áreas?", "Sí. Cada área (alabanza, multimedia, ujieres, limpieza, niños…) es un grupo con su líder, sus roles y confirmaciones. El plan Crecimiento admite hasta 50 miembros con cuenta y 6 grupos; el plan Iglesia, miembros y grupos ilimitados."],
  ["¿Puedo poner las letras en mi transmisión de YouTube o Facebook con OBS?", "Sí, en todos los planes. En Pantallas y TV → Transmisión (OBS) copias un enlace aparte que muestra solo la letra con fondo transparente, y lo agregas en OBS como fuente de navegador. En Estilo → Transmisión (OBS) eliges el tamaño, si va abajo o arriba, y si lleva franja o solo letra. La pantalla del templo no cambia."],
  ["¿Qué pasa si el internet de la iglesia falla o es lento?", "Con internet preparas el culto y el celular controla la proyección. Antes del culto, la computadora que proyecta puede guardar todo con Ajustes → Usar sin conexión (canciones, próximos eventos, fondos de imagen y la Biblia). Si el proyector o la TV están conectados por cable HDMI a esa computadora, la proyección sigue aunque se caiga el internet. Los videos de fondo y las pantallas en otros equipos sí necesitan internet."],
  ["¿Qué cuenta como miembro?", "Cada persona de tu equipo con su propia cuenta. La congregación, las pantallas y las TV conectadas no cuentan."],
  ["¿Hay prueba gratis?", "Sí. Cada iglesia nueva puede probar 30 días gratis el plan Iglesia completo. Para activar la prueba se registra una tarjeta; si cancelas antes de que terminen los 30 días, no se te cobra nada. Sin tarjeta puedes usar el plan Gratis para siempre."],
  ["¿Cómo pago?", "Con tarjeta, directo y de forma segura. El cobro lo procesa Paddle.com, nuestro revendedor oficial, que te envía el recibo por correo. Nunca vemos ni guardamos los datos de tu tarjeta."],
  ["¿Puedo cancelar cuando quiera?", "Sí. Cancelas desde la app (Tu plan → Administrar mi suscripción) o desde el enlace del recibo de Paddle, y no se te vuelve a cobrar. Además, tienes 14 días después de cualquier pago para pedir el reembolso completo."],
  ["¿Puedo cambiar de plan?", "Sí, cuando quieras. Si bajas de plan no se borra nada: lo que pase del límite queda guardado, solo no se puede agregar más."],
];

const precioTexto = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

// Datos para Google (schema.org, JSON-LD): qué es la app, quién la hace, cuánto cuesta y las preguntas.
export function datosEstructurados() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "WorshipFlow",
      alternateName: "WorshipFlow App",
      url: `${DOMINIO}/`,
      description: DESCRIPCION_SITIO,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Proyección y gestión para iglesias",
      operatingSystem: "Web (navegador de celular, tablet, computadora y Smart TV)",
      inLanguage: "es",
      featureList: ["Proyección en vivo de letras y la Biblia", "Control desde el celular", "Eventos y setlist", "Modo Músico con acordes", "Equipos y grupos con confirmaciones", "Pantalla de escenario", "Letras para transmisión en OBS con fondo transparente (fuente de navegador)", "Uso sin conexión en la computadora que proyecta"],
      image: `${DOMINIO}/pwa-512x512.png`,
      publisher: { "@type": "Organization", name: "WorshipFlow", url: `${DOMINIO}/` },
      offers: PLANES.map((p) => ({
        "@type": "Offer",
        name: `Plan ${p.nombre}`,
        description: p.precio === 0 ? `${p.resumen}. Gratis para siempre, sin tarjeta.` : `${p.resumen}. $${precioTexto(p.precio)} al mes o $${precioTexto(p.precioAnual)} al año.`,
        price: precioTexto(p.precio),
        priceCurrency: "USD",
        url: `${DOMINIO}/web/precios`,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "WorshipFlow",
      url: `${DOMINIO}/`,
      logo: `${DOMINIO}/pwa-512x512.png`,
      email: CORREO_SOPORTE,
      sameAs: REDES.map((r) => r.url),
      contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: CORREO_SOPORTE, url: `https://wa.me/${WHATSAPP_SOPORTE}`, availableLanguage: ["es"] },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: PREGUNTAS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ];
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Etiquetas del <head>: descripción, vista previa al compartir (WhatsApp, Facebook) y datos para Google.
export function etiquetasHead() {
  const img = `${DOMINIO}/pwa-512x512.png`;
  const json = JSON.stringify(datosEstructurados()).replace(/</g, "\\u003c");
  return [
    `<meta name="description" content="${esc(DESCRIPCION_SITIO)}" />`,
    `<link rel="canonical" href="${DOMINIO}/" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="WorshipFlow" />`,
    `<meta property="og:locale" content="es_LA" />`,
    `<meta property="og:title" content="${esc(TITULO_SITIO)}" />`,
    `<meta property="og:description" content="${esc(DESCRIPCION_SITIO)}" />`,
    `<meta property="og:url" content="${DOMINIO}/" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<script type="application/ld+json">${json}</script>`,
  ].join("\n    ");
}

// Resumen de la página escrito en el HTML para quien no ejecuta JavaScript (robots de Google y de IAs). React lo
// reemplaza al abrir; en la app y en las pantallas se borra antes de pintarse (ver index.html).
export function resumenParaRobots() {
  const li = (t) => `<li>${esc(t)}</li>`;
  const planes = PLANES.map((p) => `<li><strong>${esc(p.nombre)}</strong>: ${p.precio === 0 ? "$0, para siempre, sin tarjeta" : `$${precioTexto(p.precio)} al mes o $${precioTexto(p.precioAnual)} al año`}. ${esc(p.incluye.join(", "))}.</li>`).join("");
  const preguntas = PREGUNTAS.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("");
  return `<div data-resumen-robots style="font-family:sans-serif;max-width:860px;margin:0 auto;padding:32px 20px;color:#16233A;line-height:1.55">
      <h1>WorshipFlow: proyección de letras y Biblia, y organización del culto para iglesias, en español</h1>
      <p>${esc(DESCRIPCION_SITIO)}</p>
      <p>${esc(CONFIANZA.join(" · "))}.</p>
      <h2>Qué hace</h2>
      <ul>${["Proyección en vivo de letras, versículos y diapositivas en el proyector o la TV, controlada desde el celular", "Biblia integrada para buscar un pasaje y proyectarlo al instante", "Eventos y setlist con canciones, versículos, diapositivas y bloques", "Modo Músico con acordes, cambio de tono y avance según el tempo", "Equipos y grupos con roles, confirmaciones y recordatorios", "Pantalla de escenario para quien está en la plataforma", "Letras para la transmisión en vivo: un enlace con fondo transparente y solo la letra, para agregarlo en OBS como fuente de navegador (YouTube, Facebook)"].map(li).join("")}</ul>
      <h2>Planes y precios (USD)</h2>
      <ul>${planes}</ul>
      <h2>Pagos seguros con Paddle.com</h2>
      <p>${esc(RESPALDO_PADDLE)}</p>
      <p>Prueba gratis de 30 días del plan Iglesia (se registra una tarjeta; si cancelas antes, no se cobra). Pagos procesados por Paddle.com. Reembolso completo dentro de los 14 días siguientes a cualquier pago.</p>
      <h2>Preguntas frecuentes</h2>
      ${preguntas}
      <p><a href="/web/precios">Precios</a> · <a href="/web/terminos">Términos</a> · <a href="/web/privacidad">Privacidad</a> · <a href="/web/reembolsos">Reembolsos</a> · <a href="mailto:${esc(CORREO_SOPORTE)}">Correo</a> · <a href="https://wa.me/${WHATSAPP_SOPORTE}">WhatsApp</a> · ${REDES.map((r) => `<a href="${esc(r.url)}">${esc(r.nombre)}</a>`).join(" · ")}</p>
    </div>`;
}
