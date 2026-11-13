// Cobros con Paddle (pedido de Eldin, 2026-11-13).
//
// El pago SIEMPRE se hace en worshipflowapp.com/web/pagar (dominio público aprobado por Paddle), nunca dentro
// de app.worshipflowapp.com (Paddle no aprueba una dirección que pide iniciar sesión). Desde la app, "Pagar con
// tarjeta" lleva a esa página con el plan, el periodo, la iglesia y el correo; al terminar regresa a la app.
// Quien sube el plan es el aviso de Paddle (Edge Function paddle-webhook), no esta página.

// Token público de Paddle.js. "test_..." = modo de prueba (sandbox); "live_..." = cobros reales.
export const PADDLE_TOKEN = "test_3ede9acf30e95270f0bbb341df6";

// Mientras se prueba con el sandbox, solo el super admin ve el botón de pagar con tarjeta.
export const PAGOS_SOLO_SUPER_ADMIN = true;

export const entornoPaddle = (token = PADDLE_TOKEN) => (token.startsWith("test_") ? "sandbox" : "production");
export const pagosConfigurados = (token = PADDLE_TOKEN) => token.startsWith("test_") || token.startsWith("live_");

// Precios de Paddle por plan y periodo (los del sandbox; al pasar a cobros reales se cambian por los live).
export const PRECIOS_PADDLE = {
  ministerio: { mensual: "pri_01m7b85590yd962hrysezw192r", anual: "pri_01m7b85rw9fear6kcqbhv526px" },
  crecimiento: { mensual: "pri_01m7b828dt7zexxkyg8getyr7e", anual: "pri_01m7b838djdpz4xdjpk1kmjtty" },
  iglesia: { mensual: "pri_01m7b7q5bw2gv796ykfaqj8k9t", anual: "pri_01m7b7rr1caa03yk2fdtpb66nj" },
};

export const precioPaddle = (plan, periodo) => PRECIOS_PADDLE[plan]?.[periodo] ?? null;

export const URL_PAGO = "https://worshipflowapp.com/web/pagar";
export const URL_APP = "https://app.worshipflowapp.com/";

export function enlacePago({ plan, anual, iglesiaId, correo }) {
  const p = new URLSearchParams({ plan, periodo: anual ? "anual" : "mensual", iglesia: iglesiaId || "" });
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
