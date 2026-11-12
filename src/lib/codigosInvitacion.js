// Códigos de invitación para iglesias nuevas (consola general, ver PlataformaAdmin.jsx).

// "disponible" (se puede usar), "usado" (ya creó su iglesia) o "vencido" (pasaron 30 días sin usarse).
export function estadoCodigo(c, ahora = Date.now()) {
  if (c.usado_at) return "usado";
  if (c.vence_at && new Date(c.vence_at).getTime() < ahora) return "vencido";
  return "disponible";
}

const sinTildes = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// ¿El código coincide con lo que se busca? (código, nota, iglesia que lo usó o correo de su administrador)
export function codigoCoincide(c, q, { nombreIglesia = () => "", correosAdmin = () => [] } = {}) {
  const t = sinTildes(q).trim();
  if (!t) return true;
  return [c.codigo, c.nota, nombreIglesia(c.iglesia_id), ...correosAdmin(c.iglesia_id)].some((x) => sinTildes(x).includes(t));
}
