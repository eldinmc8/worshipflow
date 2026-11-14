import { createClient } from "jsr:@supabase/supabase-js@2";
import { PRECIOS_PRUEBA, precios } from "../paddle-webhook/logica.ts";

// Suscripción de Paddle desde la app (pedido de Eldin, 2026-11-13), para que una iglesia que ya paga con
// tarjeta no tenga que escribir por WhatsApp:
// - accion "previsualizar" { plan, periodo } → cuánto se cobra (o queda a favor) hoy al cambiar de plan.
// - accion "cambiar"       { plan, periodo } → cambia la suscripción con prorrateo inmediato. El plan lo
//   actualiza el aviso de Paddle (paddle-webhook), igual que con un pago nuevo.
// - accion "portal"                         → enlace al portal de Paddle (tarjeta, recibos, cancelar).
// Solo un administrador de la iglesia, y solo si la iglesia tiene una suscripción viva.
// Secretos: PADDLE_API_KEY (pdl_sdbx_... = modo de prueba, pdl_live_... = real) y opcional PADDLE_PRECIOS.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// Precio de Paddle para un plan y periodo (los de prueba más los reales que vengan en PADDLE_PRECIOS).
function precioDe(plan: string, periodo: string): string | null {
  const mapa = precios(Deno.env.get("PADDLE_PRECIOS"));
  const real = (Deno.env.get("PADDLE_API_KEY") ?? "").startsWith("pdl_live_");
  const candidatos = Object.entries(mapa).filter(([id, p]) => p.plan === plan && p.periodo === periodo && (real ? !(id in PRECIOS_PRUEBA) : id in PRECIOS_PRUEBA));
  return candidatos[0]?.[0] ?? null;
}

async function paddle(metodo: string, ruta: string, cuerpo?: unknown) {
  const llave = Deno.env.get("PADDLE_API_KEY") ?? "";
  const base = llave.startsWith("pdl_live_") ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
  const res = await fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos?.error?.detail || `Paddle respondió ${res.status}`);
  return datos.data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  if (!Deno.env.get("PADDLE_API_KEY")) return json({ error: "Los pagos con tarjeta todavía no están configurados." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user } } = await usuario.auth.getUser();
  if (!user) return json({ error: "Inicia sesión de nuevo." }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: yo } = await admin.from("usuarios").select("rol, iglesia_id").eq("id", user.id).maybeSingle();
  if (!yo?.iglesia_id || yo.rol !== "admin") return json({ error: "Solo un administrador de la iglesia puede manejar el plan." }, 403);
  const { data: ig } = await admin.from("iglesias")
    .select("paddle_suscripcion_id, cliente_pago_id, pago_estado, plan_vence").eq("id", yo.iglesia_id).maybeSingle();
  const viva = ig?.paddle_suscripcion_id && ["active", "trialing", "past_due", "cancela_al_final"].includes(ig.pago_estado ?? "")
    && (!ig.plan_vence || new Date(ig.plan_vence) >= new Date());
  if (!viva) return json({ error: "Tu iglesia no tiene una suscripción con tarjeta activa." }, 409);

  let cuerpo: { accion?: string; plan?: string; periodo?: string } = {};
  try { cuerpo = await req.json(); } catch { /* vacío */ }

  try {
    if (cuerpo.accion === "portal") {
      if (!ig.cliente_pago_id) return json({ error: "No encontramos el cliente de Paddle de tu iglesia." }, 409);
      const s = await paddle("POST", `/customers/${ig.cliente_pago_id}/portal-sessions`, { subscription_ids: [ig.paddle_suscripcion_id] });
      return json({ url: s?.urls?.general?.overview });
    }

    const precio = precioDe(cuerpo.plan ?? "", cuerpo.periodo ?? "");
    if (!precio) return json({ error: "Plan o periodo no válido." }, 400);
    const cambio = { items: [{ price_id: precio, quantity: 1 }], proration_billing_mode: "prorated_immediately" };

    if (cuerpo.accion === "previsualizar") {
      const p = await paddle("PATCH", `/subscriptions/${ig.paddle_suscripcion_id}/preview`, cambio);
      const r = p?.update_summary?.result;
      return json({ accion: r?.action ?? null, monto: r?.amount ? Number(r.amount) / 100 : 0, moneda: r?.currency_code ?? p?.currency_code ?? "USD" });
    }
    if (cuerpo.accion === "cambiar") {
      // Si estaba programada para cancelarse al final, cambiar de plan también la deja activa de nuevo.
      await paddle("PATCH", `/subscriptions/${ig.paddle_suscripcion_id}`, { ...cambio, scheduled_change: null });
      return json({ ok: true });
    }
    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "No se pudo completar con Paddle." }, 502);
  }
});
