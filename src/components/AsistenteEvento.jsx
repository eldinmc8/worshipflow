import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Music, BookOpen, Type, Timer, ListMusic, Sparkles, CalendarRange, X, Check, Users } from "lucide-react";
import AsistentePasos, { EncabezadoPaso, Pildora, botonPie } from "./AsistentePasos.jsx";
import { Field, inputStyle, ModalShell, primaryBtn } from "../pantallas/compartido.jsx";
import { BibleModal } from "../pantallas/biblia.jsx";
import { buscarCanciones } from "../lib/busqueda.js";
import { ordenarPor } from "../lib/orden.js";
import { tituloAutomatico, formatHora } from "../lib/dates.js";
import { SUGERENCIAS_MOMENTOS, armarOrdenDelCulto, resumenOrden } from "../lib/asistenteEvento.js";

// Nueva plantilla / Nuevo evento por pasos (pedido de Eldin, 2026-11-20), igual que Nueva canción:
// - Plantilla: Nombre → Momentos → Contenido → Encargados → Listo (y de ahí, "Publicar en varias fechas").
// - Evento: ¿Cómo? (desde una plantilla o evento especial) → Datos; si es especial, además
//   Momentos → Contenido → Encargados → Listo.
// En el celular, el contenido es solo canciones: cuenta regresiva, versículos y diapositivas se ponen
// desde la computadora (regla del producto: las diapositivas no se editan en el celular).
const campo = { ...inputStyle, fontSize: 16, minHeight: 44 };
const tarjeta = { background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 16, padding: 12 };
let semilla = 0;
const idLocal = () => `m${Date.now().toString(36)}${(semilla++).toString(36)}`;

