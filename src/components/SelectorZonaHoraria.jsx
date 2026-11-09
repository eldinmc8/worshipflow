import { useMemo, useState } from "react";
import { Search, Check, X } from "lucide-react";
import { opcionesZonas, etiquetaZona } from "../lib/zonasHorarias.js";

// Selector de zona horaria con buscador (2026-11-09): todos los países y zonas del mundo, los de habla
// hispana primero. Ver lib/zonasHorarias.js.
// Arreglo (2026-11-09, "el buscador de país no funciona"): antes los resultados quedaban escondidos
// dentro de un desplegable (<select>): al escribir no cambiaba nada a la vista. Ahora la zona elegida se
// ve arriba y los resultados salen como una lista visible debajo del buscador, que se elige con un toque.
export default function SelectorZonaHoraria({ value, onChange, estiloCampo = {} }) {
  const [busqueda, setBusqueda] = useState("");
  const { paises, otras } = useMemo(() => opcionesZonas({ busqueda }), [busqueda]);
  const buscando = busqueda.trim().length > 0;
  // Sin búsqueda: los países (la lista corta). Buscando: todo lo que coincida, países primero.
  const resultados = buscando ? [...paises, ...otras] : paises;
  const elegir = (z) => { onChange(z); setBusqueda(""); };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {value && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--wf-text)" }}>
          <Check size={14} color="#1F8A73" style={{ flexShrink: 0 }} /> <span>{etiquetaZona(value)}</span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, ...estiloCampo, padding: "8px 10px" }}>
        <Search size={14} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
        <input
          type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar país o ciudad (ej. Venezuela)"
          aria-label="Buscar zona horaria" autoComplete="off"
          // Dentro de un formulario, Enter lo enviaría: aquí elige el primer resultado.
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (buscando && resultados[0]) elegir(resultados[0].value); } }}
          style={{ border: "none", outline: "none", background: "transparent", color: "var(--wf-text)", fontSize: 14, width: "100%", padding: 0, minWidth: 0 }}
        />
        {buscando && (
          <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" style={{ display: "flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--wf-faint)" }}><X size={14} /></button>
        )}
      </div>
      <div role="listbox" aria-label="Zonas horarias" style={{ maxHeight: 220, overflowY: "auto", borderRadius: 10, background: "var(--wf-hover)", padding: 4 }}>
        {resultados.map((o) => {
          const activa = o.value === value;
          return (
            <button
              key={o.value} type="button" role="option" aria-selected={activa} onClick={() => elegir(o.value)}
              style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", border: "none", borderRadius: 8, padding: "8px 10px", fontSize: 13, cursor: "pointer", color: activa ? "#fff" : "var(--wf-text)", background: activa ? "#E8821E" : "transparent", fontWeight: activa ? 700 : 500 }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{o.label}</span>
              {activa && <Check size={14} style={{ flexShrink: 0 }} />}
            </button>
          );
        })}
        {!resultados.length && (
          <div style={{ fontSize: 12, color: "var(--wf-faint)", padding: "10px" }}>No hay zonas con «{busqueda}». Prueba con el nombre del país o con la hora (ej. UTC-4).</div>
        )}
        {!buscando && (
          <div style={{ fontSize: 11, color: "var(--wf-faint)", padding: "8px 10px 4px" }}>¿No está tu país? Búscalo arriba: están todas las zonas del mundo.</div>
        )}
      </div>
    </div>
  );
}
