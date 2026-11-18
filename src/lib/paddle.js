// Cobros con Paddle (pedido de Eldin, 2026-11-13).
//
// El pago SIEMPRE se hace en worshipflowapp.com/web/pagar (dominio público aprobado por Paddle), nunca dentro
// de app.worshipflowapp.com (Paddle no aprueba una dirección que pide iniciar sesión). Desde la app, "Pagar con
// tarjeta" lleva a esa página con el plan, el periodo, la iglesia y el correo; al terminar regresa a la app.
// Quien sube el plan es el aviso de Paddle (Edge Function paddle-webhook), no esta página.

// Token público de Paddle.js. "test_..." = modo de prueba (sandbox); "live_..." = cobros reales.
export const PADDLE_TOKEN = "live_265ee5f7cd9cd5db55861ec8e1a";

// Mientras se prueba con el sandbox, solo el super admin ve el botón de pagar con tarjeta.
export const PAGOS_SOLO_SUPER_ADMIN = false;

export const entornoPaddle = (token = PADDLE_TOKEN) => (token.startsWith("test_") ? "sandbox" : "production");
export const pagosConfigurados = (token = PADDLE_TOKEN) => token.startsWith("test_") || token.startsWith("live_");

// Precios de Paddle por plan y periodo: los del modo de prueba (sandbox) y los reales (live, 2026-11-17). Se usan
// los que corresponden al token. "prueba" = Iglesia mensual con 1 mes gratis (trial de Paddle, pide tarjeta).
const PRECIOS_SANDBOX = {
  ministerio: { mensual: "pri_01m7b85590yd962hrysezw192r", anual: "pri_01m7b85rw9fear6kcqbhv526px" },
  crecimiento: { mensual: "pri_01m7b828dt7zexxkyg8getyr7e", anual: "pri_01m7b838djdpz4xdjpk1kmjtty" },
  iglesia: { mensual: "pri_01m7b7q5bw2gv796ykfaqj8k9t", anual: "pri_01m7b7rr1caa03yk2fdtpb66nj" },
};
const PRECIOS_LIVE = {
  ministerio: { mensual: "pri_01m7p4n151m6z06qrwqjxf31dq", anual: "pri_01m7p4p77yaepcd2kw0415nwks" },
  crecimiento: { mensual: "pri_01m7p5198wc2nrbcpp3c72hnxt", anual: "pri_01m7p52nepd48n18gcm3wm8bnt" },
  iglesia: { mensual: "pri_01m7p57kacjcsmn0db54164mr6", anual: "pri_01m7p58m4pvxf9cvxd5kgabzs7", prueba: "pri_01m7pbervbwqyafheyppmyn6pk" },
};
export const preciosPaddle = (token = PADDLE_TOKEN) => (entornoPaddle(token) === "sandbox" ? PRECIOS_SANDBOX : PRECIOS_LIVE);
export const PRECIOS_PADDLE = preciosPaddle();
export const DIAS_PRUEBA_TARJETA = 30;

export const precioPaddle = (plan, periodo, token = PADDLE_TOKEN) => {
  const id = preciosPaddle(token)[plan]?.[periodo] ?? null;
  return id && id.startsWith("pri_") ? id : null;
};
// ¿Se puede ofrecer el mes gratis con tarjeta? (hace falta el precio con trial configurado en Paddle)
export const pruebaConTarjetaLista = (token = PADDLE_TOKEN) => pagosConfigurados(token) && !!precioPaddle("iglesia", "prueba", token);

export const URL_PAGO = "https://worshipflowapp.com/web/pagar";
export const URL_APP = "https://app.worshipflowapp.com/";

export function enlacePago({ plan, anual, prueba = false, iglesiaId, correo }) {
  const p = new URLSearchParams({ plan: prueba ? "iglesia" : plan, periodo: prueba ? "prueba" : anual ? "anual" : "mensual", iglesia: iglesiaId || "" });
  if (correo) p.set("correo", correo);
  return `${URL_PAGO}?${p.toString()}`;
}

// Lee y valida los datos de la página de pago. null si falta algo o no es válido.
export function leerPedidoPago(search) {
  const p = new URLSearchParams(search);
  const plan = p.get("plan");
  const periodo = p.get("periodo");
  const iglesia = p.get("iglesia") || "";
  const precio = precioPaddle(plan, periodo);
  if (!precio || !/^[0-9a-f-]{36}$/i.test(iglesia)) return null;
  const correo = p.get("correo") || "";
  return { plan, periodo, iglesia, precio, correo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo : "" };
}

// Carga Paddle.js una sola vez.
let cargando = null;
export function cargarPaddle(token = PADDLE_TOKEN) {
  if (typeof window === "undefined") return Promise.reject(new Error("Sin navegador"));
  if (window.Paddle?.Initialized) return Promise.resolve(window.Paddle);
  if (cargando) return cargando;
  cargando = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    s.async = true;
    s.onload = () => {
      try {
        if (entornoPaddle(token) === "sandbox") window.Paddle.Environment.set("sandbox");
        resolve(window.Paddle);
      } catch (e) { reject(e); }
    };
    s.onerror = () => { cargando = null; reject(new Error("No se pudo cargar el pago. Revisa tu conexión.")); };
    document.head.appendChild(s);
  });
  return cargando;
}
