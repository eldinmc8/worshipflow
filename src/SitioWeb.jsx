// Página web pública de WorshipFlow (pedido de Eldin, 2026-11-10): inicio, precios, términos,
// privacidad y reembolsos. Vive en /web/... dentro de la misma app (main.jsx la muestra según la
// dirección), así que NO toca el inicio de sesión ni la app de las iglesias actuales. Paddle revisa
// estas páginas (precios + términos + privacidad + reembolsos) antes de aprobar la cuenta de cobro.
import { useEffect, useState } from "react";
import { Radio, Music, ListMusic, BookOpen, Users, Tv, Check, MessageCircle, Menu, X, ChevronDown } from "lucide-react";
import WorshipFlowIcon from "./WorshipFlowIcon.jsx";
import { PLANES } from "./lib/planes.js";
import { CORREO_SOPORTE, WHATSAPP_SOPORTE } from "./lib/soporte.js";

const AZUL = "#16324F";
const NARANJA = "#E8821E";
const FONDO = "#F4F6FA";
const TEXTO = "#16233A";
const SUAVE = "#5A6678";
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

function Enlace({ ruta, children, style }) {
  return <a href={ruta} onClick={(e) => irA(ruta, e)} style={{ color: "inherit", textDecoration: "none", ...style }}>{children}</a>;
}

function Boton({ href, children, secundario, onClick }) {
  const estilo = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 22px", borderRadius: 14,
    fontWeight: 700, fontSize: 15, textDecoration: "none", cursor: "pointer", border: "none",
    background: secundario ? "rgba(255,255,255,0.14)" : NARANJA, color: "#fff",
    boxShadow: secundario ? "none" : "0 6px 18px rgba(232,130,30,0.35)",
  };
  return onClick
    ? <button onClick={onClick} style={estilo}>{children}</button>
    : <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener" style={estilo}>{children}</a>;
}

function Encabezado({ ruta, grande }) {
  const [menu, setMenu] = useState(false);
  return (
    <header style={{ position: "relative", overflow: "hidden", background: AZUL, color: "#fff", borderRadius: "0 0 32px 32px", padding: grande ? "18px 20px 56px" : "18px 20px 26px" }}>
      <div style={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,0.05)", top: -90, right: -70 }} />
      <div style={{ position: "absolute", width: 160, height: 160, borderRadius: "50%", background: "rgba(232,130,30,0.12)", bottom: -60, left: -40 }} />
      <nav style={{ position: "relative", maxWidth: 1040, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Enlace ruta="/web" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WorshipFlowIcon size={34} />
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600 }}>WorshipFlow</span>
        </Enlace>
        <div className="sw-nav-escritorio" style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 14, fontWeight: 600 }}>
          <Enlace ruta="/web" style={{ opacity: ruta === "/web" ? 1 : 0.75 }}>Inicio</Enlace>
          <Enlace ruta="/web/precios" style={{ opacity: ruta === "/web/precios" ? 1 : 0.75 }}>Precios</Enlace>
          <a href="/" style={{ color: "#fff", textDecoration: "none", opacity: 0.75 }}>Entrar</a>
          <a href={PEDIR_CODIGO} target="_blank" rel="noopener" style={{ background: NARANJA, color: "#fff", padding: "8px 14px", borderRadius: 12, textDecoration: "none" }}>Probar gratis</a>
        </div>
        <button className="sw-nav-celular" onClick={() => setMenu((v) => !v)} aria-label="Menú" style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 12, width: 40, height: 40, display: "none", alignItems: "center", justifyContent: "center" }}>
          {menu ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {menu && (
        <div style={{ position: "relative", maxWidth: 1040, margin: "14px auto 0", display: "flex", flexDirection: "column", gap: 4, fontWeight: 600 }}>
          <Enlace ruta="/web" style={{ padding: "10px 4px" }}>Inicio</Enlace>
          <Enlace ruta="/web/precios" style={{ padding: "10px 4px" }}>Precios</Enlace>
          <a href="/" style={{ color: "#fff", textDecoration: "none", padding: "10px 4px" }}>Entrar a la app</a>
        </div>
      )}
      {grande && (
        <div style={{ position: "relative", maxWidth: 1040, margin: "44px auto 0" }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "clamp(32px, 7vw, 54px)", lineHeight: 1.08, fontWeight: 600, margin: "0 0 16px", maxWidth: 680 }}>
            Todo el culto, <span style={{ color: NARANJA }}>en una sola app</span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 3.6vw, 18px)", lineHeight: 1.55, opacity: 0.85, maxWidth: 560, margin: "0 0 28px" }}>
            Proyecta letras y versículos, prepara el setlist, coordina a tu equipo y toca con acordes que avanzan solos. Hecha para iglesias, en español, desde el celular.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Boton href={PEDIR_CODIGO}><MessageCircle size={17} /> Probar gratis</Boton>
            <Boton secundario onClick={() => irA("/web/precios")}>Ver planes</Boton>
          </div>
        </div>
      )}
    </header>
  );
}

