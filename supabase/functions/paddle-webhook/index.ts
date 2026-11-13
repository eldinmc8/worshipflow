import { createClient } from "jsr:@supabase/supabase-js@2";

// Avisos de Paddle (pedido de Eldin, 2026-11-13). Paddle llama aquí cada vez que una suscripción se crea,
// se renueva, se cancela o deja de pagarse, y esta función actualiza el plan de la iglesia.
//
// - No pide sesión (verify_jwt = false): la seguridad es la firma Paddle-Signature, hecha con el secreto
//   del destino de notificaciones (PADDLE_WEBHOOK_SECRET). Sin firma válida no se toca nada.
// - La iglesia viaja en custom_data.iglesia_id (lo pone la página de pago). Si no viene, se busca por el
//   id de la suscripción ya guardado.
// - Plan pagado: plan_vence = fin del periodo pagado + 3 días de gracia. Si deja de pagar o cancela, la
//   fecha ya no se mueve y al pasar la iglesia cuenta como Gratis (wf_plan_efectivo). Nada se borra.

import { firmaValida, cambiosPorSuscripcion, precios } from "./logica.ts";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const cuerpo = await req.text();
  const secreto = Deno.env.get("PADDLE_WEBHOOK_SECRET") ?? "";
  if (!(await firmaValida(req.headers.get("Paddle-Signature"), cuerpo, secreto))) {
    return json({ error: "Firma no válida" }, 401);
  }

  // deno-lint-ignore no-explicit-any
  let evento: any;
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return json({ error: "Cuerpo no válido" }, 400);
  }
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const tipo: string = evento.event_type ?? "";
  const sub = evento.data ?? {};

  // Solo nos importan las suscripciones; el resto se registra y se responde 200 para que Paddle no reintente.
  let iglesiaId: string | null = null;
  if (tipo.startsWith("subscription.")) {
    const delPago = String(sub.custom_data?.iglesia_id ?? "");
    iglesiaId = /^[0-9a-f-]{36}$/i.test(delPago) ? delPago : null;
    if (!iglesiaId && sub.id) {
      const { data } = await admin.from("iglesias").select("id").eq("paddle_suscripcion_id", sub.id).maybeSingle();
      iglesiaId = data?.id ?? null;
    }
  }

  // Registro (y freno a duplicados: si el event_id ya estaba, no se vuelve a aplicar).
  const { error: errReg } = await admin.from("pagos_eventos").insert({
    id: evento.event_id, tipo, iglesia_id: iglesiaId, ocurrido: evento.occurred_at ?? null, datos: evento,
  });
  if (errReg) {
    if (errReg.code === "23505") return json({ ok: true, repetido: true });
    // Si la iglesia no existe (FK), igual registramos sin iglesia.
    if (errReg.code === "23503") {
      await admin.from("pagos_eventos").insert({ id: evento.event_id, tipo, iglesia_id: null, ocurrido: evento.occurred_at ?? null, datos: evento });
      return json({ ok: true, sin_iglesia: true });
    }
    return json({ error: errReg.message }, 500);
  }

  if (!tipo.startsWith("subscription.") || !iglesiaId) return json({ ok: true, ignorado: true });

  // Mientras estemos en el modo de prueba de Paddle (tarjetas de prueba, sin dinero real), solo se aplican
  // cambios a iglesias donde hay un super admin (la tuya), para que nadie suba de plan con una tarjeta de
  // prueba. Al pasar a cobros reales se pone el secreto PADDLE_MODO = real.
  if ((Deno.env.get("PADDLE_MODO") ?? "prueba") !== "real") {
    const { data: supers } = await admin.from("super_admins").select("usuario_id");
    const ids = (supers ?? []).map((s: { usuario_id: string }) => s.usuario_id);
    const { count } = ids.length
      ? await admin.from("usuarios").select("id", { count: "exact", head: true }).eq("iglesia_id", iglesiaId).in("id", ids)
      : { count: 0 };
    if (!count) return json({ ok: true, ignorado: "modo de prueba: iglesia sin super admin" });
  }

  const cambios = cambiosPorSuscripcion(sub, precios(Deno.env.get("PADDLE_PRECIOS")));
  if (!cambios) return json({ ok: true, sin_cambios: true });

  // No aplicar un aviso más viejo que el último que ya se aplicó (Paddle puede reintentar fuera de orden).
  const cuando = evento.occurred_at ?? new Date().toISOString();
  const { error } = await admin.from("iglesias")
    .update({ ...cambios, pago_evento_en: cuando })
    .eq("id", iglesiaId)
    .or(`pago_evento_en.is.null,pago_evento_en.lte."${cuando}"`);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
