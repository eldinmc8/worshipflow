// Inicio: lo que le toca a cada quien esta semana, estadísticas y accesos rápidos. Separada de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import { parseIsoDateLocal, isUpcoming, compareByDay, todayLocal, buildMonthWeeks, MONTH_NAMES_FULL, DOW_LABELS } from "../lib/dates.js";
import { useState, useMemo } from "react";
import { Bell, ChevronUp, ChevronDown, ChevronRight, Music, Users, Calendar, X, ChevronLeft, Heart, Radio } from "lucide-react";
import { misProximosServicios, cancionesParaEnsayar, companeros, indicaciones, necesitaAtencion, estaSemana, cuandoEs } from "../lib/inicio.js";
import { acordeEn } from "../lib/preferencias.js";
import { EVENTO_LIBRE, textoEnsayo, quienDirigeAlabanza, iconGhost, ghostToggleBtn, DEFAULT_COVERS, ModalShell } from "./compartido.jsx";

// ---------------- INICIO ----------------
function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function StatCard({ icon: Icon, label, value, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={onClick ? "hoverable" : undefined} style={{ flex: 1, background: "var(--wf-card)", border: "none", borderRadius: 20, boxShadow: "0 4px 14px rgba(22,50,79,0.06)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, minWidth: 0, textAlign: "left", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ width: 34, height: 34, borderRadius: 14, background: "var(--wf-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color="#2F5FA8" />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--wf-text)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 10, color: "var(--wf-faint)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    </Tag>
  );
}

// Agrupa eventos por día del mes REAL que se está viendo (year/month reales, no todo el historial junto
// — dos eventos en el mismo día-del-mes pero meses distintos ya no chocan en la misma celda).
function eventsByDay(events, year, month) {
  const map = {};
  events.forEach((ev) => {
    const d = parseIsoDateLocal(ev.date);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) return;
    (map[d.getDate()] = map[d.getDate()] || []).push(ev);
  });
  // Con dos servicios el mismo día (ej. domingo AM/PM), que el más temprano salga primero en el
  // selector — no en el orden en que hayan llegado de la base de datos.
  Object.values(map).forEach((list) => list.sort((a, b) => (a.hora || "").localeCompare(b.hora || "")));
  return map;
}

function nextUpcomingEvent(events, liveEventId) {
  if (liveEventId) return events.find((e) => e.id === liveEventId);
  return events
    .filter((ev) => isUpcoming(ev))
    .slice()
    .sort(compareByDay)[0];
}

// Tarjeta NO bloqueante (a diferencia del aviso de "cargos sin confirmar") — se puede cerrar y no
// insiste hasta dentro de unos días (ver el efecto que decide mostrar avisoPush, más arriba). Dos
// variantes: con permiso bloqueado por el navegador se explica cómo desbloquearlo en vez de ofrecer
// un botón que ya no serviría de nada (volver a pedir permiso mientras está "denied" no hace nada).
function AvisoActivarPush({ estado, onActivar, onCerrar }) {
  const [activando, setActivando] = useState(false);
  const bloqueado = estado.permiso === "denied";
  const activar = async () => {
    setActivando(true);
    try { await onActivar(); } finally { setActivando(false); }
  };
  return (
    <div className="screen-enter" style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--wf-active-bg)", border: "1px solid var(--wf-brand-accent)", borderRadius: 18, padding: "14px 16px", marginBottom: 16, flexShrink: 0 }}>
      <div style={{ width: 34, height: 34, borderRadius: 14, background: "var(--wf-card)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bell size={16} color="var(--wf-brand-accent)" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--wf-text)" }}>{bloqueado ? "Tus notificaciones están bloqueadas" : "Actívalas y no te pierdas nada"}</div>
        {bloqueado ? (
          <div style={{ fontSize: 12, color: "var(--wf-text-2)", marginTop: 3, lineHeight: 1.5 }}>
            Tu navegador no deja mandarte avisos todavía.
            <br />• <b>Android (Chrome):</b> toca el candado junto a la dirección → Permisos → Notificaciones → Permitir.
            <br />• <b>iPhone con la app instalada:</b> Ajustes del iPhone → WorshipFlow → Notificaciones → Activar.
            <br />• <b>Computadora (Chrome o Edge):</b> clic en el ícono junto a la dirección → Notificaciones → Permitir, y recarga la página.
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--wf-text-2)", marginTop: 3, lineHeight: 1.5 }}>No tienes las notificaciones activadas en este dispositivo. Te avisamos cuando te asignen algo o se acerque un evento.</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {!bloqueado && (
            <button onClick={activar} disabled={activando} style={{ background: "var(--wf-brand-accent)", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, color: "var(--wf-brand-primary)", cursor: "pointer", opacity: activando ? 0.6 : 1 }}>
              {activando ? "Activando…" : "Activar notificaciones"}
            </button>
          )}
          <button onClick={onCerrar} style={{ background: "none", border: "none", fontSize: 12.5, fontWeight: 600, color: "var(--wf-faint)", cursor: "pointer", padding: "8px 4px" }}>
            {bloqueado ? "Entendido" : "Ahora no"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- INICIO ----------------
// Pantalla de inicio personal (pedido de Eldin, 2026-10-09): "lo que me toca a mí" en vez de un
// calendario de la iglesia. Cada sección aparece solo si aplica a esta persona — un músico ve qué
// ensayar, alguien de limpieza ve sus indicaciones, un administrador ve lo que falta. Toda la lógica
// vive en src/lib/inicio.js (con pruebas). Pensada también para adultos mayores: letra más grande,
// textos oscuros, nada que se deslice de lado y botones con palabras, no solo íconos.

function TituloSeccion({ children, derecha }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, margin: "16px 4px 6px" }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--wf-text-2)" }}>{children}</span>
      {derecha}
    </div>
  );
}

