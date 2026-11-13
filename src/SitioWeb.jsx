// Página web pública de WorshipFlow (pedido de Eldin, 2026-11-10): inicio, precios, términos,
// privacidad y reembolsos. Vive en /web/... dentro de la misma app (main.jsx la muestra según la
// dirección), así que NO toca el inicio de sesión ni la app de las iglesias actuales. Paddle revisa
// estas páginas (precios + términos + privacidad + reembolsos) antes de aprobar la cuenta de cobro.
//
// Rediseño (2026-11-11): lienzo blanco, un solo acento naranja de marca, letra Inter con tracking
// cerrado, bandas grises para separar y pie oscuro. El logo es el ícono oficial (WorshipFlowIcon).
// Los planes, precios y la tabla salen de lib/planes.js: no se escriben a mano aquí.
import { useEffect, useState } from "react";
import { Radio, Music, ListMusic, BookOpen, Users, Tv, Check, MessageCircle, Menu, X, Minus, Plus, Smartphone, Tablet, Monitor, Cast } from "lucide-react";
import WorshipFlowIcon from "./WorshipFlowIcon.jsx";
import { PLANES, COMPARATIVO } from "./lib/planes.js";
import { CORREO_SOPORTE, WHATSAPP_SOPORTE } from "./lib/soporte.js";
import { direccionApp } from "./lib/portada.js";

// "Abrir la app web" / "Entrar": en worshipflowapp.com lleva a app.worshipflowapp.com; en la dirección vieja, a "/".
const URL_APP = direccionApp(typeof window !== "undefined" ? window.location.hostname : "");

const AZUL = "#16324F";
const NARANJA = "#E8821E";
const SOBRE_NARANJA = "#16233A"; // texto encima del naranja (contraste AA)
const TINTA = "#0E1726";
const TEXTO = "#16233A";
const SUAVE = "#5A6678";
const NIEBLA = "#F3F5F9";
const LINEA = "#E3E7EE";
const OSCURO = "#0B1626";
const RESPONSABLE = "Eldin Mcfarlane";
const PAIS = "Guatemala";
const ACTUALIZADO = "10 de noviembre de 2026";

const PAGINAS = [
  { ruta: "/web", nombre: "Inicio" },
  { ruta: "/web/precios", nombre: "Precios" },
  { ruta: "/web/terminos", nombre: "Términos" },
  { ruta: "/web/privacidad", nombre: "Privacidad" },
  { ruta: "/web/reembolsos", nombre: "Reembolsos" },
];

export const esRutaSitioWeb = (path) => /^\/web(\/(precios|terminos|privacidad|reembolsos))?\/?$/.test(path);

const whatsapp = (texto) => `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(texto)}`;
const PEDIR_CODIGO = whatsapp("Hola, quiero probar WorshipFlow en mi iglesia. ¿Me pueden dar un código de invitación?");

function irA(ruta, e) {
  if (e) e.preventDefault();
  window.history.pushState({}, "", ruta);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

function Enlace({ ruta, children, style, className }) {
  return <a href={ruta} className={className} onClick={(e) => irA(ruta, e)} style={{ color: "inherit", textDecoration: "none", ...style }}>{children}</a>;
}

// Botón principal (naranja) o secundario (texto). Un enlace externo abre en otra pestaña.
function Boton({ href, ruta, children, tipo = "principal", grande, style, mismaPestana }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: grande ? 50 : 44,
    padding: grande ? "13px 22px" : "10px 16px", borderRadius: 12, fontWeight: 600, fontSize: grande ? 16 : 14,
    textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap", boxSizing: "border-box",
  };
  const estilos = {
    principal: { background: NARANJA, color: SOBRE_NARANJA },
    oscuro: { background: TINTA, color: "#fff" },
    suave: { background: NIEBLA, color: TINTA },
    texto: { background: "transparent", color: TINTA, padding: grande ? "13px 8px" : "10px 6px" },
  };
  const s = { ...base, ...estilos[tipo], ...style };
  if (ruta) return <Enlace ruta={ruta} style={s}>{children}</Enlace>;
  return <a href={href} target={href?.startsWith("http") && !mismaPestana ? "_blank" : undefined} rel="noopener" style={s}>{children}</a>;
}

function Logo({ claro, tamano = 32 }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <WorshipFlowIcon size={tamano} style={{ borderRadius: tamano * 0.22 }} />
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", color: claro ? "#fff" : TINTA }}>WorshipFlow</span>
    </span>
  );
}

function BarraAviso() {
  return (
    <div style={{ background: OSCURO, color: "#fff", padding: "10px 16px", textAlign: "center", fontSize: 12.5, fontWeight: 500, lineHeight: 1.5 }}>
      Cada iglesia nueva tiene 14 días del plan Iglesia completo. Sin tarjeta.{" "}
      <Enlace ruta="/web/precios" style={{ color: NARANJA, fontWeight: 700 }}>Ver planes →</Enlace>
    </div>
  );
}

