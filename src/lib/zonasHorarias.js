// Zonas horarias (pedido de Eldin, 2026-11-09: "no hay para todos los países, como Venezuela").
// Antes había 6 opciones fijas. Ahora: los países de habla hispana (y donde más iglesias hispanas hay)
// primero y con su nombre en español, y debajo TODAS las zonas del mundo, con buscador. La base acepta
// cualquier zona válida (ver la migración 20261114000000_zona_horaria_cualquiera.sql).

// País → zona (nombres oficiales IANA). Etc/GMT+6 es la que ya usaban muchas iglesias (UTC-6 fijo).
export const ZONAS_PAISES = [
  { value: "Etc/GMT+6", label: "Guatemala / El Salvador / Honduras (UTC-6)" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/El_Salvador", label: "El Salvador" },
  { value: "America/Tegucigalpa", label: "Honduras" },
  { value: "America/Managua", label: "Nicaragua" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Belize", label: "Belice" },
  { value: "America/Mexico_City", label: "México — Centro (CDMX, Guadalajara, Monterrey)" },
  { value: "America/Cancun", label: "México — Quintana Roo (Cancún)" },
  { value: "America/Mazatlan", label: "México — Pacífico (Sinaloa, Nayarit, BCS)" },
  { value: "America/Hermosillo", label: "México — Sonora" },
  { value: "America/Tijuana", label: "México — Baja California (Tijuana)" },
  { value: "America/Ciudad_Juarez", label: "México — Ciudad Juárez" },
  { value: "America/Havana", label: "Cuba" },
  { value: "America/Santo_Domingo", label: "República Dominicana" },
  { value: "America/Puerto_Rico", label: "Puerto Rico" },
  { value: "America/Port-au-Prince", label: "Haití" },
  { value: "America/Jamaica", label: "Jamaica" },
  { value: "America/Bogota", label: "Colombia" },
  { value: "America/Caracas", label: "Venezuela" },
  { value: "America/Guayaquil", label: "Ecuador" },
  { value: "Pacific/Galapagos", label: "Ecuador — Galápagos" },
  { value: "America/Lima", label: "Perú" },
  { value: "America/La_Paz", label: "Bolivia" },
  { value: "America/Santiago", label: "Chile" },
  { value: "America/Punta_Arenas", label: "Chile — Magallanes" },
  { value: "Pacific/Easter", label: "Chile — Isla de Pascua" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina" },
  { value: "America/Asuncion", label: "Paraguay" },
  { value: "America/Montevideo", label: "Uruguay" },
  { value: "America/Sao_Paulo", label: "Brasil — Brasília / São Paulo" },
  { value: "America/Manaus", label: "Brasil — Manaos" },
  { value: "America/Guyana", label: "Guyana" },
  { value: "America/Paramaribo", label: "Surinam" },
  { value: "Europe/Madrid", label: "España" },
  { value: "Atlantic/Canary", label: "España — Canarias" },
  { value: "Africa/Malabo", label: "Guinea Ecuatorial" },
  { value: "America/New_York", label: "Estados Unidos — Este (Nueva York, Miami)" },
  { value: "America/Chicago", label: "Estados Unidos — Centro (Chicago, Houston, Dallas)" },
  { value: "America/Denver", label: "Estados Unidos — Montaña (Denver)" },
  { value: "America/Phoenix", label: "Estados Unidos — Arizona" },
  { value: "America/Los_Angeles", label: "Estados Unidos — Pacífico (Los Ángeles)" },
  { value: "America/Anchorage", label: "Estados Unidos — Alaska" },
  { value: "Pacific/Honolulu", label: "Estados Unidos — Hawái" },
  { value: "America/Toronto", label: "Canadá — Este (Toronto, Montreal)" },
  { value: "America/Winnipeg", label: "Canadá — Centro (Winnipeg)" },
  { value: "America/Edmonton", label: "Canadá — Montaña (Calgary, Edmonton)" },
  { value: "America/Vancouver", label: "Canadá — Pacífico (Vancouver)" },
  { value: "Europe/London", label: "Reino Unido" },
  { value: "Europe/Lisbon", label: "Portugal" },
  { value: "Europe/Paris", label: "Francia" },
  { value: "Europe/Berlin", label: "Alemania" },
  { value: "Europe/Rome", label: "Italia" },
  { value: "Europe/Zurich", label: "Suiza" },
  { value: "Asia/Manila", label: "Filipinas" },
];

const ETIQUETA = new Map(ZONAS_PAISES.map((z) => [z.value, z.label]));

export function esZonaValida(zona) {
  if (!zona || typeof zona !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

// Minutos respecto a UTC en esa fecha (Venezuela → -240). null si la zona no existe.
export function minutosUTC(zona, fecha = new Date()) {
  try {
    const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, timeZoneName: "longOffset" }).formatToParts(fecha);
    const t = partes.find((p) => p.type === "timeZoneName")?.value || "";
    const m = /GMT(?:([+-])(\d{1,2})(?::?(\d{2}))?)?/.exec(t);
    if (!m) return null;
    if (!m[1]) return 0;
    const total = Number(m[2]) * 60 + Number(m[3] || 0);
    return m[1] === "-" ? -total : total;
  } catch {
    return null;
  }
}

// "UTC-4", "UTC+5:30", "UTC" (hoy, con horario de verano si aplica).
export function textoUTC(zona, fecha = new Date()) {
  const min = minutosUTC(zona, fecha);
  if (min == null) return "";
  if (min === 0) return "UTC";
  const abs = Math.abs(min);
  return `UTC${min < 0 ? "-" : "+"}${Math.floor(abs / 60)}${abs % 60 ? `:${String(abs % 60).padStart(2, "0")}` : ""}`;
}

// Nombre para mostrar: el del país si está en la lista; si no, la zona legible ("America/Port_of_Spain"
// → "America / Port of Spain").
export function nombreZona(zona) {
  if (!zona) return "";
  return ETIQUETA.get(zona) || zona.replace(/_/g, " ").replace(/\//g, " / ");
}

// "Venezuela (UTC-4)". La de Guatemala/El Salvador/Honduras ya trae el UTC en el nombre.
export function etiquetaZona(zona, fecha = new Date()) {
  const nombre = nombreZona(zona);
  if (/\(UTC/.test(nombre)) return nombre;
  const utc = textoUTC(zona, fecha);
  return utc ? `${nombre} (${utc})` : nombre;
}

function todasLasZonasIana() {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("timeZone");
  } catch { /* navegador viejo */ }
  return ZONAS_PAISES.map((z) => z.value);
}

const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// { paises, otras } para el selector: los países primero (en el orden de arriba) y el resto del mundo
// ordenado por hora (de UTC-12 a UTC+14). busqueda filtra por nombre, zona o "utc-4". actual: si la
// iglesia tiene una zona que no está en ninguna de las dos listas, se agrega para no perderla.
export function opcionesZonas({ busqueda = "", actual = null, fecha = new Date() } = {}) {
  const enPaises = new Set(ZONAS_PAISES.map((z) => z.value));
  const q = normalizar(busqueda).trim();
  const coincide = (o) => !q || normalizar(`${o.label} ${o.value}`).includes(q);
  const paises = ZONAS_PAISES.map((z) => ({ value: z.value, label: etiquetaZona(z.value, fecha) })).filter(coincide);
  const vistas = new Set();
  const otras = todasLasZonasIana()
    .filter((z) => !enPaises.has(z) && !vistas.has(z) && vistas.add(z))
    .map((z) => ({ value: z, label: etiquetaZona(z, fecha), min: minutosUTC(z, fecha) ?? 0 }))
    .sort((a, b) => a.min - b.min || a.label.localeCompare(b.label))
    .map(({ value, label }) => ({ value, label }))
    .filter(coincide);
  if (actual && !enPaises.has(actual) && !otras.some((o) => o.value === actual) && esZonaValida(actual)) {
    otras.unshift({ value: actual, label: etiquetaZona(actual, fecha) });
  }
  return { paises, otras };
}

// Zona de este dispositivo (para sugerirla al crear una iglesia), o null.
export function zonaDelDispositivo() {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return esZonaValida(z) ? z : null;
  } catch {
    return null;
  }
}