function BotonVerMas({ abierto, restantes, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", padding: "8px 12px", border: "none", borderTop: "1px solid var(--wf-divider)", background: "transparent", fontSize: 13, fontWeight: 700, color: "#2F5FA8", cursor: "pointer" }}>
      {abierto ? <>Ver menos <ChevronUp size={15} /></> : <>Ver {restantes} más <ChevronDown size={15} /></>}
    </button>
  );
}

function TarjetaInicio({ children, style }) {
  return <div style={{ background: "var(--wf-card)", borderRadius: 18, boxShadow: "0 3px 14px rgba(22,50,79,0.08)", overflow: "hidden", ...style }}>{children}</div>;
}

function Iniciales({ nombre, fondo = "var(--wf-hover)", color = "var(--wf-text)" }) {
  const ini = (nombre || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return <span style={{ width: 36, height: 36, borderRadius: 18, background: fondo, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{ini}</span>;
}

export function InicioView({ events, library, ministries = [], myUserId, myName, favoritesCount, memberCount, liveEventId, liveLibre, onSelectEvent, onGoLive, onGoToTeam, onOpenSong, isCompact, canSeeCanciones, teamName, avisoPush, onActivarPush, onOcultarPush, puedeVerPendientes }) {
  const liveEvent = liveLibre ? EVENTO_LIBRE : events.find((e) => e.id === liveEventId);
  const [showFavorites, setShowFavorites] = useState(false);
  const [verMes, setVerMes] = useState(false);
  const [verEquipo, setVerEquipo] = useState(false);
  // Listas largas de Inicio: solo 3 a la vista y "Ver más" para desplegar el resto (pedido de Eldin).
  const [verTodaAtencion, setVerTodaAtencion] = useState(false);
  const [verTodasFechas, setVerTodasFechas] = useState(false);
  const [verTodasCanciones, setVerTodasCanciones] = useState(false);
  const favoriteSongs = library.filter((s) => s.favorite);
  const [dayEventsPicker, setDayEventsPicker] = useState(null);
  const today = todayLocal();
  const [viewedMonth, setViewedMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const isViewingCurrentMonth = viewedMonth.year === today.getFullYear() && viewedMonth.month === today.getMonth();
  const changeMonth = (delta) => setViewedMonth(({ year, month }) => {
    const d = new Date(year, month + delta, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const weeks = useMemo(() => buildMonthWeeks(viewedMonth.year, viewedMonth.month), [viewedMonth]);
  const byDay = useMemo(() => eventsByDay(events, viewedMonth.year, viewedMonth.month), [events, viewedMonth]);
  const eventsThisMonth = Object.values(byDay).reduce((acc, list) => acc + list.length, 0);
  const nextEvent = useMemo(() => nextUpcomingEvent(events, liveEventId), [events, liveEventId]);
  const nextDate = nextEvent ? parseIsoDateLocal(nextEvent.date) : null;

  const misServicios = useMemo(() => misProximosServicios(events, myUserId, library), [events, myUserId, library]);
  const proximo = misServicios[0] || null;
  const ev = proximo?.event || null;
  const cargos = proximo?.cargos || [];
  const canciones = useMemo(() => (ev ? cancionesParaEnsayar(ev, myUserId, library) : []), [ev, myUserId, library]);
  const equipo = useMemo(() => (ev ? companeros(ev, myUserId, library) : []), [ev, myUserId, library]);
  const notas = useMemo(() => (ev ? indicaciones(ev, myUserId, ministries, library) : []), [ev, myUserId, ministries, library]);
  const atencion = useMemo(() => (puedeVerPendientes ? necesitaAtencion(events, library) : []), [puedeVerPendientes, events, library]);
  const semana = useMemo(() => estaSemana(events, myUserId, library), [events, myUserId, library]);
  const esAlabanza = cargos.some((c) => c.tipo === "rol");
  const fechaEv = ev ? parseIsoDateLocal(ev.date) : null;
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const DIAS_CORTOS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  const fechaLarga = (d, hora) => d ? `${DIAS[d.getDay()][0].toUpperCase()}${DIAS[d.getDay()].slice(1)} ${d.getDate()} de ${MONTH_NAMES_FULL[d.getMonth()].toLowerCase()}${hora ? ` · ${hora.slice(0, 5)}` : ""}` : "Sin fecha";
  const fechaCorta = (d) => d ? `${DIAS[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTH_NAMES_FULL[d.getMonth()].slice(0, 3).toLowerCase()}` : "Sin fecha";
  const abrirDia = (dia) => {
    if (dia.eventos.length === 1) onSelectEvent(dia.eventos[0].id);
    else if (dia.eventos.length > 1) setDayEventsPicker(dia.eventos);
  };

  const tarjetaServicio = ev ? (
    <>
    {/* Toda la tarjeta lleva al culto (pedido de Eldin, 2026-10-11); el equipo va en su propia
        tarjeta aparte, abajo, con su botón "Ver equipo". */}
    <div role="button" tabIndex={0} onClick={() => onSelectEvent(ev.id)} onKeyDown={(e) => { if (e.key === "Enter") onSelectEvent(ev.id); }} aria-label={`Ver el culto: ${ev.title}`} style={{ cursor: "pointer" }}>
    <TarjetaInicio style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 0.4, color: esAlabanza ? "#C2620F" : "#1F8A73" }}>{esAlabanza ? "TU PRÓXIMO SERVICIO" : "TU PRÓXIMO TURNO"}</span>
        {cuandoEs(ev.date) && <span style={{ fontSize: 12.5, fontWeight: 700, background: "var(--wf-active-bg)", color: "var(--wf-active-text)", padding: "4px 10px", borderRadius: 12 }}>{cuandoEs(ev.date)}</span>}
      </div>
      <div style={{ marginTop: 8, color: "var(--wf-text)", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3 }}>{fechaLarga(fechaEv, ev.hora)}</div>
          <div style={{ fontSize: 14, color: "var(--wf-muted)", marginTop: 2 }}>{ev.title}</div>
        </div>
        <ChevronRight size={22} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
      </div>
      <div style={{ fontSize: 16, color: "var(--wf-text)", marginTop: 8 }}>Te toca: <b>{cargos.map((c) => c.nombre).join(", ")}</b></div>
      {esAlabanza && textoEnsayo(ev) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 15, color: "var(--wf-text)" }}>
          <Music size={17} color="#1F8A73" style={{ flexShrink: 0 }} />
          <span>Ensayo: <b>{textoEnsayo(ev)}</b></span>
        </div>
      )}
      {esAlabanza && (ev.notaAlabanza || "").trim() && (
        <div style={{ marginTop: 12, background: "var(--wf-hover)", borderRadius: 14, padding: "12px 14px", borderLeft: "4px solid #1F8A73" }}>
          <div style={{ fontSize: 15, color: "var(--wf-text)", whiteSpace: "pre-line", lineHeight: 1.5 }}>{ev.notaAlabanza}</div>
          {quienDirigeAlabanza(ev) && <div style={{ fontSize: 13, color: "var(--wf-muted)", marginTop: 6 }}>— {quienDirigeAlabanza(ev).n}, dirige la alabanza</div>}
        </div>
      )}
    </TarjetaInicio>
    </div>
      {equipo.length > 0 && (
        <TarjetaInicio style={{ padding: 16, marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: "var(--wf-muted)", marginBottom: 8 }}>{esAlabanza ? "TU EQUIPO" : "CON QUIÉN TE TOCA"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "flex", flexShrink: 0 }}>
              {equipo.slice(0, 3).map((p, i) => (
                <span key={`${p.nombre}-${i}`} style={{ marginLeft: i ? -8 : 0, borderRadius: 18, border: "2px solid var(--wf-card)", display: "flex" }}>
                  <Iniciales nombre={p.nombre} fondo={p.lead ? "var(--wf-brand-primary)" : "var(--wf-hover)"} color={p.lead ? "var(--wf-on-brand-primary)" : "var(--wf-text)"} />
                </span>
              ))}
            </span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {equipo[0].nombre.split(" ")[0]}{equipo.length > 1 ? ` y ${equipo.length - 1} más` : ""}
            </span>
            <button onClick={() => setVerEquipo(true)} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, background: "var(--wf-hover)", color: "var(--wf-text)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "8px 12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Users size={15} /> Ver equipo
            </button>
          </div>
        </TarjetaInicio>
      )}
    </>
  ) : (
    <TarjetaInicio style={{ padding: 18 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--wf-text)" }}>Esta semana no tienes servicio asignado</div>
      {nextEvent ? (
        <button onClick={() => onSelectEvent(nextEvent.id)} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--wf-hover)", border: "none", borderRadius: 14, padding: "12px 14px", cursor: "pointer" }}>
          <Calendar size={18} color="var(--wf-brand-accent)" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, color: "var(--wf-muted)" }}>Próximo servicio de la iglesia</span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--wf-text)" }}>{fechaLarga(nextDate, nextEvent.hora)}</span>
          </span>
          <ChevronRight size={18} color="var(--wf-faint)" />
        </button>
      ) : <div style={{ fontSize: 14, color: "var(--wf-muted)", marginTop: 6 }}>No hay servicios próximos en el calendario.</div>}
    </TarjetaInicio>
  );

  // "Canciones de hoy / de mañana / del domingo": el título dice para cuándo son.
  const tituloCanciones = (() => {
    const cuando = ev ? cuandoEs(ev.date) : null;
    if (cuando === "hoy") return "Canciones de hoy";
    if (cuando === "mañana") return "Canciones de mañana";
    return fechaEv ? `Canciones del ${DIAS[fechaEv.getDay()]}` : "Canciones para ensayar";
  })();
  const seccionCanciones = canciones.length > 0 && (
    <>
      <TituloSeccion derecha={<span style={{ fontSize: 13, color: "var(--wf-muted)" }}>{canciones.length} {canciones.length === 1 ? "canción" : "canciones"}</span>}>{tituloCanciones}</TituloSeccion>
      <TarjetaInicio>
        {(verTodasCanciones ? canciones : canciones.slice(0, 3)).map((c, i) => (
          <button key={c.itemId} onClick={() => onOpenSong(c.songId)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderTop: i ? "1px solid var(--wf-divider)" : "none", background: c.cambiado ? "var(--wf-active-bg)" : "transparent", cursor: "pointer" }}>
            <span style={{ minWidth: 34, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: c.cambiado ? "#C2620F" : "#1F8A73" }}>{acordeEn(c.tono)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 600, color: "var(--wf-text)", lineHeight: 1.3 }}>{c.titulo}</span>
            {c.cambiado && <span title="Tono cambiado para este servicio" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--wf-active-text)", background: "var(--wf-card)", borderRadius: 8, padding: "2px 6px", flexShrink: 0 }}>antes {acordeEn(c.tonoOriginal)}</span>}
            {c.tempo ? <span style={{ fontSize: 12.5, color: "var(--wf-muted)" }}>{c.tempo} bpm</span> : null}
            <ChevronRight size={16} color="var(--wf-faint)" />
          </button>
        ))}
        {canciones.length > 3 && <BotonVerMas abierto={verTodasCanciones} restantes={canciones.length - 3} onClick={() => setVerTodasCanciones((v) => !v)} />}
      </TarjetaInicio>
    </>
  );

  const seccionIndicaciones = notas.length > 0 && (
    <>
      <TituloSeccion>Indicaciones</TituloSeccion>
      {notas.map((n, i) => (
        <TarjetaInicio key={i} style={{ padding: 14, marginBottom: 8 }}>
          {notas.length > 1 && <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-muted)", marginBottom: 4 }}>{n.bloque}</div>}
          <div style={{ fontSize: 15, color: "var(--wf-text)", lineHeight: 1.55, whiteSpace: "pre-line" }}>{n.texto}</div>
          {n.autor && <div style={{ fontSize: 13, color: "var(--wf-muted)", marginTop: 6 }}>— {n.autor}</div>}
        </TarjetaInicio>
      ))}
    </>
  );

  const seccionAtencion = atencion.length > 0 && (
    <>
      <TituloSeccion derecha={<span style={{ fontSize: 13, color: "var(--wf-muted)" }}>próximos 14 días</span>}>Necesita tu atención</TituloSeccion>
      <TarjetaInicio>
        {(verTodaAtencion ? atencion : atencion.slice(0, 3)).map((a, i) => (
          <button key={i} onClick={() => onSelectEvent(a.eventId)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderTop: i ? "1px solid var(--wf-divider)" : "none", background: "transparent", cursor: "pointer" }}>
            {a.tipo === "setlist" ? <Music size={18} color="#B15EA0" /> : a.tipo === "rechazo" ? <X size={18} color="#C23B32" /> : <Users size={18} color="#5661B3" />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--wf-text)", lineHeight: 1.35 }}>{a.texto}</span>
            <ChevronRight size={16} color="var(--wf-faint)" />
          </button>
        ))}
        {atencion.length > 3 && <BotonVerMas abierto={verTodaAtencion} restantes={atencion.length - 3} onClick={() => setVerTodaAtencion((v) => !v)} />}
      </TarjetaInicio>
    </>
  );

  const otrasFechas = misServicios.slice(1, 13);
  const seccionFechas = otrasFechas.length > 0 && (
    <>
      <TituloSeccion>Tus próximas fechas</TituloSeccion>
      <TarjetaInicio>
        {(verTodasFechas ? otrasFechas : otrasFechas.slice(0, 3)).map(({ event: e, cargos: cs }, i) => {
          return (
            <button key={e.id} onClick={() => onSelectEvent(e.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderTop: i ? "1px solid var(--wf-divider)" : "none", background: "transparent", cursor: "pointer" }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: "var(--wf-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <b>{fechaCorta(parseIsoDateLocal(e.date))}</b> · {cs.map((c) => c.nombre).join(", ")}
              </span>
              <ChevronRight size={16} color="var(--wf-faint)" />
            </button>
          );
        })}
        {otrasFechas.length > 3 && <BotonVerMas abierto={verTodasFechas} restantes={otrasFechas.length - 3} onClick={() => setVerTodasFechas((v) => !v)} />}
      </TarjetaInicio>
    </>
  );

  const calendarioMes = (
    <>
        {/* Calendario del mes en curso */}
        <div style={{ flex: isCompact ? "none" : 1.3, minHeight: 0, background: "var(--wf-card)", borderRadius: 20, boxShadow: "0 6px 20px rgba(22,50,79,0.08)", padding: 18, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0, gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => changeMonth(-1)} style={iconGhost}><ChevronLeft size={16} /></button>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 16, fontWeight: 600, color: "var(--wf-heading)" }}>{MONTH_NAMES_FULL[viewedMonth.month]} {viewedMonth.year}</span>
              <button onClick={() => changeMonth(1)} style={iconGhost}><ChevronRight size={16} /></button>
              {!isViewingCurrentMonth && (
                <button onClick={() => setViewedMonth({ year: today.getFullYear(), month: today.getMonth() })} style={{ ...ghostToggleBtn, padding: "4px 8px", fontSize: 10 }}>Hoy</button>
              )}
            </div>
            <span style={{ fontSize: 11, color: "var(--wf-faint)", flexShrink: 0 }}>{eventsThisMonth} {eventsThisMonth === 1 ? "evento" : "eventos"} este mes</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6, flexShrink: 0 }}>
            {DOW_LABELS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--wf-faint)" }}>{d}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: isCompact ? "none" : 1, minHeight: 0 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, flex: isCompact ? "none" : 1, minHeight: isCompact ? 40 : 0 }}>
                {week.map((day, di) => {
                  if (day === null) return <div key={di} />;
                  const dayEvents = byDay[day] || [];
                  const isNext = !!(nextDate && nextDate.getFullYear() === viewedMonth.year && nextDate.getMonth() === viewedMonth.month && day === nextDate.getDate());
                  const isToday = isViewingCurrentMonth && day === today.getDate();
                  return (
                    <button
                      key={di}
                      disabled={dayEvents.length === 0}
                      onClick={() => { if (dayEvents.length === 1) onSelectEvent(dayEvents[0].id); else if (dayEvents.length > 1) setDayEventsPicker(dayEvents); }}
                      className={dayEvents.length && !isNext ? "hoverable" : undefined}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                        borderRadius: 14, border: isToday && !isNext ? "1.5px solid #2F5FA8" : "1.5px solid transparent",
                        background: isNext ? "var(--wf-brand-accent)" : dayEvents.length ? "var(--wf-hover)" : "transparent",
                        cursor: dayEvents.length ? "pointer" : "default", padding: 0,
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: isNext ? 800 : 600, color: isNext ? "#fff" : "var(--wf-text-2)" }}>{day}</span>
                      {dayEvents.length > 0 && (
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: isNext ? "#fff" : "var(--wf-brand-accent)" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

    </>
  );

  const seccionSemana = (
    <>
      <TituloSeccion derecha={<button onClick={() => setVerMes((v) => !v)} style={{ background: "none", border: "none", fontSize: 13.5, fontWeight: 700, color: "#2F5FA8", cursor: "pointer" }}>{verMes ? "Ocultar mes" : "Ver mes completo"}</button>}>Esta semana</TituloSeccion>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {semana.map((d, i) => {
          const conEventos = d.eventos.length > 0;
          return (
            <button
              key={d.iso} onClick={() => abrirDia(d)} disabled={!conEventos}
              aria-label={`${DIAS_CORTOS[i]} ${d.fecha.getDate()}${conEventos ? `, ${d.eventos.length} servicio${d.eventos.length > 1 ? "s" : ""}` : ""}${d.meToca ? ", te toca" : ""}`}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, padding: "5px 0", borderRadius: 12, cursor: conEventos ? "pointer" : "default",
                background: d.esHoy ? "var(--wf-brand-primary)" : "var(--wf-card)", color: d.esHoy ? "var(--wf-on-brand-primary)" : "var(--wf-text)",
                border: d.meToca && !d.esHoy ? "2px solid var(--wf-brand-accent)" : "2px solid transparent", boxShadow: "0 2px 8px rgba(22,50,79,0.06)" }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{DIAS_CORTOS[i]}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{d.fecha.getDate()}</span>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: d.meToca ? "var(--wf-brand-accent)" : conEventos ? "var(--wf-faint)" : "transparent" }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: isCompact && !verMes ? "none" : "flex", gap: 14, fontSize: 12.5, color: "var(--wf-muted)", margin: "8px 4px 0" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--wf-brand-accent)" }} /> Te toca</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: "var(--wf-faint)" }} /> Hay servicio</span>
      </div>
      {verMes && <div style={{ marginTop: 12, display: "flex", flexDirection: "column", minHeight: 320 }}>{calendarioMes}</div>}
    </>
  );

  const atajos = (
    <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
      {canSeeCanciones && <StatCard icon={Heart} label="Canciones favoritas" value={favoritesCount} onClick={() => setShowFavorites(true)} />}
      <StatCard icon={Users} label="Miembros del equipo" value={memberCount} onClick={onGoToTeam} />
    </div>
  );

  return (
    <div className="screen-enter" style={{ height: "100%", boxSizing: "border-box", overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ maxWidth: isCompact ? "none" : 1080, margin: "0 auto", padding: isCompact ? "14px 16px 110px" : "24px 28px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: isCompact ? 23 : 26, fontWeight: 600, lineHeight: 1.2 }}>{greetingWord()}{myName ? `, ${myName.split(" ")[0]}` : ""}</div>
            <div style={{ fontSize: 13, color: "var(--wf-muted)", marginTop: 2 }}>{fechaLarga(today)}{isCompact ? "" : ` · ${teamName}`}</div>
          </div>
        </div>

        {/* Evento en vivo (pedido de Eldin, 2026-10-21: "antes… se resaltaba con una luz sombreada y
            resaltaba antes que cualquier otro evento"): tarjeta grande con brillo naranja que late,
            arriba de todo lo demás. */}
        {liveEvent && (
          <button onClick={() => (liveLibre ? onGoLive() : onSelectEvent(liveEvent.id))} className="tarjeta-en-vivo" aria-label={`En vivo ahora: ${liveEvent.title}`}
            style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", border: "none", cursor: "pointer", borderRadius: 20, padding: isCompact ? "16px 16px" : "18px 22px", marginBottom: 16, overflow: "hidden", color: "#fff", background: liveEvent.cover || DEFAULT_COVERS[0] }}>
            <span aria-hidden="true" style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 12% 30%, rgba(232,130,30,.45), transparent 60%)", pointerEvents: "none" }} />
            <span style={{ position: "relative", width: 46, height: 46, borderRadius: 16, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Radio size={22} color="#fff" />
            </span>
            <span style={{ position: "relative", flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: 0.6 }}>
                <span className="live-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#FF5A4E", boxShadow: "0 0 8px #FF5A4E" }} /> EN VIVO AHORA
              </span>
              <span style={{ display: "block", fontFamily: "'Fraunces', serif", fontSize: isCompact ? 18 : 21, fontWeight: 600, lineHeight: 1.25, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{liveEvent.title}</span>
              {liveEvent.location && <span style={{ display: "block", fontSize: 12, opacity: 0.85, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{liveEvent.location}</span>}
            </span>
            <span style={{ position: "relative", display: "flex", alignItems: "center", gap: 4, background: "#fff", color: "var(--wf-brand-primary, #16324F)", borderRadius: 14, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>
              {isCompact ? "Ver" : "Ver evento"} <ChevronRight size={14} />
            </span>
          </button>
        )}

        {avisoPush && <AvisoActivarPush estado={avisoPush} onActivar={onActivarPush} onCerrar={onOcultarPush} />}

        {isCompact ? (
          <>
            {/* Compacto (pedido de Eldin, 2026-10-09: "hay que hacer mucho scrolling"): el equipo va
                dentro de la tarjeta del servicio, y los atajos de favoritos/miembros ya tienen su pestaña. */}
            {tarjetaServicio}
            {seccionCanciones}
            {seccionIndicaciones}
            {seccionAtencion}
            {seccionFechas}
            {seccionSemana}
          </>
        ) : (
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
            <div style={{ flex: 1.2, minWidth: 0 }}>
              {tarjetaServicio}
              {seccionCanciones}
              {seccionIndicaciones}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginTop: -20 }}>{seccionSemana}</div>
              {seccionAtencion}
              {seccionFechas}
              {atajos}
            </div>
          </div>
        )}
      </div>

      {showFavorites && (
        <ModalShell title="Canciones favoritas" icon={Heart} color="#C23B32" onClose={() => setShowFavorites(false)}>
          {favoriteSongs.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Todavía no has marcado ninguna canción como favorita — busca el corazón en Canciones.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "60vh", overflowY: "auto" }}>
              {favoriteSongs.map((s) => (
                <button key={s.id} onClick={() => { setShowFavorites(false); onOpenSong(s.id); }} className="hoverable" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: "var(--wf-hover)", border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</div>
                    <div style={{ fontSize: 11, color: "#1F8A73", fontFamily: "'JetBrains Mono', monospace" }}>{acordeEn(s.key)} · {s.tempo} bpm</div>
                  </div>
                  <ChevronRight size={14} color="var(--wf-faint)" />
                </button>
              ))}
            </div>
          )}
        </ModalShell>
      )}

      {verEquipo && (
        <ModalShell title={esAlabanza ? "Tu equipo" : "Con quién te toca"} icon={Users} color="#6E63C7" onClose={() => setVerEquipo(false)}>
          <div style={{ display: "flex", flexDirection: "column", maxHeight: "60vh", overflowY: "auto" }}>
            {equipo.map((p, i) => (
              <div key={`${p.nombre}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 2px", borderTop: i ? "1px solid var(--wf-divider)" : "none" }}>
                <Iniciales nombre={p.nombre} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--wf-text)" }}>{p.nombre}</span>
                  <span style={{ display: "block", fontSize: 13, color: "var(--wf-muted)" }}>{p.cargos.join(", ")}</span>
                </span>
                {p.lead && <span style={{ fontSize: 12, fontWeight: 700, background: "var(--wf-brand-primary)", color: "var(--wf-on-brand-primary)", padding: "3px 9px", borderRadius: 10 }}>{esAlabanza ? "Dirige" : "A cargo"}</span>}
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {dayEventsPicker && (
        <ModalShell title="Servicios de ese día" icon={Calendar} color="#2F5FA8" onClose={() => setDayEventsPicker(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {dayEventsPicker.map((e) => (
              <button key={e.id} onClick={() => { setDayEventsPicker(null); onSelectEvent(e.id); }} className="hoverable" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", textAlign: "left", background: "var(--wf-hover)", border: "none", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{e.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--wf-muted)" }}>{e.hora ? `${e.hora.slice(0, 5)} · ` : ""}{e.location}</div>
                </div>
                <ChevronRight size={14} color="var(--wf-faint)" />
              </button>
            ))}
          </div>
        </ModalShell>
      )}
    </div>
  );
}