function Encabezado({ ruta }) {
  const [menu, setMenu] = useState(false);
  const enlace = (r, nombre) => (
    <Enlace ruta={r} style={{ color: ruta === r ? TINTA : SUAVE, fontWeight: ruta === r ? 600 : 500 }}>{nombre}</Enlace>
  );
  return (
    <>
      <BarraAviso />
      <header style={{ background: "#fff", borderBottom: `1px solid ${LINEA}`, position: "sticky", top: 0, zIndex: 20 }}>
        <nav style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <Enlace ruta="/web" style={{ display: "flex" }}><Logo /></Enlace>
          <div className="sw-escritorio" style={{ display: "flex", alignItems: "center", gap: 28, fontSize: 14 }}>
            {enlace("/web", "Inicio")}
            {enlace("/web/precios", "Precios")}
          </div>
          <div className="sw-escritorio" style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 14 }}>
            <a href={URL_APP} style={{ color: TINTA, textDecoration: "none", fontWeight: 500 }}>Abrir la app web</a>
            <Boton href={PEDIR_CODIGO}>Probar gratis</Boton>
          </div>
          <button className="sw-celular" onClick={() => setMenu((v) => !v)} aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu}
            style={{ background: NIEBLA, border: "none", color: TINTA, borderRadius: 12, width: 44, height: 44, display: "none", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {menu ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
        {menu && (
          <div className="sw-celular" style={{ display: "none", flexDirection: "column", gap: 4, padding: "0 20px 16px", fontSize: 16, fontWeight: 600 }}>
            <Enlace ruta="/web" style={{ padding: "12px 4px", color: TINTA }}>Inicio</Enlace>
            <Enlace ruta="/web/precios" style={{ padding: "12px 4px", color: TINTA }}>Precios</Enlace>
            <a href={URL_APP} style={{ color: TINTA, textDecoration: "none", padding: "12px 4px" }}>Abrir la app web</a>
            <Boton href={PEDIR_CODIGO} grande style={{ marginTop: 6 }}><MessageCircle size={17} /> Probar gratis</Boton>
          </div>
        )}
      </header>
    </>
  );
}

function Pie() {
  const col = (titulo, hijos) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 140 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>{titulo}</span>
      {hijos}
    </div>
  );
  const link = { fontSize: 14, color: "#B9C2D0", textDecoration: "none" };
  return (
    <footer style={{ background: OSCURO, color: "#fff", padding: "64px 20px 36px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 48 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>
            <Logo claro />
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#B9C2D0" }}>Todo el culto, en una sola app. Hecha para iglesias, en español.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 56 }}>
            {col("Producto", <>
              <Enlace ruta="/web" style={link}>Inicio</Enlace>
              <Enlace ruta="/web/precios" style={link}>Precios</Enlace>
              <a href={URL_APP} style={link}>Abrir la app web</a>
            </>)}
            {col("Legal", <>
              <Enlace ruta="/web/terminos" style={link}>Términos</Enlace>
              <Enlace ruta="/web/privacidad" style={link}>Privacidad</Enlace>
              <Enlace ruta="/web/reembolsos" style={link}>Reembolsos</Enlace>
            </>)}
            {col("Contacto", <>
              <a href={`mailto:${CORREO_SOPORTE}`} style={link}>Correo</a>
              <a href={whatsapp("Hola, tengo una pregunta sobre WorshipFlow.")} target="_blank" rel="noopener" style={link}>WhatsApp</a>
            </>)}
          </div>
        </div>
        <div style={{ borderTop: "1px solid #1E2A3B", paddingTop: 22, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, fontSize: 12.5, color: "#8A96A8" }}>
          <span>© 2026 WorshipFlow · {RESPONSABLE}, {PAIS}</span>
          <span>Precios en dólares estadounidenses (USD)</span>
        </div>
      </div>
    </footer>
  );
}

const contenedor = { maxWidth: 1200, margin: "0 auto", padding: "0 20px" };
const eyebrow = { alignSelf: "flex-start", background: NIEBLA, color: SUAVE, fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 6 };
const h2 = { margin: 0, fontSize: "clamp(30px, 4.6vw, 46px)", lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.035em", color: TINTA };

const FUNCIONES = [
  { icono: Radio, titulo: "Proyección en vivo", texto: "Letras y versículos en el proyector o la TV, con pantalla en negro, temas de fondo y videos. Se controla desde el celular." },
  { icono: Music, titulo: "Modo Músico", texto: "Acordes arriba de la letra, transporte de tono, auto-avance según el tempo y tap tempo para recalibrar en vivo." },
  { icono: ListMusic, titulo: "Eventos y setlist", texto: "Arma el culto con canciones, versículos, slides y bloques. Crea eventos desde plantillas en segundos." },
  { icono: BookOpen, titulo: "Biblia integrada", texto: "RVR1960, NVI, TLA, DHH y NTV. Busca un pasaje y proyéctalo al instante." },
  { icono: Users, titulo: "Equipos y ministerios", texto: "Roles, confirmaciones y recordatorios. Cada ministerio con su planificación y recursos." },
  { icono: Tv, titulo: "Pantalla de escenario", texto: "Teleprompter para quien está en la plataforma: qué sigue, la letra y el reloj." },
];

const DISPOSITIVOS = [
  { icono: Smartphone, nombre: "Celular", texto: "Controla el culto desde tu mano." },
  { icono: Tablet, nombre: "Tablet", texto: "Acordes y letra para los músicos." },
  { icono: Monitor, nombre: "Computadora", texto: "Prepara eventos con pantalla grande." },
  { icono: Cast, nombre: "Proyector y TV", texto: "Conecta la pantalla y proyecta." },
];

const PASOS = [
  { titulo: "Pide tu código", texto: "Escríbenos por WhatsApp y te damos tu código de invitación para crear tu iglesia." },
  { titulo: "Invita a tu equipo", texto: "Agrega a tus músicos, cantantes y técnicos. Cada uno ve sus roles y confirma." },
  { titulo: "Proyecta el domingo", texto: "Arma el setlist, conecta la pantalla y controla todo desde el celular." },
];

const PREGUNTAS = [
  ["¿Necesito instalar algo?", "No. WorshipFlow funciona en el navegador del celular, tablet o computadora, y se puede instalar como app desde el mismo navegador."],
  ["¿Qué cuenta como miembro?", "Cada persona de tu equipo con su propia cuenta. La congregación, las pantallas y las TV conectadas no cuentan."],
  ["¿Puedo cambiar de plan?", "Sí, cuando quieras. Si bajas de plan no se borra nada: lo que pase del límite queda guardado, solo no se puede agregar más."],
  ["¿Cómo pago?", "Por ahora con transferencia o PayPal: escríbenos por WhatsApp y activamos tu plan. Pronto también con tarjeta directo en la app."],
  ["¿Hay prueba gratis?", "Sí. Cada iglesia nueva tiene 14 días del plan Iglesia completo. Después sigue gratis en el plan Gratis si no elige un plan de pago."],
];

// Maqueta de la consola en vivo (ilustración, no la app real). La letra es de un himno de dominio público.
function MaquetaEnVivo() {
  const orden = [["Bienvenida", "Slide"], ["Santo, Santo, Santo", "Canción · D"], ["Salmo 100", "Versículo · RVR1960"], ["Canción de respuesta", "Canción · G"], ["Anuncios", "Bloque"]];
  return (
    <div aria-hidden="true" style={{ background: NIEBLA, borderRadius: 16, padding: "clamp(14px, 3vw, 28px)" }}>
      <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${LINEA}`, overflow: "hidden", display: "flex", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 190px", borderRight: `1px solid ${NIEBLA}`, padding: "14px 0" }}>
          <div style={{ padding: "0 14px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: TINTA }}>Culto del domingo</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#C23B32", borderRadius: 6, padding: "2px 6px" }}>EN VIVO</span>
          </div>
          {orden.map(([t, k], i) => (
            <div key={t} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 14px", background: i === 1 ? "#FFF4E8" : "transparent", boxShadow: i === 1 ? `inset 3px 0 0 ${NARANJA}` : "none" }}>
              <span style={{ fontSize: 11, color: "#8A96A8", width: 14 }}>{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: TINTA, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
                <span style={{ display: "block", fontSize: 11, color: SUAVE }}>{k}</span>
              </span>
            </div>
          ))}
        </div>
        <div style={{ flex: "2 1 260px", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: SUAVE, fontWeight: 500 }}><span>● AL AIRE</span><span>Coro 1 de 3</span></div>
          <div style={{ aspectRatio: "16 / 9", background: OSCURO, borderRadius: 10, border: "2px solid #C23B32", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, color: "#fff", textAlign: "center", padding: 12 }}>
            <span style={{ fontSize: "clamp(16px, 2vw, 22px)", fontWeight: 600 }}>Santo, Santo, Santo</span>
            <span style={{ fontSize: "clamp(13px, 1.5vw, 16px)", color: "#B9C2D0" }}>Señor omnipotente</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {["Anterior", "Siguiente", "Negro"].map((b, i) => (
              <span key={b} style={{ fontSize: 12, fontWeight: 600, textAlign: "center", padding: "8px 0", borderRadius: 8, background: i === 1 ? NARANJA : NIEBLA, color: i === 1 ? SOBRE_NARANJA : TINTA }}>{b}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Inicio() {
  return (
    <>
      <Encabezado ruta="/web" />
      <main>
        {/* Portada */}
        <section style={{ ...contenedor, paddingTop: "clamp(48px, 8vw, 88px)", paddingBottom: "clamp(56px, 8vw, 96px)", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 22 }}>
            <span style={eyebrow}>Hecha para iglesias, en español</span>
            <h1 style={{ margin: 0, fontSize: "clamp(40px, 7vw, 68px)", lineHeight: 1.02, fontWeight: 700, letterSpacing: "-0.04em", color: TINTA }}>Todo el culto, en una sola app.</h1>
            <p style={{ margin: 0, fontSize: "clamp(17px, 2.2vw, 20px)", lineHeight: 1.5, color: SUAVE, maxWidth: 540 }}>
              Proyecta letras y versículos, prepara el setlist, coordina a tu equipo y toca con acordes que avanzan solos. Desde el celular.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Boton href={PEDIR_CODIGO} grande><MessageCircle size={18} /> Pedir mi código</Boton>
              <Boton href={URL_APP} mismaPestana tipo="oscuro" grande>Abrir la app web</Boton>
              <Boton ruta="/web/precios" tipo="texto" grande>Ver planes →</Boton>
            </div>
            <span style={{ fontSize: 13, color: SUAVE }}>14 días con todo incluido · Sin tarjeta · Funciona en el navegador</span>
          </div>
          <div style={{ flex: "1 1 480px", minWidth: 0 }}><MaquetaEnVivo /></div>
        </section>

        {/* Dispositivos */}
        <section style={{ background: NIEBLA, padding: "56px 0" }}>
          <div style={{ ...contenedor, display: "flex", flexWrap: "wrap", gap: 32, alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ ...h2, fontSize: "clamp(26px, 3.4vw, 32px)", flex: "1 1 300px", maxWidth: 420 }}>No hay nada que instalar. Funciona en lo que ya tienes.</h2>
            <div style={{ flex: "2 1 520px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              {DISPOSITIVOS.map(({ icono: Icono, nombre, texto }) => (
                <div key={nombre} style={{ background: "#fff", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                  <Icono size={20} color={AZUL} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: TINTA, marginTop: 6 }}>{nombre}</span>
                  <span style={{ fontSize: 13.5, color: SUAVE, lineHeight: 1.45 }}>{texto}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Funciones */}
        <section style={{ ...contenedor, padding: "clamp(64px, 9vw, 96px) 20px", display: "flex", flexDirection: "column", gap: 40 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 20 }}>
            <h2 style={{ ...h2, maxWidth: 620 }}>Lo que tu iglesia necesita el domingo</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: SUAVE, maxWidth: 400 }}>Desde el ensayo del jueves hasta el último coro del culto, todo vive en el mismo lugar.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 16 }}>
            {FUNCIONES.map(({ icono: Icono, titulo, texto }) => (
              <div key={titulo} style={{ border: `1px solid ${LINEA}`, borderRadius: 14, padding: 26, display: "flex", flexDirection: "column", gap: 10 }}>
                <Icono size={22} color={TINTA} strokeWidth={1.7} />
                <h3 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: TINTA }}>{titulo}</h3>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: SUAVE }}>{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Modo Músico */}
        <section style={{ borderTop: `1px solid ${NIEBLA}` }}>
          <div style={{ ...contenedor, padding: "clamp(64px, 9vw, 96px) 20px", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
            <div aria-hidden="true" style={{ flex: "1 1 460px", minWidth: 0, background: NIEBLA, borderRadius: 16, padding: "clamp(16px, 3vw, 32px)" }}>
              <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${LINEA}`, padding: 24, display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: TINTA }}>Santo, Santo, Santo</span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {["Tono: D", "72 BPM", "Auto-avance"].map((t) => <span key={t} style={{ fontSize: 12, fontWeight: 600, background: NIEBLA, borderRadius: 6, padding: "4px 8px", color: TINTA }}>{t}</span>)}
                  </span>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 15.5, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div><div style={{ fontWeight: 700, color: "#1F8A73", whiteSpace: "pre" }}>D          G      D</div><div style={{ whiteSpace: "pre", color: TINTA }}>Santo, Santo, Santo,</div></div>
                  <div><div style={{ fontWeight: 700, color: "#1F8A73", whiteSpace: "pre" }}>Bm      A       D</div><div style={{ whiteSpace: "pre", color: TINTA }}>Señor omnipotente</div></div>
                </div>
                <div style={{ height: 4, background: NIEBLA, borderRadius: 2, overflow: "hidden" }}><div style={{ width: "42%", height: 4, background: NARANJA }} /></div>
              </div>
            </div>
            <div style={{ flex: "1 1 380px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: SUAVE }}>Modo Músico</span>
              <h2 style={h2}>Acordes que avanzan solos.</h2>
              <p style={{ margin: 0, fontSize: 17, lineHeight: 1.55, color: SUAVE, maxWidth: 480 }}>
                Los músicos ven los acordes arriba de la letra, cambian el tono con un toque y la canción avanza sola al ritmo del tempo. Si la banda acelera, un tap tempo lo recalibra en vivo.
              </p>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Transporte de tono para cada voz", "Auto-avance según el tempo", "Tap tempo y modo dirigir"].map((t) => (
                  <li key={t} style={{ display: "flex", gap: 10, fontSize: 15, color: TINTA }}><Check size={18} color={TINTA} style={{ flexShrink: 0, marginTop: 2 }} />{t}</li>
                ))}
              </ul>
              <Enlace ruta="/web/precios" style={{ alignSelf: "flex-start", fontSize: 14.5, fontWeight: 700, color: "#B4610F", minHeight: 44, display: "inline-flex", alignItems: "center" }}>Incluido desde el plan Ministerio →</Enlace>
            </div>
          </div>
        </section>

        {/* Cómo empezar */}
        <section style={{ background: NIEBLA, padding: "clamp(64px, 9vw, 96px) 0" }}>
          <div style={{ ...contenedor, display: "flex", flexDirection: "column", gap: 36 }}>
            <h2 style={{ ...h2, textAlign: "center", fontSize: "clamp(28px, 4vw, 40px)" }}>Listos para el domingo en tres pasos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {PASOS.map((p, i) => (
                <div key={p.titulo} style={{ background: "#fff", borderRadius: 14, padding: 30, display: "flex", flexDirection: "column", gap: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: SUAVE }}>0{i + 1}</span>
                  <h3 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: TINTA }}>{p.titulo}</h3>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: SUAVE }}>{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LlamadoFinal titulo="Empieza gratis." texto="14 días con todo incluido. Sin tarjeta." />
      </main>
      <Pie />
    </>
  );
}

