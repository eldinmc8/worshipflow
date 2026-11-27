// Varios grupos en un evento (pedido de Eldin, 2026-11-26). Un evento tiene un dueño (ministryId:
// un grupo, o null = General de toda la iglesia) y, además, otros grupos que participan
// (ministeriosInvitados → eventos.ministerios_invitados). El evento sale en el filtro y en la pantalla
// de cada grupo invitado y sus líderes lo ven, pero solo el dueño (y quien organiza eventos) lo edita.
import { ordenarPor } from "./orden.js";

// Lista limpia de invitados: sin repetidos, sin vacíos y sin el grupo dueño.
export function limpiarInvitados(ids, duenoId = null) {
  return [...new Set((ids || []).filter(Boolean))].filter((id) => id !== duenoId);
}

// Ids de todos los grupos del evento: el dueño (si tiene) y los invitados.
export function gruposDelEvento(ev) {
  if (!ev) return [];
  return [...new Set([ev.ministryId, ...(ev.ministeriosInvitados || [])].filter(Boolean))];
}

// ¿Este evento es de ese grupo (como dueño o como invitado)?
export function eventoEsDelGrupo(ev, grupoId) {
  return !!grupoId && gruposDelEvento(ev).includes(grupoId);
}

// ¿Esta persona lidera algún grupo invitado al evento? (para que lo vea)
export function lideraGrupoInvitado(ev, gruposQueLidero) {
  return !!gruposQueLidero && (ev?.ministeriosInvitados || []).some((id) => gruposQueLidero.has(id));
}

// Grupos invitados que todavía existen, en orden alfabético (un grupo borrado simplemente no sale).
export function invitadosDelEvento(ev, ministerios) {
  const ids = limpiarInvitados(ev?.ministeriosInvitados, ev?.ministryId);
  return ordenarPor((ministerios || []).filter((m) => ids.includes(m.id)), (m) => m.name);
}

// Texto corto: "General · Alabanza, Jóvenes" o "Jóvenes · Damas". Vacío si no hay invitados.
export function resumenGrupos(ev, ministerios) {
  const invitados = invitadosDelEvento(ev, ministerios);
  if (!invitados.length) return "";
  const dueno = ev?.ministryId ? (ministerios || []).find((m) => m.id === ev.ministryId) : null;
  return `${dueno ? dueno.name : "General"} · ${invitados.map((m) => m.name).join(", ")}`;
}
