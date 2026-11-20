import { useMemo, useState } from "react";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import AsistentePasos, { EncabezadoPaso, Pildora, botonPie } from "./AsistentePasos.jsx";
import { Field, inputStyle } from "../pantallas/compartido.jsx";
import { todayLocal } from "../lib/dates.js";
import {
  DIAS_SEMANA, DIAS_CORTOS, FRECUENCIAS, SEMANAS_MES, isoLocal, hastaMaximo, sumarMeses, finDeMes,
  problemaDelRango, generarFechas, fechaLarga, tituloParaFecha, fechasRepetidas, resumenRango,
} from "../lib/publicarVarias.js";

// "Publicar en varias fechas": toma una plantilla y crea un evento por cada fecha elegida (máximo un
// año). Pasos: 1) qué días, 2) desde/hasta, 3) revisar y publicar. Lógica en src/lib/publicarVarias.js.
const PASOS = [{ clave: "dias", nombre: "Días" }, { clave: "fechas", nombre: "Fechas" }, { clave: "revisar", nombre: "Revisar" }];
const campo = { ...inputStyle, fontSize: 16, minHeight: 44 };

export default function PublicarVariasFechas({ plantilla, eventos, onPublicar, onCerrar, onVerEventos }) {
  const hoy = isoLocal(todayLocal());
  const [paso, setPaso] = useState(0);
  const [dias, setDias] = useState([]);
  const [frecuencia, setFrecuencia] = useState("semanal");
  const [semanaDelMes, setSemanaDelMes] = useState(1);
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(finDeMes(hoy));
  const [atajo, setAtajo] = useState("mes");
  const [nombre, setNombre] = useState(plantilla.title || "");
  const [modoNombre, setModoNombre] = useState("fecha"); // "fecha" (Viernes 20 de noviembre · 7:00 pm) | "plantilla"
  const [hora, setHora] = useState(plantilla.hora ? String(plantilla.hora).slice(0, 5) : "");
  const [lugar, setLugar] = useState(plantilla.location && plantilla.location !== "Por definir" ? plantilla.location : "");
  const [quitadas, setQuitadas] = useState(null); // Set de fechas que NO se publican (null = aún sin calcular)
  const [publicando, setPublicando] = useState(null); // { hechos, total }
  const [listo, setListo] = useState(null); // { creados, fallidos, fechas }

  const problema = problemaDelRango(desde, hasta);
  const fechas = useMemo(() => generarFechas({ desde, hasta, dias, frecuencia, semanaDelMes }), [desde, hasta, dias, frecuencia, semanaDelMes]);
  const tituloDe = (f) => tituloParaFecha(nombre, f, modoNombre, hora);
  const repetidas = useMemo(() => fechasRepetidas(eventos, nombre, fechas, (f) => tituloParaFecha(nombre, f, "fecha", hora)), [eventos, nombre, fechas, hora]);
  const fuera = quitadas || repetidas; // al llegar a Revisar, las repetidas vienen quitadas
  const elegidas = fechas.filter((f) => !fuera.has(f));

  const ponerAtajo = (clave) => {
    setAtajo(clave);
    if (clave === "mes") setHasta(finDeMes(desde));
    if (clave === "3m") setHasta(sumarMeses(desde, 3));
    if (clave === "6m") setHasta(sumarMeses(desde, 6));
    if (clave === "año") setHasta(hastaMaximo(desde));
  };
  const cambiarDesde = (v) => {
    setDesde(v);
    if (!v) return;
    if (atajo === "mes") setHasta(finDeMes(v));
    else if (atajo === "3m") setHasta(sumarMeses(v, 3));
    else if (atajo === "6m") setHasta(sumarMeses(v, 6));
    else if (atajo === "año") setHasta(hastaMaximo(v));
  };
  const alternarDia = (d) => setDias((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));
  const alternarFecha = (f) => setQuitadas(() => {
    const s = new Set(fuera);
    if (s.has(f)) s.delete(f); else s.add(f);
    return s;
  });
  const irAPaso = (i) => {
    if (i === 2 && paso < 2) setQuitadas(null); // recalcula repetidas con lo que se eligió
    setPaso(i);
  };

  const publicar = async () => {
    const lista = elegidas.map((date) => ({ date, title: tituloDe(date) }));
    setPublicando({ hechos: 0, total: lista.length });
    const r = await onPublicar({ fechas: lista, hora: hora || null, dateLabel: "", location: lugar.trim() || "Por definir" },
      (hechos) => setPublicando({ hechos, total: lista.length }));
    setPublicando(null);
    setListo({ ...r, fechas: lista.map((x) => x.date) });
  };

  const puedeSeguir = paso === 0 ? dias.length > 0 : paso === 1 ? !problema && fechas.length > 0 : (modoNombre === "fecha" || nombre.trim()) && elegidas.length > 0;
  const falta = paso === 0 ? "Elige al menos un día" : paso === 1 ? (problema || "No hay fechas en ese rango") : (modoNombre !== "fecha" && !nombre.trim() ? "Falta el nombre" : "Elige al menos una fecha");

  if (listo) {
    return (
      <AsistentePasos titulo="Publicar en varias fechas" pasos={PASOS} paso={2} onPaso={() => {}} onCerrar={onCerrar} onFinal={onCerrar} textoFinal="Cerrar">
        <div style={{ textAlign: "center", padding: "30px 8px" }}>
          <CheckCircle2 size={54} color="#1F8A73" />
          <h2 style={{ fontFamily: "var(--wf-font-titulo)", fontSize: 21, margin: "12px 0 6px" }}>¡Listo! Se publicaron {listo.creados} servicios</h2>
          <p style={{ fontSize: 14, color: "var(--wf-muted)", margin: "0 0 18px" }}>“{plantilla.title}”, {resumenRango(listo.fechas)}. Ya aparecen en Eventos, cada uno con su fecha.</p>
          {listo.fallidos > 0 && <p style={{ fontSize: 14, color: "#C23B32", fontWeight: 700 }}>{listo.fallidos} no se pudieron guardar. Revisa tu conexión e inténtalo con esas fechas.</p>}
          {onVerEventos && <button type="button" onClick={onVerEventos} style={{ ...botonPie, margin: "0 auto", border: "none", background: "var(--wf-hover)", color: "var(--wf-text)" }}>Ver eventos</button>}
        </div>
      </AsistentePasos>
    );
  }

  return (
    <AsistentePasos titulo="Publicar en varias fechas" pasos={PASOS} paso={paso} onPaso={irAPaso} onCerrar={onCerrar}
      puedeSeguir={!!puedeSeguir} falta={falta} onFinal={publicar} ocupado={!!publicando}
      textoFinal={publicando ? `Publicando ${publicando.hechos} de ${publicando.total}…` : `Publicar ${elegidas.length} ${elegidas.length === 1 ? "servicio" : "servicios"}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 16, padding: "10px 12px", marginBottom: 16 }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: "color-mix(in srgb, #5661B3 15%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><CalendarCheck size={18} color="#5661B3" /></span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>Plantilla</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plantilla.title}</div>
        </div>
      </div>

      {paso === 0 && (
        <>
          <EncabezadoPaso titulo="¿Qué días se hace este servicio?" ayuda="Toca uno o varios días de la semana." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8, marginBottom: 22 }}>
            {DIAS_SEMANA.map((d, i) => <Pildora key={d} activo={dias.includes(i)} onClick={() => alternarDia(i)}>{d}</Pildora>)}
          </div>
          <Field label="¿Cada cuánto?">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {FRECUENCIAS.map(([v, l]) => <Pildora key={v} activo={frecuencia === v} onClick={() => setFrecuencia(v)}>{l}</Pildora>)}
            </div>
          </Field>
          {frecuencia === "mensual" && (
            <div style={{ marginTop: 14 }}>
              <Field label="¿Qué semana del mes?">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {SEMANAS_MES.map(([n, l]) => <Pildora key={n} activo={semanaDelMes === n} onClick={() => setSemanaDelMes(n)}>{l}{dias.length === 1 ? ` ${DIAS_SEMANA[dias[0]].toLowerCase()}` : ""}</Pildora>)}
                </div>
              </Field>
            </div>
          )}
        </>
      )}

      {paso === 1 && (
        <>
          <EncabezadoPaso titulo="¿Desde cuándo y hasta cuándo?" ayuda="Puedes publicar hasta un año completo de una vez." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {[["mes", "Este mes"], ["3m", "3 meses"], ["6m", "6 meses"], ["año", "Todo el año"]].map(([v, l]) => <Pildora key={v} activo={atajo === v} onClick={() => ponerAtajo(v)}>{l}</Pildora>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <Field label="Desde" required><input type="date" value={desde} onChange={(e) => cambiarDesde(e.target.value)} style={campo} /></Field>
            <Field label="Hasta" required><input type="date" value={hasta} min={desde} max={hastaMaximo(desde) || undefined} onChange={(e) => { setHasta(e.target.value); setAtajo(null); }} style={campo} /></Field>
          </div>
          <div style={{ marginTop: 18, borderRadius: 16, padding: "14px 16px", background: problema ? "color-mix(in srgb, #C23B32 10%, transparent)" : "color-mix(in srgb, var(--wf-brand-accent) 10%, transparent)" }}>
            {problema ? (
              <span style={{ fontSize: 14, fontWeight: 700, color: "#C23B32" }}>{problema}</span>
            ) : (
              <>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{fechas.length} {fechas.length === 1 ? "servicio" : "servicios"}</div>
                <div style={{ fontSize: 13, color: "var(--wf-muted)" }}>{fechas.length ? `${dias.map((d) => DIAS_CORTOS[d]).join(", ")}, ${resumenRango(fechas)}` : "Ningún día elegido cae en ese rango."}</div>
              </>
            )}
          </div>
        </>
      )}

      {paso === 2 && (
        <>
          <EncabezadoPaso titulo="Revisa y publica" ayuda="Así se van a llamar. Quita las fechas que no van, por ejemplo un feriado." />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
            <Field label="Hora del servicio"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} /></Field>
            <Field label="Nombre de cada servicio">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Pildora activo={modoNombre === "fecha"} onClick={() => setModoNombre("fecha")}>Fecha y hora</Pildora>
                <Pildora activo={modoNombre === "plantilla"} onClick={() => setModoNombre("plantilla")}>Nombre + fecha</Pildora>
              </div>
              <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)", marginTop: 6 }}>Ej. “{tituloDe(elegidas[0] || fechas[0])}”</span>
            </Field>
            {modoNombre === "plantilla" && <Field label="Nombre" required><input value={nombre} onChange={(e) => setNombre(e.target.value)} style={campo} /></Field>}
            <Field label="Lugar (opcional)"><input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Ej. Templo principal" style={campo} /></Field>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{elegidas.length} de {fechas.length} fechas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {fechas.map((f) => {
              const on = !fuera.has(f);
              return (
                <label key={f} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "10px 12px", cursor: "pointer", opacity: on ? 1 : 0.55 }}>
                  <input type="checkbox" checked={on} onChange={() => alternarFecha(f)} style={{ width: 20, height: 20, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{fechaLarga(f)}</span>
                    <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tituloDe(f)}</span>
                  </span>
                  {repetidas.has(f) && <span style={{ fontSize: 11, fontWeight: 800, color: "#C23B32", background: "color-mix(in srgb, #C23B32 12%, transparent)", borderRadius: 10, padding: "3px 8px", flexShrink: 0 }}>Ya existe</span>}
                </label>
              );
            })}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--wf-muted)", marginTop: 14 }}>Cada servicio lleva el orden del culto, los encargados y los recordatorios de la plantilla. Los encargados quedan “pendientes” de confirmar y reciben un solo aviso con todas sus fechas.</p>
        </>
      )}
    </AsistentePasos>
  );
}
