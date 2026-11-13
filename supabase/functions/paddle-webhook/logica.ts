// Lógica pura de los avisos de Paddle (sin Deno ni Supabase) para poder probarla: firma y cambios del plan.
export const GRACIA_DIAS = 3;
export const TOLERANCIA_SEG = 5 * 60;

// Precios de Paddle → plan. Los del modo de prueba van aquí; los del modo real se agregan con el secreto
// PADDLE_PRECIOS = {"pri_...": {"plan": "ministerio", "periodo": "mensual"}, ...} sin tocar el código.
export const PRECIOS_PRUEBA: Record<string, { plan: string; periodo: string }> = {
  pri_01m7b85590yd962hrysezw192r: { plan: "ministerio", periodo: "mensual" },
  pri_01m7b85rw9fear6kcqbhv526px: { plan: "ministerio", periodo: "anual" },
  pri_01m7b828dt7zexxkyg8getyr7e: { plan: "crecimiento", periodo: "mensual" },
  pri_01m7b838djdpz4xdjpk1kmjtty: { plan: "crecimiento", periodo: "anual" },
  pri_01m7b7q5bw2gv796ykfaqj8k9t: { plan: "iglesia", periodo: "mensual" },
  pri_01m7b7rr1caa03yk2fdtpb66nj: { plan: "iglesia", periodo: "anual" },
};
const PLANES_VALIDOS = new Set(["ministerio", "crecimiento", "iglesia"]);

export function precios(extra?: string | null): Record<string, { plan: string; periodo: string }> {
  try {
    return { ...PRECIOS_PRUEBA, ...JSON.parse(extra || "{}") };
  } catch {
    return PRECIOS_PRUEBA;
  }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Paddle-Signature: "ts=1671552777;h1=eb4d0dc8..." — HMAC-SHA256 de "<ts>:<cuerpo>" con el secreto.
export async function firmaValida(cabecera: string | null, cuerpo: string, secreto: string, ahora = Date.now() / 1000) {
  if (!cabecera || !secreto) return false;
  const partes = Object.fromEntries(cabecera.split(";").map((p) => p.split("=") as [string, string]));
  const ts = Number(partes.ts);
  const h1s = cabecera.split(";").filter((p) => p.startsWith("h1=")).map((p) => p.slice(3));
  if (!ts || !h1s.length || Math.abs(ahora - ts) > TOLERANCIA_SEG) return false;
  const llave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const esperado = hex(await crypto.subtle.sign("HMAC", llave, new TextEncoder().encode(`${ts}:${cuerpo}`)));
  return h1s.some((h) => igualSeguro(h, esperado));
}

const masDias = (iso: string, dias: number) => new Date(new Date(iso).getTime() + dias * 86400000).toISOString();

// Qué cambia en la iglesia según el estado de la suscripción. null = nada que cambiar.
// deno-lint-ignore no-explicit-any
export function cambiosPorSuscripcion(sub: any, mapa = precios()): Record<string, unknown> | null {
  const item = sub?.items?.[0];
  const precioId = item?.price?.id;
  const conocido = precioId ? mapa[precioId] : undefined;
  const plan = conocido?.plan ?? item?.product?.custom_data?.plan ?? item?.price?.custom_data?.plan;
  const intervalo = item?.price?.billing_cycle?.interval;
  const periodo = conocido?.periodo ?? (intervalo === "year" ? "anual" : intervalo === "month" ? "mensual" : null);
  const base: Record<string, unknown> = {
    paddle_suscripcion_id: sub.id,
    cliente_pago_id: sub.customer_id ?? null,
    pago_estado: sub.scheduled_change?.action === "cancel" ? "cancela_al_final" : sub.status,
  };
  switch (sub.status) {
    case "active":
    case "trialing": {
      if (!plan || !PLANES_VALIDOS.has(plan)) return null;
      const fin = sub.current_billing_period?.ends_at;
      return { ...base, plan, plan_periodo: periodo, en_prueba: false, plan_vence: fin ? masDias(fin, GRACIA_DIAS) : null };
    }
    case "past_due":
      // Sigue con su plan hasta el fin del periodo pagado + gracia (ya guardado); solo se marca el estado.
      return base;
    case "canceled":
      return { ...base, plan_vence: sub.canceled_at ?? new Date().toISOString() };
    case "paused":
      return { ...base, plan_vence: sub.paused_at ?? new Date().toISOString() };
    default:
      return base;
  }
}