function Pie() {
  return (
    <footer style={{ maxWidth: 1040, margin: "0 auto", padding: "36px 20px 48px", color: SUAVE, fontSize: 13 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px", marginBottom: 12 }}>
        {PAGINAS.map((p) => <Enlace key={p.ruta} ruta={p.ruta} style={{ fontWeight: 600, color: AZUL }}>{p.nombre}</Enlace>)}
        <a href={`mailto:${CORREO_SOPORTE}`} style={{ fontWeight: 600, color: AZUL, textDecoration: "none" }}>Contacto</a>
      </div>
      <div>© 2026 WorshipFlow · {RESPONSABLE}, {PAIS}</div>
    </footer>
  );
}

const FUNCIONES = [
  { icono: Radio, color: "#C23B32", titulo: "Proyección en vivo", texto: "Letras y versículos en el proyector o la TV, con pantalla en negro, temas de fondo y videos. Se controla desde el celular." },
  { icono: Music, color: "#1F8A73", titulo: "Modo Músico", texto: "Acordes arriba de la letra, transporte de tono, auto-avance según el tempo y tap tempo para recalibrar en vivo." },
  { icono: ListMusic, color: "#5661B3", titulo: "Eventos y setlist", texto: "Arma el culto con canciones, versículos, slides y bloques. Crea eventos desde plantillas en segundos." },
  { icono: BookOpen, color: "#2F5FA8", titulo: "Biblia integrada", texto: "RVR1960, NVI, TLA, DHH y NTV. Busca un pasaje y proyéctalo al instante." },
  { icono: Users, color: "#B15EA0", titulo: "Equipos y ministerios", texto: "Roles, confirmaciones y recordatorios. Cada ministerio con su planificación y recursos." },
  { icono: Tv, color: NARANJA, titulo: "Pantalla de escenario", texto: "Teleprompter para quien está en la plataforma: qué sigue, la letra y el reloj." },
];

const PREGUNTAS = [
  ["¿Necesito instalar algo?", "No. WorshipFlow funciona en el navegador del celular, tablet o computadora, y se puede instalar como app desde el mismo navegador."],
  ["¿Qué cuenta como miembro?", "Cada persona de tu equipo con su propia cuenta. La congregación, las pantallas y las TV conectadas no cuentan."],
  ["¿Puedo cambiar de plan?", "Sí, cuando quieras. Si bajas de plan no se borra nada: lo que pase del límite queda guardado, solo no se puede agregar más."],
  ["¿Cómo pago?", "Por ahora con transferencia o PayPal: escríbenos por WhatsApp y activamos tu plan. Pronto también con tarjeta directo en la app."],
  ["¿Hay prueba gratis?", "Sí. Cada iglesia nueva tiene 14 días del plan Iglesia completo. Después sigue gratis en el plan Gratis si no elige un plan de pago."],
];

function Inicio() {
  return (
    <>
      <Encabezado ruta="/web" grande />
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 20px 0" }}>
        <h2 style={tituloSeccion}>Lo que tu iglesia necesita el domingo</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
          {FUNCIONES.map(({ icono: Icono, color, titulo, texto }) => (
            <div key={titulo} style={tarjeta}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: color + "1A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Icono size={21} color={color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{titulo}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: SUAVE }}>{texto}</div>
            </div>
          ))}
        </div>

        <div style={{ ...tarjeta, marginTop: 28, background: AZUL, color: "#fff", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Empieza gratis</div>
            <div style={{ opacity: 0.8, fontSize: 14 }}>14 días con todo incluido. Sin tarjeta.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Boton href={PEDIR_CODIGO}><MessageCircle size={17} /> Pedir mi código</Boton>
            <Boton secundario onClick={() => irA("/web/precios")}>Ver planes</Boton>
          </div>
        </div>
      </main>
      <Pie />
    </>
  );
}

function Precios() {
  const [anual, setAnual] = useState(false);
  const [abierta, setAbierta] = useState(null);
  return (
    <>
      <Encabezado ruta="/web/precios" />
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px 0" }}>
        <h1 style={{ ...tituloSeccion, fontSize: "clamp(28px, 6vw, 40px)", textAlign: "center", marginBottom: 8 }}>Planes para cada iglesia</h1>
        <p style={{ textAlign: "center", color: SUAVE, margin: "0 0 20px" }}>Empieza gratis. Cambia de plan cuando quieras.</p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", background: "#E6EAF1", borderRadius: 14, padding: 3 }}>
            {[false, true].map((a) => (
              <button key={String(a)} onClick={() => setAnual(a)} style={{ border: "none", borderRadius: 12, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", background: anual === a ? "#fff" : "transparent", color: TEXTO, boxShadow: anual === a ? "0 2px 8px rgba(22,50,79,0.12)" : "none" }}>
                {a ? "Anual · 2 meses gratis" : "Mensual"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, alignItems: "stretch" }}>
          {PLANES.map((p) => {
            const destacado = p.id === "ministerio";
            return (
              <div key={p.id} style={{ ...tarjeta, display: "flex", flexDirection: "column", boxShadow: destacado ? `0 0 0 2px ${p.color}, 0 8px 24px rgba(22,50,79,0.12)` : tarjeta.boxShadow, position: "relative" }}>
                {destacado && <span style={{ position: "absolute", top: -11, left: 18, background: p.color, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "3px 10px" }}>Recomendado</span>}
                <div style={{ fontWeight: 700, fontSize: 17, color: p.color }}>{p.nombre}</div>
                <div style={{ fontSize: 13, color: SUAVE, margin: "2px 0 12px" }}>{p.resumen}</div>
                <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 14 }}>
                  {p.precio === 0 ? "$0" : `$${anual ? p.precioAnual : p.precio}`}
                  <span style={{ fontSize: 13, fontWeight: 500, color: SUAVE }}>{p.precio === 0 ? " para siempre" : anual ? " /año" : " /mes"}</span>
                </div>
                <div style={{ flex: 1 }}>
                  {p.incluye.map((t) => (
                    <div key={t} style={{ display: "flex", gap: 7, fontSize: 13.5, marginBottom: 6, lineHeight: 1.4 }}>
                      <Check size={15} color={p.color} style={{ flexShrink: 0, marginTop: 2 }} /> {t}
                    </div>
                  ))}
                </div>
                <a href={p.precio === 0 ? PEDIR_CODIGO : whatsapp(`Hola, quiero el plan ${p.nombre} de WorshipFlow (${anual ? `$${p.precioAnual} al año` : `$${p.precio} al mes`}).`)} target="_blank" rel="noopener"
                  style={{ marginTop: 14, display: "block", textAlign: "center", padding: "11px 12px", borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: "none", background: p.precio === 0 ? "#E6EAF1" : p.color, color: p.precio === 0 ? TEXTO : "#fff" }}>
                  {p.precio === 0 ? "Empezar gratis" : "Elegir plan"}
                </a>
              </div>
            );
          })}
        </div>
        <p style={{ textAlign: "center", fontSize: 12.5, color: SUAVE, marginTop: 16 }}>Precios en dólares estadounidenses (USD). Ver <Enlace ruta="/web/reembolsos" style={{ color: "#2F5FA8" }}>política de reembolsos</Enlace>.</p>

        <h2 style={{ ...tituloSeccion, marginTop: 40 }}>Preguntas frecuentes</h2>
        {PREGUNTAS.map(([p, r], i) => (
          <div key={p} style={{ ...tarjeta, padding: 0, marginBottom: 10 }}>
            <button onClick={() => setAbierta(abierta === i ? null : i)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "none", border: "none", padding: "16px 18px", fontSize: 15, fontWeight: 700, color: TEXTO, cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
              {p} <ChevronDown size={18} style={{ flexShrink: 0, transform: abierta === i ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
            </button>
            {abierta === i && <div style={{ padding: "0 18px 16px", fontSize: 14, lineHeight: 1.6, color: SUAVE }}>{r}</div>}
          </div>
        ))}
      </main>
      <Pie />
    </>
  );
}

function Legal({ ruta, titulo, children }) {
  return (
    <>
      <Encabezado ruta={ruta} />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 0", lineHeight: 1.65, fontSize: 14.5, color: "#33415A" }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", color: AZUL, fontSize: 30, fontWeight: 600, margin: "0 0 4px" }}>{titulo}</h1>
        <p style={{ fontSize: 12.5, color: SUAVE, margin: "0 0 24px" }}>Última actualización: {ACTUALIZADO}</p>
        {children}
      </main>
      <Pie />
    </>
  );
}
const H = ({ children }) => <h2 style={{ color: AZUL, fontSize: 18, margin: "28px 0 8px" }}>{children}</h2>;
const correo = <a href={`mailto:${CORREO_SOPORTE}`} style={{ color: "#2F5FA8" }}>{CORREO_SOPORTE}</a>;

function Terminos() {
  return (
    <Legal ruta="/web/terminos" titulo="Términos del servicio">
      <p>WorshipFlow es una aplicación de gestión y presentación para iglesias (cancionero, eventos, proyección en vivo, equipos y ministerios). El servicio lo presta {RESPONSABLE}, persona individual con domicilio en {PAIS} ("nosotros"). Al crear una cuenta o usar la app aceptas estos términos.</p>
      <H>Cuentas</H>
      <p>Cada iglesia tiene su propio espacio, separado del de cualquier otra. Sus administradores deciden quién tiene acceso y son responsables de las cuentas de su equipo. Cuida tu contraseña: lo que se haga con tu cuenta es tu responsabilidad.</p>
      <H>Planes y pagos</H>
      <p>WorshipFlow ofrece un plan Gratis y planes de pago (Ministerio, Crecimiento e Iglesia) con los límites y precios publicados en la página de <Enlace ruta="/web/precios" style={{ color: "#2F5FA8" }}>precios</Enlace>. Los planes de pago se cobran por adelantado, de forma mensual o anual, en dólares estadounidenses. Si un plan de pago vence o no se renueva, la iglesia pasa al plan Gratis: no se borra ningún dato, pero no se puede agregar más de lo que permite ese plan. Podemos cambiar los precios avisando con al menos 30 días de anticipación; el cambio aplica a partir de la siguiente renovación.</p>
      <H>Prueba gratis</H>
      <p>Las iglesias nuevas pueden tener un periodo de prueba del plan Iglesia. Al terminar, pasan al plan Gratis si no eligen un plan de pago. La prueba no requiere tarjeta.</p>
      <H>Cancelación y reembolsos</H>
      <p>Puedes cancelar cuando quieras; el plan sigue activo hasta el final del periodo pagado. Los reembolsos se rigen por nuestra <Enlace ruta="/web/reembolsos" style={{ color: "#2F5FA8" }}>política de reembolsos</Enlace>.</p>
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

const tarjeta = { background: "#fff", borderRadius: 18, padding: 20, boxShadow: "0 4px 18px rgba(22,50,79,0.08)" };
const tituloSeccion = { fontFamily: "'Fraunces', serif", color: AZUL, fontSize: "clamp(24px, 5vw, 32px)", fontWeight: 600, margin: "0 0 18px" };

export default function SitioWeb() {
  const [ruta, setRuta] = useState(window.location.pathname.replace(/\/$/, "") || "/web");
  useEffect(() => {
    const alCambiar = () => setRuta(window.location.pathname.replace(/\/$/, "") || "/web");
    window.addEventListener("popstate", alCambiar);
    // La página web siempre se ve clara (es la vitrina); main.jsx no le aplica el tema oscuro.
    document.body.style.background = FONDO;
    return () => window.removeEventListener("popstate", alCambiar);
  }, []);
  useEffect(() => {
    const p = PAGINAS.find((x) => x.ruta === ruta);
    document.title = p && p.ruta !== "/web" ? `${p.nombre} · WorshipFlow` : "WorshipFlow — Todo el culto en una sola app";
  }, [ruta]);

  const pagina = { "/web/precios": <Precios />, "/web/terminos": <Terminos />, "/web/privacidad": <Privacidad />, "/web/reembolsos": <Reembolsos /> }[ruta] || <Inicio />;
  return (
    <div style={{ minHeight: "100vh", background: FONDO, color: TEXTO, fontFamily: "'Poppins', sans-serif", userSelect: "text", WebkitUserSelect: "text" }}>
      <style>{`
        @media (max-width: 720px) { .sw-nav-escritorio { display: none !important; } .sw-nav-celular { display: flex !important; } }
      `}</style>
      {pagina}
    </div>
  );
}