function LlamadoFinal({ titulo, texto, gris }) {
  return (
    <section style={{ ...contenedor, padding: "clamp(64px, 9vw, 96px) 20px" }}>
      <div style={{ border: gris ? "none" : `1px solid ${LINEA}`, background: gris ? NIEBLA : "#fff", borderRadius: 16, padding: "clamp(32px, 5vw, 56px) clamp(24px, 4vw, 48px)", display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <h2 style={{ ...h2, fontSize: "clamp(30px, 4.4vw, 44px)" }}>{titulo}</h2>
          <p style={{ margin: 0, fontSize: 18, color: SUAVE, lineHeight: 1.5 }}>{texto}</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Boton href={PEDIR_CODIGO} grande><MessageCircle size={18} /> Pedir mi código</Boton>
          {!gris && <Boton ruta="/web/precios" tipo="texto" grande>Ver planes →</Boton>}
        </div>
      </div>
    </section>
  );
}

const precioTexto = (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;

function Precios() {
  const [anual, setAnual] = useState(false);
  const [abierta, setAbierta] = useState(0);
  return (
    <>
      <Encabezado ruta="/web/precios" />
      <main>
        <section style={{ ...contenedor, paddingTop: "clamp(48px, 7vw, 72px)", paddingBottom: 28, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(38px, 6vw, 60px)", lineHeight: 1.05, fontWeight: 700, letterSpacing: "-0.04em", color: TINTA }}>Planes para cada iglesia</h1>
          <p style={{ margin: 0, fontSize: "clamp(16px, 2vw, 19px)", color: SUAVE }}>Empieza gratis. Cambia de plan cuando quieras.</p>
          <div role="group" aria-label="Periodo de pago" style={{ display: "inline-flex", background: NIEBLA, borderRadius: 12, padding: 4, marginTop: 6 }}>
            {[false, true].map((a) => (
              <button key={String(a)} onClick={() => setAnual(a)} aria-pressed={anual === a}
                style={{ border: "none", borderRadius: 10, padding: "10px 18px", minHeight: 44, fontSize: 14, fontWeight: anual === a ? 700 : 500, cursor: "pointer", fontFamily: "inherit", background: anual === a ? "#fff" : "transparent", color: anual === a ? TINTA : SUAVE, boxShadow: anual === a ? "0 1px 3px rgba(14,23,38,0.12)" : "none" }}>
                {a ? "Anual · 2 meses gratis" : "Mensual"}
              </button>
            ))}
          </div>
        </section>

        <section style={{ ...contenedor, paddingBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 16, alignItems: "stretch" }}>
            {PLANES.map((p) => {
              const destacado = p.id === "ministerio";
              const gratis = p.precio === 0;
              const mensaje = whatsapp(`Hola, quiero el plan ${p.nombre} de WorshipFlow (${anual ? `$${p.precioAnual} al año` : `$${p.precio} al mes`}).`);
              return (
                <div key={p.id} style={{ border: destacado ? `2px solid ${NARANJA}` : `1px solid ${LINEA}`, borderRadius: 16, padding: destacado ? 25 : 26, display: "flex", flexDirection: "column", gap: 10, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, minHeight: 24 }}>
                    <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: TINTA }}>{p.nombre}</span>
                    {destacado && <span style={{ fontSize: 11, fontWeight: 700, color: SOBRE_NARANJA, background: NARANJA, borderRadius: 6, padding: "3px 8px" }}>Recomendado</span>}
                  </div>
                  <span style={{ fontSize: 14, color: SUAVE, lineHeight: 1.45, minHeight: 40 }}>{p.resumen}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, paddingTop: 6 }}>
                    <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: TINTA }}>{gratis ? "$0" : precioTexto(anual ? p.precioAnual : p.precio)}</span>
                    <span style={{ fontSize: 14, color: SUAVE }}>{gratis ? "para siempre" : anual ? "/año" : "/mes"}</span>
                  </div>
                  <span style={{ fontSize: 12.5, color: SUAVE, minHeight: 18 }}>
                    {gratis ? "Sin tarjeta" : anual ? `Equivale a ${precioTexto(Math.round((p.precioAnual / 12) * 100) / 100)} al mes` : `o ${precioTexto(p.precioAnual)} al año`}
                  </span>
                  <Boton href={gratis ? PEDIR_CODIGO : mensaje} tipo={destacado ? "principal" : gratis ? "suave" : "oscuro"} style={{ margin: "8px 0 6px", width: "100%" }}>
                    {gratis ? "Empezar gratis" : "Elegir plan"}
                  </Boton>
                  <div style={{ borderTop: `1px solid ${NIEBLA}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                    {p.incluye.map((t) => (
                      <div key={t} style={{ display: "flex", gap: 9, fontSize: 14, lineHeight: 1.45, color: TEXTO }}>
                        <Check size={16} color={TINTA} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} /> {t}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: "center", fontSize: 13, color: SUAVE, margin: "22px 0 0" }}>
            Precios en dólares estadounidenses (USD). Ver <Enlace ruta="/web/reembolsos" style={{ color: TINTA, textDecoration: "underline" }}>política de reembolsos</Enlace>.
          </p>
        </section>

        <section style={{ ...contenedor, paddingTop: "clamp(56px, 8vw, 80px)", display: "flex", flexDirection: "column", gap: 24 }}>
          <h2 style={{ ...h2, fontSize: "clamp(28px, 4vw, 40px)" }}>Compara los planes</h2>
          <Comparativo />
        </section>

        <section style={{ ...contenedor, paddingTop: "clamp(56px, 8vw, 80px)", display: "flex", flexWrap: "wrap", gap: 40 }}>
          <div style={{ flex: "1 1 280px", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
            <h2 style={{ ...h2, fontSize: "clamp(28px, 4vw, 40px)" }}>Preguntas frecuentes</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: SUAVE }}>
              ¿Otra duda? <a href={whatsapp("Hola, tengo una pregunta sobre los planes de WorshipFlow.")} target="_blank" rel="noopener" style={{ color: TINTA, textDecoration: "underline" }}>Escríbenos por WhatsApp</a>.
            </p>
          </div>
          <div style={{ flex: "2 1 520px", minWidth: 0 }}>
            {PREGUNTAS.map(([p, r], i) => (
              <div key={p} style={{ borderBottom: `1px solid ${LINEA}` }}>
                <button onClick={() => setAbierta(abierta === i ? null : i)} aria-expanded={abierta === i}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, background: "none", border: "none", padding: "20px 0", minHeight: 44, fontSize: 17, fontWeight: 600, letterSpacing: "-0.015em", color: TINTA, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                  {p}
                  <Plus size={20} color={SUAVE} style={{ flexShrink: 0, transform: abierta === i ? "rotate(45deg)" : "none", transition: "transform .2s" }} />
                </button>
                {abierta === i && <p style={{ margin: 0, padding: "0 0 20px", fontSize: 15, lineHeight: 1.6, color: SUAVE, maxWidth: 640 }}>{r}</p>}
              </div>
            ))}
          </div>
        </section>

        <LlamadoFinal gris titulo="Prueba el plan Iglesia 14 días." texto="Después sigue gratis si no eliges un plan de pago. Sin tarjeta." />
      </main>
      <Pie />
    </>
  );
}

function Comparativo() {
  const celda = { padding: "13px 12px", fontSize: 14, borderBottom: `1px solid ${NIEBLA}`, textAlign: "center", verticalAlign: "middle", color: TEXTO };
  const primera = { ...celda, textAlign: "left", position: "sticky", left: 0, background: "#fff", minWidth: 170, boxShadow: "6px 0 8px -8px rgba(14,23,38,0.25)" };
  const valor = (v) => v === true ? <Check size={18} color={TINTA} strokeWidth={2.4} aria-label="Incluido" style={{ display: "block", margin: "0 auto" }} />
    : v === false ? <Minus size={16} color="#B9C2D0" aria-label="No incluido" style={{ display: "block", margin: "0 auto" }} />
    : <span style={{ fontWeight: 500 }}>{v}</span>;
  return (
    <div style={{ border: `1px solid ${LINEA}`, borderRadius: 14, overflowX: "auto", background: "#fff" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
        <thead>
          <tr>
            <th scope="col" style={{ ...primera, fontWeight: 600, fontSize: 12, color: SUAVE, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${LINEA}` }}>Función</th>
            {PLANES.map((p) => (
              <th key={p.id} scope="col" style={{ ...celda, borderBottom: `1px solid ${LINEA}`, background: p.id === "ministerio" ? "#FAFBFD" : undefined, boxShadow: p.id === "ministerio" ? `inset 0 2px 0 ${NARANJA}` : undefined }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: TINTA }}>{p.nombre}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: SUAVE, marginTop: 2 }}>{p.precio === 0 ? "$0" : `${precioTexto(p.precio)}/mes`}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARATIVO.map(({ grupo, filas }) => [
            <tr key={grupo}><td colSpan={5} style={{ ...celda, textAlign: "left", fontWeight: 700, fontSize: 12, color: TINTA, background: NIEBLA, textTransform: "uppercase", letterSpacing: "0.04em" }}>{grupo}</td></tr>,
            ...filas.map(([nombre, ...vals]) => (
              <tr key={nombre}>
                <td style={primera}>{nombre}</td>
                {vals.map((v, i) => <td key={i} style={{ ...celda, background: PLANES[i].id === "ministerio" ? "#FAFBFD" : undefined }}>{valor(v)}</td>)}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}

function Legal({ ruta, titulo, children }) {
  return (
    <>
      <Encabezado ruta={ruta} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "clamp(40px, 6vw, 64px) 20px 72px", lineHeight: 1.7, fontSize: 15.5, color: "#33415A" }}>
        <h1 style={{ color: TINTA, fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.1, margin: "0 0 8px" }}>{titulo}</h1>
        <p style={{ fontSize: 12.5, color: SUAVE, margin: "0 0 24px" }}>Última actualización: {ACTUALIZADO}</p>
        {children}
      </main>
      <Pie />
    </>
  );
}
const H = ({ children }) => <h2 style={{ color: TINTA, fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", margin: "32px 0 8px" }}>{children}</h2>;
const correo = <a href={`mailto:${CORREO_SOPORTE}`} style={{ color: TINTA, textDecoration: "underline" }}>{CORREO_SOPORTE}</a>;

function Terminos() {
  return (
    <Legal ruta="/web/terminos" titulo="Términos del servicio">
      <p>WorshipFlow es una aplicación de gestión y presentación para iglesias (cancionero, eventos, proyección en vivo, equipos y ministerios). El servicio lo presta {RESPONSABLE}, persona individual con domicilio en {PAIS} ("nosotros"). Al crear una cuenta o usar la app aceptas estos términos.</p>
      <H>Cuentas</H>
      <p>Cada iglesia tiene su propio espacio, separado del de cualquier otra. Sus administradores deciden quién tiene acceso y son responsables de las cuentas de su equipo. Cuida tu contraseña: lo que se haga con tu cuenta es tu responsabilidad.</p>
      <H>Planes y pagos</H>
      <p>WorshipFlow ofrece un plan Gratis y planes de pago (Ministerio, Crecimiento e Iglesia) con los límites y precios publicados en la página de <Enlace ruta="/web/precios" style={{ color: TINTA, textDecoration: "underline" }}>precios</Enlace>. Los planes de pago se cobran por adelantado, de forma mensual o anual, en dólares estadounidenses. Si un plan de pago vence o no se renueva, la iglesia pasa al plan Gratis: no se borra ningún dato, pero no se puede agregar más de lo que permite ese plan. Podemos cambiar los precios avisando con al menos 30 días de anticipación; el cambio aplica a partir de la siguiente renovación.</p>
      <H>Prueba gratis</H>
      <p>Las iglesias nuevas pueden tener un periodo de prueba del plan Iglesia. Al terminar, pasan al plan Gratis si no eligen un plan de pago. La prueba no requiere tarjeta.</p>
      <H>Cancelación y reembolsos</H>
      <p>Puedes cancelar cuando quieras; el plan sigue activo hasta el final del periodo pagado. Los reembolsos se rigen por nuestra <Enlace ruta="/web/reembolsos" style={{ color: TINTA, textDecoration: "underline" }}>política de reembolsos</Enlace>.</p>
      <H>Uso aceptable</H>
      <p>Usa la app para organizar los cultos, canciones, equipos y la comunicación de tu iglesia. No está permitido subir contenido ilegal u ofensivo, intentar acceder a datos de otra iglesia, ni usar la app para enviar spam. Podemos suspender cuentas que incumplan estas reglas.</p>
      <H>Tu contenido y derechos de autor</H>
      <p>Lo que tu iglesia sube (canciones, letras, eventos, imágenes) sigue siendo tuyo; solo lo guardamos para que la app funcione. Tu iglesia es responsable de contar con las licencias necesarias para proyectar canciones con derechos de autor (por ejemplo, una licencia CCLI o equivalente).</p>
      <H>Disponibilidad</H>
      <p>Hacemos lo posible para que la app funcione siempre, pero no garantizamos que esté libre de interrupciones o errores. Podemos hacer mantenimiento o cambios para mejorarla. En la medida que lo permita la ley, no somos responsables por daños indirectos derivados del uso o la imposibilidad de usar la app, y nuestra responsabilidad total no excederá lo que tu iglesia haya pagado en los últimos 12 meses.</p>
      <H>Cambios a estos términos</H>
      <p>Podemos actualizar estos términos. Si el cambio es importante, lo avisaremos en la app o por correo antes de que aplique.</p>
      <H>Contacto</H>
      <p>Escríbenos a {correo}.</p>
    </Legal>
  );
}

function Privacidad() {
  return (
    <Legal ruta="/web/privacidad" titulo="Política de privacidad">
      <p>Esta política explica qué datos recopila WorshipFlow, servicio prestado por {RESPONSABLE} ({PAIS}), y cómo los usa.</p>
      <H>Qué datos recopilamos</H>
      <ul>
        <li><strong>Cuenta:</strong> nombre, correo electrónico y, si entras con Google, tu foto de perfil.</li>
        <li><strong>Contenido de tu iglesia:</strong> canciones, eventos, asignaciones, ministerios y mensajes que tu equipo crea en la app.</li>
        <li><strong>Notificaciones:</strong> si las activas, la información técnica necesaria para enviarte avisos.</li>
        <li><strong>Pagos:</strong> si tu iglesia paga un plan, el nombre de la iglesia, el plan y las fechas. Los datos de tarjeta los procesa directamente el proveedor de pagos; nosotros nunca los vemos ni los guardamos.</li>
      </ul>
      <H>Cómo los usamos</H>
      <p>Solo para hacer funcionar la app dentro de tu iglesia: mostrar tus asignaciones, mandarte recordatorios, permitir que tu equipo coordine los cultos, dar soporte y administrar tu plan. No usamos tus datos para publicidad y nunca los vendemos.</p>
      <H>Con quién los compartimos</H>
      <p>Con los proveedores que hacen funcionar el servicio: Supabase (base de datos e inicio de sesión), Vercel (alojamiento de la app), Anthropic (el asistente con IA, solo con lo que escribes en él) y el proveedor de pagos cuando corresponda. Cada iglesia solo ve sus propios datos.</p>
      <H>Inicio de sesión con Google</H>
      <p>Solo pedimos tu nombre, correo y foto. No accedemos a tu Gmail, Drive ni a ningún otro dato de tu cuenta de Google.</p>
      <H>Cuánto tiempo los guardamos</H>
      <p>Mientras tu cuenta o la de tu iglesia siga activa. Puedes pedir que se elimine tu cuenta al administrador de tu iglesia o escribiéndonos; la borramos en un plazo razonable, salvo lo que la ley obligue a conservar.</p>
      <H>Tus derechos</H>
      <p>Puedes pedir ver, corregir o eliminar tus datos escribiéndonos a {correo}.</p>
    </Legal>
  );
}

function Reembolsos() {
  return (
    <Legal ruta="/web/reembolsos" titulo="Política de reembolsos">
      <p>Queremos que tu iglesia esté contenta con WorshipFlow. Por eso:</p>
      <H>Primer pago: 14 días de garantía</H>
      <p>Si no estás conforme, te devolvemos el 100% de tu primer pago de cualquier plan, mensual o anual, si lo pides dentro de los 14 días siguientes al pago.</p>
      <H>Renovaciones</H>
      <p>Las renovaciones mensuales no son reembolsables, pero puedes cancelar cuando quieras y no se te volverá a cobrar; el plan sigue activo hasta el final del periodo pagado. En los planes anuales, si cancelas dentro de los 14 días siguientes a la renovación, te devolvemos el monto de la renovación.</p>
      <H>Cobros por error</H>
      <p>Si se te cobró dos veces o por un plan que no pediste, te devolvemos el monto completo.</p>
      <H>Cómo pedir un reembolso</H>
      <p>Escríbenos a {correo} o por WhatsApp con el nombre de tu iglesia y la fecha del pago. Respondemos en un máximo de 5 días hábiles, y el reembolso se hace por el mismo medio con el que pagaste.</p>
    </Legal>
  );
}

export default function SitioWeb() {
  const [ruta, setRuta] = useState(window.location.pathname.replace(/\/$/, "") || "/web");
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.pathname.replace(/\/$/, "") || "/web");
    window.addEventListener("popstate", alCambiar);
    // La página web siempre se ve clara (es la vitrina); main.jsx no le aplica el tema oscuro.
    document.body.style.background = "#fff";
    return () => window.removeEventListener("popstate", alCambiar);
  }, []);
  useEffect(() => {
    const p = PAGINAS.find((x) => x.ruta === ruta);
    document.title = p && p.ruta !== "/web" ? `${p.nombre} · WorshipFlow` : "WorshipFlow — Todo el culto en una sola app";
  }, [ruta]);

  const pagina = { "/web/precios": <Precios />, "/web/terminos": <Terminos />, "/web/privacidad": <Privacidad />, "/web/reembolsos": <Reembolsos /> }[ruta] || <Inicio />;
  return (
    <div className="sw" style={{ minHeight: "100vh", background: "#fff", color: TEXTO, fontFamily: "var(--wf-font-ui)", letterSpacing: "-0.01em", userSelect: "text", WebkitUserSelect: "text" }}>
      <style>{`
        .sw *, .sw *::before, .sw *::after { box-sizing: border-box; }
        @media (max-width: 760px) { .sw-escritorio { display: none !important; } .sw-celular { display: flex !important; } }
      `}</style>
      {pagina}
    </div>
  );
}