export default function AsistenteEvento({ modo, plantillas = [], library = [], usuarios = [], ministerios = [], puedeGeneral = true, ministerioInicial = null, isCompact = false, onCrear, onPublicarVarias, onCerrar }) {
  const esPlantilla = modo === "plantilla";
  const [paso, setPaso] = useState(0);
  const [tipo, setTipo] = useState(esPlantilla ? "especial" : (plantillas.length ? null : "especial")); // "plantilla" | "especial"
  const [plantillaId, setPlantillaId] = useState(null);
  const [datos, setDatos] = useState({ title: "", tituloTocado: false, date: "", hora: "", location: "", ministryId: ministerioInicial });
  const [momentos, setMomentos] = useState([]);
  const [cuenta, setCuenta] = useState(null); // null | "hora" | minutos
  const [eligiendoCancion, setEligiendoCancion] = useState(null); // id del momento
  const [eligiendoVersiculo, setEligiendoVersiculo] = useState(null);
  const [escribiendoTexto, setEscribiendoTexto] = useState(null); // { id, texto }
  const [guardando, setGuardando] = useState(false);

  const nombrePasos = esPlantilla
    ? [["nombre", "Nombre"], ["momentos", "Momentos"], ["contenido", "Contenido"], ["encargados", "Encargados"], ["listo", "Listo"]]
    : [["tipo", "¿Cómo?"], ["datos", "Datos"], ...(tipo === "especial" ? [["momentos", "Momentos"], ["contenido", "Contenido"], ["encargados", "Encargados"], ["listo", "Listo"]] : [])];
  const pasos = nombrePasos.map(([clave, nombre]) => ({ clave, nombre }));
  const actual = pasos[paso]?.clave;

  const conTituloAuto = (d) => (d.tituloTocado || esPlantilla ? d : { ...d, title: tituloAutomatico(d.date, d.hora) });
  const cambiar = (patch) => setDatos((d) => conTituloAuto({ ...d, ...patch }));
  const cancionesOrden = useMemo(() => ordenarPor(library, (s) => s.title), [library]);
  const plantillasOrden = useMemo(() => ordenarPor(plantillas, (p) => p.title), [plantillas]);

  // ---- momentos ----
  const agregarMomento = (title = "") => setMomentos((ms) => [...ms, { id: idLocal(), title, contenido: [], encargados: [] }]);
  const cambiarMomento = (id, fn) => setMomentos((ms) => ms.map((m) => (m.id === id ? fn(m) : m)));
  const moverMomento = (i, d) => setMomentos((ms) => {
    const j = i + d;
    if (j < 0 || j >= ms.length) return ms;
    const c = [...ms];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });
  const quitarMomento = (id) => setMomentos((ms) => ms.filter((m) => m.id !== id));
  const agregarContenido = (id, item) => cambiarMomento(id, (m) => ({ ...m, contenido: [...m.contenido, item] }));
  const quitarContenido = (id, idx) => cambiarMomento(id, (m) => ({ ...m, contenido: m.contenido.filter((_, i) => i !== idx) }));
  const alternarEncargado = (id, u) => cambiarMomento(id, (m) => ({
    ...m,
    encargados: m.encargados.some((p) => p.usuarioId === u.id) ? m.encargados.filter((p) => p.usuarioId !== u.id) : [...m.encargados, { usuarioId: u.id, n: u.nombre }],
  }));
  const momentosValidos = momentos.filter((m) => m.title.trim());
  const nombreDe = (c) => (c.type === "cancion" ? (library.find((s) => s.id === c.songId)?.title || "Canción") : c.type === "biblia" ? c.reference : c.title);

  // ---- validación por paso ----
  const faltaDatos = !datos.title.trim() ? (esPlantilla ? "Falta el nombre" : "Falta el título") : (!esPlantilla && !datos.date ? "Falta la fecha" : "");
  const faltaPorPaso = {
    tipo: !tipo ? "Elige una opción" : tipo === "plantilla" && !plantillaId ? "Elige la plantilla" : "",
    nombre: faltaDatos, datos: faltaDatos,
    momentos: momentosValidos.length ? "" : "Agrega al menos un momento",
  };
  const falta = faltaPorPaso[actual] || "";

  const crear = async (publicarDespues = false) => {
    setGuardando(true);
    try {
      const base = { title: datos.title.trim(), date: esPlantilla ? null : datos.date, hora: datos.hora || null, location: datos.location.trim() || "Por definir", esPlantilla, ministryId: esPlantilla ? null : datos.ministryId || null };
      const nuevo = tipo === "plantilla" && !esPlantilla
        ? await onCrear({ ...base, templateId: plantillaId })
        : await onCrear({ ...base, templateId: null, serviceOrder: armarOrdenDelCulto({ momentos, cuenta: isCompact ? null : cuenta }, () => crypto.randomUUID()) }, { abrir: !publicarDespues });
      if (publicarDespues && nuevo) onPublicarVarias?.(nuevo);
      else onCerrar();
    } finally {
      setGuardando(false);
    }
  };
  const ultimoEsCrear = !esPlantilla && tipo === "plantilla" && actual === "datos";
  const resumen = resumenOrden({ momentos, cuenta: isCompact ? null : cuenta });

  return (
    <AsistentePasos titulo={esPlantilla ? "Nueva plantilla" : "Nuevo evento"} pasos={pasos} paso={paso} onPaso={setPaso} onCerrar={onCerrar}
      puedeSeguir={!falta} falta={falta} omitir={actual === "contenido" || actual === "encargados"} ocupado={guardando}
      onFinal={() => crear(false)} textoFinal={guardando ? "Guardando…" : esPlantilla ? "Guardar plantilla" : "Crear evento"}>

      {actual === "tipo" && (
        <>
          <EncabezadoPaso titulo="¿Cómo quieres armar el evento?" ayuda="Si es uno de tus servicios de siempre, usa su plantilla. Si es algo distinto, ármalo paso a paso." />
          <div style={{ display: "grid", gap: 10, marginBottom: 18 }}>
            {[["plantilla", ListMusic, "Desde una plantilla", "El orden del culto y los encargados ya vienen listos.", !plantillas.length],
              ["especial", Sparkles, "Evento especial", "Un evento distinto: lo armas por momentos, con sus canciones y encargados.", false]].map(([v, Icono, t, d, deshab]) => (
              <button key={v} type="button" disabled={deshab} onClick={() => { setTipo(v); if (v === "especial") setPlantillaId(null); }} aria-pressed={tipo === v}
                style={{ ...tarjeta, display: "flex", alignItems: "center", gap: 12, textAlign: "left", cursor: deshab ? "not-allowed" : "pointer", opacity: deshab ? 0.5 : 1, border: tipo === v ? "2px solid var(--wf-brand-accent)" : "2px solid transparent", color: "var(--wf-text)", fontFamily: "inherit" }}>
                <span style={{ width: 42, height: 42, borderRadius: 13, background: tipo === v ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: tipo === v ? "var(--wf-on-brand-accent, #fff)" : "#5661B3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icono size={20} /></span>
                <span><span style={{ display: "block", fontSize: 15, fontWeight: 800 }}>{t}</span><span style={{ display: "block", fontSize: 12.5, color: "var(--wf-muted)" }}>{deshab ? "Todavía no hay plantillas." : d}</span></span>
              </button>
            ))}
          </div>
          {tipo === "plantilla" && (
            <Field label="¿Cuál plantilla?">
              <div style={{ display: "grid", gap: 6 }}>
                {plantillasOrden.map((pl) => (
                  <button key={pl.id} type="button" onClick={() => { setPlantillaId(pl.id); setDatos((d) => conTituloAuto({ ...d, hora: d.hora || (pl.hora ? String(pl.hora).slice(0, 5) : ""), location: d.location || (pl.location && pl.location !== "Por definir" ? pl.location : "") })); }}
                    style={{ ...tarjeta, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, textAlign: "left", cursor: "pointer", border: plantillaId === pl.id ? "2px solid #5661B3" : "2px solid transparent", color: "var(--wf-text)", fontFamily: "inherit" }}>
                    <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{pl.title}</span><span style={{ fontSize: 11.5, color: "var(--wf-faint)" }}>{(pl.serviceOrder || []).length} elementos</span></span>
                    {plantillaId === pl.id && <Check size={18} color="#5661B3" />}
                  </button>
                ))}
              </div>
            </Field>
          )}
        </>
      )}

      {(actual === "nombre" || actual === "datos") && (
        <>
          <EncabezadoPaso titulo={esPlantilla ? "¿Cómo se llama esta plantilla?" : "Datos del evento"} ayuda={esPlantilla ? "Por ejemplo, el nombre de tu servicio de siempre." : "El título se llena solo con la fecha y la hora. Cámbialo si es un evento especial."} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!esPlantilla && ministerios.length > 0 && (
              <Field label="¿De quién es este evento?">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {[...(puedeGeneral ? [{ id: null, name: "General (toda la iglesia)" }] : []), ...ministerios].map((m) => (
                    <Pildora key={m.id || "general"} activo={(datos.ministryId || null) === m.id} onClick={() => setDatos((d) => ({ ...d, ministryId: m.id }))}>{m.name}</Pildora>
                  ))}
                </div>
              </Field>
            )}
            {esPlantilla && <Field label="Nombre de la plantilla" required><input value={datos.title} autoFocus onChange={(e) => setDatos((d) => ({ ...d, title: e.target.value }))} placeholder="Ej. Culto de oración (miércoles)" style={campo} /></Field>}
            {!esPlantilla && <Field label="Fecha" required><input type="date" value={datos.date} onChange={(e) => cambiar({ date: e.target.value })} style={campo} /></Field>}
            <Field label={esPlantilla ? "Hora de siempre (opcional)" : "Hora"}><input type="time" value={datos.hora} onChange={(e) => cambiar({ hora: e.target.value })} style={campo} /></Field>
            {!esPlantilla && (
              <Field label="Título" required>
                <input value={datos.title} onChange={(e) => setDatos((d) => ({ ...d, title: e.target.value, tituloTocado: true }))} placeholder="Se llena solo con la fecha y la hora" style={campo} />
              </Field>
            )}
            <Field label="Lugar (opcional)"><input value={datos.location} onChange={(e) => setDatos((d) => ({ ...d, location: e.target.value }))} placeholder="Ej. Templo principal" style={campo} /></Field>
          </div>
        </>
      )}

      {actual === "momentos" && (
        <>
          <EncabezadoPaso titulo="Momentos del culto" ayuda="Agrega las partes del culto en orden y ponles nombre. Toca una sugerencia para agregarla." />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {SUGERENCIAS_MOMENTOS.filter((s) => !momentos.some((m) => m.title.trim().toLowerCase() === s.toLowerCase())).map((s) => (
              <Pildora key={s} activo={false} onClick={() => agregarMomento(s)}><Plus size={13}/> {s}</Pildora>
            ))}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {momentos.map((m, i) => (
              <div key={m.id} style={{ ...tarjeta, display: "flex", alignItems: "center", gap: 6, padding: 8 }}>
                <span style={{ width: 26, height: 26, borderRadius: "50%", background: "color-mix(in srgb, #5661B3 15%, transparent)", color: "#5661B3", fontSize: 12.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                <input value={m.title} autoFocus={!m.title} aria-label={`Momento ${i + 1}`} onChange={(e) => cambiarMomento(m.id, (x) => ({ ...x, title: e.target.value }))} placeholder="Nombre del momento" style={{ ...campo, flex: 1, minWidth: 0, border: "none", background: "var(--wf-hover)" }} />
                <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => moverMomento(i, -1)} style={iconoBtn(i === 0)}><ChevronUp size={18} /></button>
                <button type="button" aria-label="Bajar" disabled={i === momentos.length - 1} onClick={() => moverMomento(i, 1)} style={iconoBtn(i === momentos.length - 1)}><ChevronDown size={18} /></button>
                <button type="button" aria-label="Quitar" onClick={() => quitarMomento(m.id)} style={iconoBtn(false)}><Trash2 size={16} color="#C23B32" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => agregarMomento("")} style={{ ...botonPie, width: "100%", marginTop: 10, background: "transparent", border: "1.5px dashed var(--wf-border)", color: "var(--wf-text)" }}><Plus size={18} /> Agregar otro momento</button>
        </>
      )}

      {actual === "contenido" && (
        <>
          <EncabezadoPaso titulo="¿Qué va en cada momento?" ayuda={esPlantilla ? "Pon lo que se repite siempre. Las canciones de cada semana se eligen después en cada evento." : "Agrega las canciones y lo que se va a proyectar."} />
          {isCompact ? (
            <p style={{ fontSize: 12.5, color: "var(--wf-muted)", margin: "0 0 14px" }}>Desde el celular se agregan canciones. La cuenta regresiva, los versículos y las diapositivas se ponen desde la computadora.</p>
          ) : (
            <div style={{ ...tarjeta, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14.5, fontWeight: 800, marginBottom: 8 }}><Timer size={17} color="var(--wf-brand-accent)" /> Cuenta regresiva antes de iniciar</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <Pildora activo={cuenta == null} onClick={() => setCuenta(null)}>Sin cuenta</Pildora>
                <Pildora activo={cuenta === "hora"} onClick={() => setCuenta("hora")}>Hasta la hora del culto</Pildora>
                {[5, 10, 15].map((n) => <Pildora key={n} activo={cuenta === n} onClick={() => setCuenta(n)}>{n} min</Pildora>)}
              </div>
              {cuenta === "hora" && !datos.hora && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 8 }}>Sin hora definida, cuenta 5 minutos desde que se pone al aire.</div>}
            </div>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {momentosValidos.map((m) => (
              <div key={m.id} style={tarjeta}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{m.title}</div>
                {m.contenido.map((c, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--wf-divider)" }}>
                    {c.type === "cancion" ? <Music size={15} color="var(--wf-brand-accent)" /> : c.type === "biblia" ? <BookOpen size={15} color="#2F5FA8" /> : <Type size={15} color="#B15EA0" />}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(c)}</span>
                    <button type="button" aria-label="Quitar" onClick={() => quitarContenido(m.id, idx)} style={iconoBtn(false)}><X size={16} /></button>
                  </div>
                ))}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  <Pildora activo={false} onClick={() => setEligiendoCancion(m.id)}><Music size={13}/> Canción</Pildora>
                  {!isCompact && <Pildora activo={false} onClick={() => setEligiendoVersiculo(m.id)}><BookOpen size={13}/> Versículo</Pildora>}
                  {!isCompact && <Pildora activo={false} onClick={() => setEscribiendoTexto({ id: m.id, texto: "" })}><Type size={13}/> Texto</Pildora>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {actual === "encargados" && (
        <>
          <EncabezadoPaso titulo={esPlantilla ? "Encargados fijos" : "¿Quién está a cargo?"} ayuda={esPlantilla ? "Las personas que siempre están en cada momento. Se copian a cada servicio y confirman cada semana." : "Toca a las personas de cada momento. Les llega un aviso para confirmar."} />
          {usuarios.length === 0 && <p style={{ fontSize: 13, color: "var(--wf-muted)" }}>Todavía no hay miembros en la iglesia.</p>}
          <div style={{ display: "grid", gap: 10 }}>
            {momentosValidos.map((m) => (
              <div key={m.id} style={tarjeta}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{m.title}{m.encargados.length > 0 && <span style={{ fontSize: 12, color: "var(--wf-muted)", fontWeight: 600 }}>· {m.encargados.length}</span>}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {usuarios.map((u) => <Pildora key={u.id} activo={m.encargados.some((p) => p.usuarioId === u.id)} onClick={() => alternarEncargado(m.id, u)}>{u.nombre}</Pildora>)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {actual === "listo" && (
        <>
          <EncabezadoPaso titulo={esPlantilla ? "¡Tu plantilla está lista!" : "¡Tu evento está listo!"} ayuda="Revisa el resumen. Todo se puede cambiar después." />
          <div style={{ ...tarjeta, marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{datos.title}</div>
            <div style={{ fontSize: 13, color: "var(--wf-muted)", marginBottom: 10 }}>{[esPlantilla ? null : tituloAutomatico(datos.date, null), formatHora(datos.hora), datos.location.trim()].filter(Boolean).join(" · ") || "Sin hora ni lugar"}</div>
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              {[...(resumen.cuenta ? [{ id: "cuenta", title: "Cuenta regresiva", contenido: [], encargados: [] }] : []), ...momentosValidos].map((m, i) => (
                <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span style={{ minWidth: 18, fontWeight: 800, color: "#5661B3" }}>{i + 1}.</span>
                  <span><b>{m.title}</b>{m.contenido.length ? ` · ${m.contenido.map(nombreDe).join(", ")}` : ""}{m.encargados.length ? <span style={{ color: "var(--wf-muted)" }}> · {m.encargados.map((p) => p.n).join(", ")}</span> : null}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 13, color: "var(--wf-muted)", marginBottom: 16, flexWrap: "wrap" }}>
            {[[ListMusic, resumen.momentos, "momento", "momentos"], [Music, resumen.canciones, "canción", "canciones"], [Users, resumen.encargados, "encargado", "encargados"]].map(([Icono, n, uno, varios]) => (
              <span key={varios} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Icono size={14} /> {n} {n === 1 ? uno : varios}</span>
            ))}
          </div>
          {esPlantilla && onPublicarVarias && (
            <button type="button" disabled={guardando} onClick={() => crear(true)} style={{ ...botonPie, width: "100%", border: "2px solid var(--wf-brand-accent)", background: "color-mix(in srgb, var(--wf-brand-accent) 10%, transparent)", color: "var(--wf-text)" }}>
              <CalendarRange size={18} /> Guardar y publicar en varias fechas
            </button>
          )}
        </>
      )}

      {ultimoEsCrear && <p style={{ fontSize: 12.5, color: "var(--wf-muted)", marginTop: 16 }}>Al crear el evento se copia el orden del culto, los encargados y los recordatorios de la plantilla.</p>}

      {eligiendoCancion && <ElegirCancion canciones={cancionesOrden} onCerrar={() => setEligiendoCancion(null)} onElegir={(s) => { agregarContenido(eligiendoCancion, { type: "cancion", songId: s.id, structure: s.defaultStructure }); setEligiendoCancion(null); }} />}
      {eligiendoVersiculo && <BibleModal onClose={() => setEligiendoVersiculo(null)} submitLabel="Agregar" onAdd={(b) => { agregarContenido(eligiendoVersiculo, { type: "biblia", reference: b.ref, version: b.version, text: b.text, bookId: b.bookId, bookName: b.bookName, chapter: b.chapter, verseStart: b.verseStart, verseEnd: b.verseEnd }); setEligiendoVersiculo(null); }} />}
      {escribiendoTexto && (
        <ModalShell title="Diapositiva de texto" icon={Type} color="#B15EA0" onClose={() => setEscribiendoTexto(null)}>
          <Field label="Texto"><input value={escribiendoTexto.texto} autoFocus onChange={(e) => setEscribiendoTexto((t) => ({ ...t, texto: e.target.value }))} placeholder="Ej. ¡Bienvenidos!" style={campo} /></Field>
          <button type="button" disabled={!escribiendoTexto.texto.trim()} onClick={() => { agregarContenido(escribiendoTexto.id, { type: "slide", title: escribiendoTexto.texto.trim(), subtitle: "", name: "", bg: "#1B2029", bgType: "color", videoUrl: "", imageUrl: "" }); setEscribiendoTexto(null); }} style={{ ...primaryBtn, marginTop: 14, opacity: escribiendoTexto.texto.trim() ? 1 : 0.4 }}>Agregar</button>
        </ModalShell>
      )}
    </AsistentePasos>
  );
}

function iconoBtn(deshab) {
  return { background: "transparent", border: "none", color: "var(--wf-muted)", cursor: deshab ? "not-allowed" : "pointer", opacity: deshab ? 0.3 : 1, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, flexShrink: 0 };
}

function ElegirCancion({ canciones, onElegir, onCerrar }) {
  const [q, setQ] = useState("");
  const lista = buscarCanciones(canciones, q);
  return (
    <ModalShell title="Elegir canción" icon={Music} color="var(--wf-brand-accent)" onClose={onCerrar} alto>
      <input value={q} autoFocus onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título o artista" style={{ ...campo, marginBottom: 10 }} />
      <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 4, alignContent: "start" }}>
        {lista.length === 0 && <div style={{ fontSize: 13, color: "var(--wf-faint)", padding: 10 }}>No hay canciones con ese nombre.</div>}
        {lista.map((s) => (
          <button key={s.id} type="button" onClick={() => onElegir(s)} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "10px 8px", border: "none", borderRadius: 12, background: "transparent", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>
            <Music size={15} color="var(--wf-brand-accent)" />
            <span style={{ flex: 1, minWidth: 0 }}><span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{s.title}</span><span style={{ fontSize: 12, color: "var(--wf-muted)" }}>{[s.artist, s.key].filter(Boolean).join(" · ")}</span></span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
