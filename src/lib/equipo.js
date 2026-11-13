// Identificación de ESTE equipo (navegador): una por computadora o celular, guardada en el dispositivo.
// Sirve para saber qué equipo lleva la transmisión en vivo (pedido de Eldin, 2026-11-13): antes se sabía
// solo por la PERSONA (liderado_por), así que el celular del mismo administrador que transmitía desde la
// computadora creía que también la llevaba — no le salía el control remoto y podía mandar su propia
// diapositiva a la proyección. Ahora el equipo que transmite viaja en sesiones_en_vivo.slide_actual.equipo.
const CLAVE = "worshipflow_equipo";
let enMemoria = null;

export function idEquipo() {
  if (enMemoria) return enMemoria;
  try {
    enMemoria = localStorage.getItem(CLAVE);
    if (!enMemoria) {
      enMemoria = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(CLAVE, enMemoria);
    }
  } catch {
    enMemoria = enMemoria || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return enMemoria;
}

// ¿Este equipo lleva la transmisión? La persona tiene que ser quien la inició y, si la sesión ya dice
// qué equipo transmite, tiene que ser este. Sesiones de antes de este cambio (sin equipo): la llevan las
// computadoras de esa persona, nunca un celular (desde un celular no se puede iniciar el en vivo).
export function esteEquipoLleva({ userId, liveOwnerId, equipoEnVivo, isCompact, miEquipo = idEquipo() }) {
  if (!userId || userId !== liveOwnerId) return false;
  return equipoEnVivo ? equipoEnVivo === miEquipo : !isCompact;
}
