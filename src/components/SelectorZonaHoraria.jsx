import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { opcionesZonas, etiquetaZona } from "../lib/zonasHorarias.js";

// Selector de zona horaria con buscador (2026-11-09): todos los países y zonas del mundo, los de habla
// hispana primero. Ver lib/zonasHorarias.js. Mismo aspecto que los demás campos de los formularios.
export default function SelectorZonaHoraria({ value, onChange, estiloCampo = {} }) {
  const [busqueda, setBusqueda] = useState("");
  const { paises, otras } = useMemo(() => opcionesZonas({ busqueda, actual: value }), [busqueda, value]);
  const estaVisible = paises.some((o) => o.value === value) || otras.some((o) => o.value === value);
  const sinResultados = !paises.length && !otras.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, ...estiloCampo, padding: "8px 10px" }}>
        <Search size={14} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
        <input
          value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar país o ciudad (ej. Venezuela)"
          aria-label="Buscar zona horaria"
          style={{ border: "none", outline: "none", background: "transparent", color: "var(--wf-text)", fontSize: 13, width: "100%", padding: 0 }}
        />
      </div>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} aria-label="Zona horaria" style={estiloCampo}>
        {/* La actual siempre está, aunque la búsqueda la deje fuera (si no, el select mostraría otra). */}
        {value && !estaVisible && <option value={value}>{etiquetaZona(value)} — actual</option>}
        {paises.length > 0 && (
          <optgroup label="Países">
            {paises.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        )}
        {otras.length > 0 && (
          <optgroup label="Todas las zonas del mundo">
            {otras.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        )}
        {sinResultados && !value && <option value="" disabled>No hay zonas con ese nombre</option>}
      </select>
      {sinResultados && <div style={{ fontSize: 11, color: "var(--wf-faint)" }}>No hay zonas con «{busqueda}». Prueba con el nombre del país o con la hora (ej. UTC-4).</div>}
    </div>
  );
}
