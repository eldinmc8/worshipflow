// Utilidades de fecha compartidas entre el prototipo principal y las pantallas de administración
// (ej. el horario de un usuario en Usuarios). Todo se calcula desde fechas reales "YYYY-MM-DD" —
// nunca desde texto libre — y siempre en horario LOCAL: `new Date("YYYY-MM-DD")` la interpreta como
// medianoche UTC, lo que en husos horarios negativos (Guatemala, UTC-6) puede mostrar el día anterior.
export function parseIsoDateLocal(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
export function todayLocal() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}
export function isUpcoming(ev) {
  const d = parseIsoDateLocal(ev.date);
  if (!d) return true; // sin fecha asignada todavía: se muestra en "Próximos" para que no se pierda de vista
  return d >= todayLocal();
}
export function compareByDay(a, b) {
  const da = parseIsoDateLocal(a.date);
  const db = parseIsoDateLocal(b.date);
  if (!da && !db) return 0;
  if (!da) return 1; // sin fecha: al final
  if (!db) return -1;
  return da - db;
}
export const MONTH_NAMES_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const MONTH_ABBR = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
export const DOW_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const monthKey = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}`; // month: 0-indexado
export const monthLabelFromKey = (key) => { const [y, m] = key.split("-").map(Number); return `${MONTH_NAMES_FULL[m - 1]} ${y}`; };
export function formatFullDate(iso) {
  const d = parseIsoDateLocal(iso);
  if (!d) return null;
  return `${d.getDate()} de ${MONTH_NAMES_FULL[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
}
// Cuadrícula de semanas de un mes cualquiera: domingo primero, celdas vacías (null) antes del día 1
// y después del último día del mes.
export function buildMonthWeeks(year, month) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let week = new Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week); }
  return weeks;
}
