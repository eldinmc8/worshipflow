import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Shield, Copy, RefreshCw, KeyRound, Power, Radio, Search, Users, Music, CalendarDays, Tv, ChevronRight, AlertTriangle, CheckCircle2, Circle, Mail, Sparkles, Link2, Bot, LayoutGrid } from "lucide-react";
import { supabase, callUsersFunction } from "./lib/supabaseClient.js";
import { showToast } from "./lib/toast.js";
import { confirmDialog, promptDialog } from "./lib/confirm.js";
import { validarPassword } from "./lib/passwordSegura.js";
import { ordenarPor } from "./lib/orden.js";
import { ESTADOS_SALUD, estadoSalud, alertasIglesia, pasosArranque, ultimaActividad, haceCuanto, prioridadAtencion } from "./lib/saludIglesia.js";

const cardStyle = { background: "var(--wf-card)", borderRadius: 16, boxShadow: "0 3px 14px rgba(22,50,79,0.09)", padding: "14px 16px", marginBottom: 12 };
const ghostBtn = { background: "var(--wf-hover)", border: "1px solid var(--wf-border)", borderRadius: 12, padding: "7px 11px", fontSize: 12, fontWeight: 600, color: "var(--wf-text)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const dangerBtn = { ...ghostBtn, color: "#C23B32" };
const inputStyle = { width: "100%", background: "var(--wf-card)", border: "1px solid var(--wf-border)", borderRadius: 10, padding: "9px 10px", fontSize: 13, color: "var(--wf-text)", outline: "none", boxSizing: "border-box" };
const tituloSeccion = { fontSize: 11, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 10 };
const COLOR_ALERTA = { alta: "#C23B32", media: "#E8821E", baja: "#8996A6" };

// Código de invitación nuevo (12 caracteres hexadecimales) — se guarda como fila en codigos_invitacion.
function generarCodigo() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const fechaCorta = (f) => (f ? new Date(f).toLocaleDateString("es-GT", { day: "numeric", month: "short", year: "numeric" }) : "—");
const fechaEvento = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "short" }) : "—");

function PildoraSalud({ estado }) {
  const e = ESTADOS_SALUD[estado];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, flexShrink: 0, background: e.fondo, color: e.color }}>{e.label}</span>;
}

function Inicial({ igl, size = 40 }) {
  if (igl.logo_url) return <img src={igl.logo_url} alt="" style={{ width: size, height: size, borderRadius: 12, objectFit: "contain", background: "#fff", flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: 12, background: "#16324F", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.42, flexShrink: 0 }}>{(igl.nombre || "?").trim().charAt(0).toUpperCase()}</div>;
}

function Dato({ icon: Icon, color, valor, label, extra }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      <div style={{ width: 30, height: 30, borderRadius: 10, background: `${color}1F`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={15} color={color} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15 }}>{valor}{extra && <span style={{ fontSize: 11, fontWeight: 600, color: "#1F8A73", marginLeft: 5 }}>{extra}</span>}</div>
        <div style={{ fontSize: 11, color: "var(--wf-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    </div>
  );
}

// Consola general de WorshipFlow (solo super admin). Un perfil por iglesia con su ACTIVIDAD (cuándo entraron,
// si agregan canciones, gente o eventos, cuándo transmitieron) para que ninguna iglesia fundadora se quede
// sin usar la app — nunca muestra el contenido (letras, setlists, mensajes). Más las acciones de soporte.
export default function PlataformaAdmin({ onExit }) {
  const [cargando, setCargando] = useState(true);
  const [resumen, setResumen] = useState([]);
  const [sinActividad, setSinActividad] = useState(false); // falta correr la migración de la consola
  const [usuariosBasicos, setUsuariosBasicos] = useState([]);
  const [abierta, setAbierta] = useState(null); // id de la iglesia cuyo perfil se está viendo
  const [filtro, setFiltro] = useState("atencion");
  const [busqueda, setBusqueda] = useState("");

  const cargar = () => {
    setCargando(true);
    Promise.all([
      supabase.rpc("resumen_plataforma"),
      supabase.from("iglesias").select("id, nombre, slug, activa, created_at, logo_url").order("created_at"),
      supabase.from("usuarios").select("id, nombre, email, rol, iglesia_id"),
      supabase.rpc("planes_plataforma"),
    ]).then(([res, igl, usr, pla]) => {
      setUsuariosBasicos(ordenarPor(usr.data, (u) => u.nombre));
      // Planes de suscripción (si la migración de planes ya corrió; si no, la consola sigue igual).
      const planes = new Map((pla.error ? [] : pla.data || []).map((p) => [p.iglesia_id, p]));
      const conPlan = (fila) => {
        const p = planes.get(fila.id);
        return p ? { ...fila, plan: p.plan, plan_efectivo: p.plan_efectivo, plan_vence: p.plan_vence, plan_nota: p.plan_nota, en_prueba: p.en_prueba } : fila;
      };
      if (!res.error && Array.isArray(res.data)) {
        setResumen(res.data.map(conPlan));
        setSinActividad(false);
      } else {
        // Sin la migración de la consola: lo básico de siempre (nombre, usuarios, estado).
        setSinActividad(true);
        setResumen((igl.data || []).map((i) => conPlan({ ...i, creada: i.created_at, usuarios: (usr.data || []).filter((u) => u.iglesia_id === i.id).length })));
      }
      setCargando(false);
    });
  };
  useEffect(cargar, []);

  const iglesia = abierta ? resumen.find((r) => r.id === abierta) : null;
  if (iglesia) {
    return <PerfilIglesia r={iglesia} sinActividad={sinActividad} usuariosBasicos={usuariosBasicos.filter((u) => u.iglesia_id === iglesia.id)} onVolver={() => setAbierta(null)} onCambio={cargar} />;
  }

  return (
    <div style={{ padding: 20, maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <button onClick={onExit} style={{ ...ghostBtn, padding: 8 }} aria-label="Salir de la consola"><ArrowLeft size={16} /></button>
        <Shield size={18} color="var(--wf-brand-accent)" />
        <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 600 }}>Consola de iglesias</span>
        <button onClick={cargar} style={{ ...ghostBtn, marginLeft: "auto" }} aria-label="Actualizar"><RefreshCw size={14} /></button>
      </div>
      <div style={{ fontSize: 12, color: "var(--wf-muted)", marginBottom: 16 }}>
        Cómo va cada iglesia: si entran, si agregan canciones, gente y eventos. Solo números y fechas, nunca el contenido.
      </div>

      {cargando ? <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div> : (
        <ListaIglesias resumen={resumen} sinActividad={sinActividad}
          filtro={filtro} setFiltro={setFiltro} busqueda={busqueda} setBusqueda={setBusqueda} onAbrir={setAbierta} />
      )}
    </div>
  );
}

function ListaIglesias({ resumen, sinActividad, filtro, setFiltro, busqueda, setBusqueda, onAbrir }) {
  const ahora = Date.now();
  const conSalud = useMemo(() => resumen.map((r) => ({ r, estado: estadoSalud(r, ahora), alertas: sinActividad ? [] : alertasIglesia(r, ahora) })), [resumen, sinActividad, ahora]);
  const cuenta = (fn) => conSalud.filter(fn).length;
  const necesitan = (x) => x.estado === "dormida" || x.estado === "bajando" || x.alertas.some((a) => a.nivel === "alta");
  const FILTROS = [
    { id: "atencion", label: "Necesitan atención", n: cuenta(necesitan) },
    { id: "todas", label: "Todas", n: conSalud.length },
    { id: "activas", label: "Activas", n: cuenta((x) => x.estado === "activa" || x.estado === "nueva") },
    { id: "pausadas", label: "Pausadas", n: cuenta((x) => x.estado === "pausada") },
  ];
  const q = busqueda.trim().toLowerCase();
  let lista = conSalud.filter((x) => !q || x.r.nombre.toLowerCase().includes(q));
  if (filtro === "atencion") lista = lista.filter(necesitan).sort((a, b) => prioridadAtencion(a.r, ahora) - prioridadAtencion(b.r, ahora));
  else if (filtro === "activas") lista = lista.filter((x) => x.estado === "activa" || x.estado === "nueva");
  else if (filtro === "pausadas") lista = lista.filter((x) => x.estado === "pausada");
  else lista = ordenarPor(lista, (x) => x.r.nombre);

  return (
    <>
      {sinActividad && (
        <div style={{ ...cardStyle, background: "rgba(232,130,30,0.10)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color="#E8821E" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 12.5 }}>Falta correr el SQL de la consola (20261109000000_consola_actividad.sql) para ver la actividad de cada iglesia. Mientras tanto se ve lo básico.</div>
        </div>
      )}

      {/* Panorama */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Iglesias", valor: conSalud.length, color: "#16324F", icon: LayoutGrid },
          { label: "Activas esta semana", valor: cuenta((x) => x.estado === "activa"), color: "#1F8A73", icon: CheckCircle2 },
          { label: "Necesitan atención", valor: cuenta(necesitan), color: "#C23B32", icon: AlertTriangle },
          { label: "En vivo ahora", valor: cuenta((x) => x.r.en_vivo_ahora), color: "#E8821E", icon: Radio },
        ].map((t) => (
          <div key={t.label} style={{ ...cardStyle, marginBottom: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: `${t.color}1A`, display: "flex", alignItems: "center", justifyContent: "center" }}><t.icon size={17} color={t.color} /></div>
            <div><div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{t.valor}</div><div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>{t.label}</div></div>
          </div>
        ))}
      </div>

      <CodigosInvitacion iglesias={resumen} />

      {/* Filtros y búsqueda */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "16px 0 12px" }}>
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id}
            style={{ fontSize: 12.5, fontWeight: 700, padding: "7px 13px", borderRadius: 16, border: "none", cursor: "pointer", fontFamily: "inherit", background: filtro === f.id ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: filtro === f.id ? "var(--wf-on-brand-accent)" : "var(--wf-text)" }}>
            {f.label} <span style={{ opacity: 0.75 }}>{f.n}</span>
          </button>
        ))}
        <div style={{ position: "relative", flex: "1 1 180px", minWidth: 160 }}>
          <Search size={14} color="var(--wf-faint)" style={{ position: "absolute", left: 10, top: 10 }} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar iglesia" aria-label="Buscar iglesia" style={{ ...inputStyle, paddingLeft: 30 }} />
        </div>
      </div>

      {lista.length === 0 && (
        <div style={{ ...cardStyle, textAlign: "center", fontSize: 13, color: "var(--wf-muted)" }}>
          {filtro === "atencion" ? "Todas las iglesias van bien. 🙌" : "No hay iglesias aquí."}
        </div>
      )}

      {lista.map(({ r, estado, alertas }) => (
        <button key={r.id} onClick={() => onAbrir(r.id)} className="hoverable" aria-label={`Ver perfil de ${r.nombre}`}
          style={{ ...cardStyle, width: "100%", textAlign: "left", border: "none", cursor: "pointer", fontFamily: "inherit", color: "var(--wf-text)", display: "block" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Inicial igl={r} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{r.nombre}</span>
                <PildoraSalud estado={estado} />
                {r.en_vivo_ahora && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#C23B32", borderRadius: 10, padding: "2px 8px" }}>EN VIVO</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 2 }}>
                {sinActividad ? `${r.usuarios} usuarios · creada el ${fechaCorta(r.creada)}` : `Última actividad: ${haceCuanto(ultimaActividad(r))} · creada el ${fechaCorta(r.creada)}`}
              </div>
            </div>
            <ChevronRight size={18} color="var(--wf-faint)" />
          </div>
          {!sinActividad && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 12 }}>
              <Dato icon={Users} color="#5661B3" valor={r.usuarios} label={`usuarios · ${r.ingresaron_7d} entraron esta semana`} />
              <Dato icon={Music} color="#1F8A73" valor={r.canciones} label="canciones" extra={r.canciones_nuevas_7d ? `+${r.canciones_nuevas_7d} esta semana` : null} />
              <Dato icon={CalendarDays} color="#2F5FA8" valor={r.eventos_proximos} label={r.proximo_evento ? `próximos · ${fechaEvento(r.proximo_evento.fecha)}` : "eventos próximos"} />
              <Dato icon={Tv} color="#E8821E" valor={haceCuanto(r.ultima_transmision)} label="última transmisión" />
            </div>
          )}
          {alertas.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {alertas.slice(0, 3).map((a) => (
                <span key={a.texto} style={{ fontSize: 11.5, fontWeight: 600, color: COLOR_ALERTA[a.nivel], background: `${COLOR_ALERTA[a.nivel]}14`, borderRadius: 10, padding: "3px 9px" }}>{a.texto}</span>
              ))}
            </div>
          )}
        </button>
      ))}
    </>
  );
}

// Invitaciones para iglesias nuevas: puede haber VARIOS códigos pendientes al mismo tiempo (uno por
// iglesia invitada). Cada uno sirve para una sola iglesia; generar otro ya no anula los anteriores.
function CodigosInvitacion({ iglesias }) {
  const [codigos, setCodigos] = useState(null); // null = cargando
  const [verUsados, setVerUsados] = useState(false);
  const cargar = () => {
    supabase.from("codigos_invitacion").select("codigo, nota, creado_at, vence_at, usado_at, iglesia_id").order("creado_at", { ascending: false })
      .then(({ data, error }) => setCodigos(error ? [] : data || []));
  };
  useEffect(cargar, []);

  const enlaceDe = (codigo) => `${window.location.origin}/?crear-iglesia&codigo=${encodeURIComponent(codigo)}`;
  const copiar = (texto, msg) => navigator.clipboard?.writeText(texto).then(() => showToast(msg, "info")).catch(() => {});
  const nombreIglesia = (id) => iglesias.find((i) => i.id === id)?.nombre;

  const crear = async () => {
    const nota = await promptDialog("¿Para quién es esta invitación? (opcional, ej. «Iglesia Betel — pastor Juan»)", { textoConfirmar: "Crear código" });
    if (nota === null) return;
    const nuevo = generarCodigo();
    const { error } = await supabase.from("codigos_invitacion").insert({ codigo: nuevo, nota: nota.trim() || null });
    if (error) { showToast("No se pudo crear el código: " + error.message, "error"); return; }
    copiar(enlaceDe(nuevo), "Código nuevo listo — enlace copiado.");
    cargar();
  };
  const anular = async (c) => {
    if (!(await confirmDialog(`¿Anular el código ${c.codigo}${c.nota ? ` (${c.nota})` : ""}? Dejará de funcionar.`, { textoConfirmar: "Anular" }))) return;
    const { error } = await supabase.from("codigos_invitacion").delete().eq("codigo", c.codigo).is("usado_at", null);
    if (error) { showToast("No se pudo anular: " + error.message, "error"); return; }
    cargar();
  };

  const ahora = Date.now();
  const vencido = (c) => c.vence_at && new Date(c.vence_at).getTime() < ahora;
  const diasParaVencer = (c) => Math.max(0, Math.ceil((new Date(c.vence_at).getTime() - ahora) / 86400000));
  const pendientes = (codigos || []).filter((c) => !c.usado_at && !vencido(c));
  const usados = (codigos || []).filter((c) => c.usado_at || vencido(c));

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ ...tituloSeccion, marginBottom: 0 }}>Invitar iglesias nuevas</div>
        <button onClick={crear} style={{ ...ghostBtn, marginLeft: "auto", background: "var(--wf-brand-accent)", color: "var(--wf-on-brand-accent)", border: "none" }}><KeyRound size={14} /> Nuevo código</button>
      </div>
      {codigos === null ? <div style={{ fontSize: 12.5, color: "var(--wf-faint)" }}>Cargando…</div> : pendientes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--wf-muted)" }}>No hay códigos pendientes. Crea uno para cada iglesia que quieras invitar.</div>
      ) : pendientes.map((c) => (
        <div key={c.codigo} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: "1px solid var(--wf-border)" }}>
          <div style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, fontWeight: 600 }} aria-label="Código de invitación">{c.codigo}</div>
            <div style={{ fontSize: 11.5, color: "var(--wf-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nota || "Sin nota"} · creado el {fechaCorta(c.creado_at)}{c.vence_at && <> · <span style={{ color: diasParaVencer(c) <= 3 ? "#C23B32" : undefined }}>vence en {diasParaVencer(c)} {diasParaVencer(c) === 1 ? "día" : "días"}</span></>}</div>
          </div>
          <button onClick={() => copiar(enlaceDe(c.codigo), "Enlace de invitación copiado.")} style={ghostBtn}><Link2 size={14} /> Copiar enlace</button>
          <button onClick={() => copiar(c.codigo, "Código copiado.")} style={ghostBtn} aria-label={`Copiar código ${c.codigo}`}><Copy size={14} /></button>
          <button onClick={() => anular(c)} style={dangerBtn} aria-label={`Anular código ${c.codigo}`}><Power size={14} /></button>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: "var(--wf-faint)", marginTop: 6 }}>
        Cada código sirve para <b>una sola iglesia</b>. Puedes tener varios pendientes a la vez: crear uno nuevo no anula los anteriores. Vence a los 30 días si no se usa. El enlace ya lleva el código puesto.
      </div>
      {usados.length > 0 && (
        <>
          <button onClick={() => setVerUsados((v) => !v)} style={{ ...ghostBtn, marginTop: 10 }}>{verUsados ? "Ocultar" : "Ver"} códigos usados o vencidos ({usados.length})</button>
          {verUsados && usados.map((c) => (
            <div key={c.codigo} style={{ fontSize: 12, color: "var(--wf-muted)", padding: "6px 0", borderTop: "1px solid var(--wf-border)" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{c.codigo}</span>{c.nota ? ` · ${c.nota}` : ""} · {c.usado_at ? <>usado el {fechaCorta(c.usado_at)}{nombreIglesia(c.iglesia_id) ? ` por ${nombreIglesia(c.iglesia_id)}` : ""}</> : <>venció el {fechaCorta(c.vence_at)} sin usarse</>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const NOMBRE_PLAN = { gratis: "Gratis", ministerio: "Ministerio · $9.99", crecimiento: "Crecimiento · $19.99", iglesia: "Iglesia · $29.99" };
const DURACIONES = [
  { id: "mes", label: "1 mes", dias: 31 },
  { id: "anio", label: "1 año", dias: 366 },
  { id: "siempre", label: "Sin vencimiento", dias: null },
];

function PlanIglesia({ r, onCambio }) {
  const [plan, setPlan] = useState(r.plan);
  const [duracion, setDuracion] = useState("mes");
  const [nota, setNota] = useState(r.plan_nota || "");
  const [busy, setBusy] = useState(false);
  const vence = r.plan_vence ? new Date(r.plan_vence) : null;
  const vencido = vence && vence.getTime() < Date.now();

  const guardar = async () => {
    const d = DURACIONES.find((x) => x.id === duracion);
    const p_vence = plan === "gratis" || d.dias == null ? null : new Date(Date.now() + d.dias * 86400000).toISOString();
    if (!(await confirmDialog(`¿Poner a "${r.nombre}" en el plan ${NOMBRE_PLAN[plan]}${p_vence ? ` hasta el ${new Date(p_vence).toLocaleDateString()}` : plan === "gratis" ? "" : " sin vencimiento"}?`, { textoConfirmar: "Guardar plan" }))) return;
    setBusy(true);
    const { error } = await supabase.rpc("cambiar_plan_iglesia", { p_iglesia: r.id, p_plan: plan, p_vence, p_nota: nota });
    setBusy(false);
    if (error) { showToast("No se pudo cambiar el plan: " + error.message, "error"); return; }
    showToast("Plan actualizado.", "info");
    onCambio();
  };

  return (
    <div style={{ ...cardStyle, marginTop: 12 }}>
      <div style={tituloSeccion}>Plan</div>
      <div style={{ fontSize: 13, marginBottom: 10 }}>
        Ahora: <b>{NOMBRE_PLAN[r.plan_efectivo || r.plan]}</b>
        {r.en_prueba && !vencido && <span style={{ color: "#E8821E", fontWeight: 700 }}> · en prueba</span>}
        {vence && <span style={{ color: vencido ? "#C23B32" : "var(--wf-muted)" }}> · {vencido ? `venció el ${vence.toLocaleDateString()} (${NOMBRE_PLAN[r.plan]})` : `hasta el ${vence.toLocaleDateString()}`}</span>}
        {!vence && r.plan !== "gratis" && <span style={{ color: "var(--wf-muted)" }}> · sin vencimiento</span>}
        {r.plan_nota && <div style={{ fontSize: 12, color: "var(--wf-muted)", marginTop: 2 }}>Nota: {r.plan_nota}</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {Object.keys(NOMBRE_PLAN).map((p) => (
          <button key={p} onClick={() => setPlan(p)} style={{ ...ghostBtn, background: plan === p ? "#E8821E" : ghostBtn.background, color: plan === p ? "#fff" : ghostBtn.color, border: "none" }}>{NOMBRE_PLAN[p]}</button>
        ))}
      </div>
      {plan !== "gratis" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {DURACIONES.map((d) => (
            <button key={d.id} onClick={() => setDuracion(d.id)} style={{ ...ghostBtn, background: duracion === d.id ? "#16324F" : ghostBtn.background, color: duracion === d.id ? "#fff" : ghostBtn.color, border: "none" }}>{d.label}</button>
          ))}
        </div>
      )}
      <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (ej. pagó por transferencia el 10/11, fundadora)" style={{ ...inputStyle, marginBottom: 8 }} />
      <button disabled={busy} onClick={guardar} style={{ ...ghostBtn, background: "#E8821E", color: "#fff", border: "none", opacity: busy ? 0.5 : 1 }}>Guardar plan</button>
    </div>
  );
}

function PerfilIglesia({ r, sinActividad, usuariosBasicos, onVolver, onCambio }) {
  const [equipo, setEquipo] = useState(null);
  const [busy, setBusy] = useState(false);
  const ahora = Date.now();
  const estado = estadoSalud(r, ahora);
  const alertas = sinActividad ? [] : alertasIglesia(r, ahora);
  const pasos = pasosArranque(r);
  const hechos = pasos.filter((p) => p.hecho).length;

  useEffect(() => {
    let vivo = true;
    supabase.rpc("usuarios_iglesia_plataforma", { p_iglesia: r.id }).then(({ data, error }) => {
      if (!vivo) return;
      setEquipo(error ? usuariosBasicos.map((u) => ({ ...u, ultimo_ingreso: undefined })) : data || []);
    });
    return () => { vivo = false; };
  }, [r.id, usuariosBasicos]);

  const admins = (equipo || []).filter((u) => u.rol === "admin");

  const resetearPassword = async (usuario) => {
    const password = await promptDialog(`Nueva contraseña para ${usuario.nombre} (mínimo 8 caracteres, con letras y números):`, { esPassword: true, textoConfirmar: "Guardar" });
    if (!password) return;
    const err = validarPassword(password);
    if (err) { showToast(err, "error"); return; }
    setBusy(true);
    try {
      await callUsersFunction("reiniciar-password", { id: usuario.id, password });
      showToast(`Contraseña de ${usuario.nombre} actualizada. Pásasela por un medio seguro.`, "info");
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const toggleActiva = async () => {
    const verbo = r.activa ? "Pausar" : "Reactivar";
    if (!(await confirmDialog(`¿${verbo} "${r.nombre}"? ${r.activa ? "No se borra nada: nadie de esa iglesia podrá entrar hasta que la reactives." : ""}`, { textoConfirmar: verbo }))) return;
    setBusy(true);
    const { error } = await supabase.from("iglesias").update({ activa: !r.activa }).eq("id", r.id);
    setBusy(false);
    if (error) { showToast("No se pudo cambiar: " + error.message, "error"); return; }
    showToast(`"${r.nombre}" ${r.activa ? "pausada" : "reactivada"}.`, "info");
    onCambio();
  };

  const forzarCierre = async () => {
    if (!(await confirmDialog(`¿Forzar el cierre de la transmisión en vivo de "${r.nombre}"? Úsalo solo si ellos no pudieron cerrarla.`, { textoConfirmar: "Forzar cierre" }))) return;
    setBusy(true);
    const { error } = await supabase.from("sesiones_en_vivo").update({ evento_id: null, liderado_por: null, slide_actual: null, blanked: false, ad_hoc_label: null, libre: false }).eq("iglesia_id", r.id);
    setBusy(false);
    if (error) { showToast("No se pudo cerrar: " + error.message, "error"); return; }
    showToast("Transmisión cerrada.", "info");
    onCambio();
  };

  const cambiarTope = async () => {
    const v = await promptDialog(`Mensajes al día del asistente para "${r.nombre}" (ahora: ${r.limite_asistente ?? 30}):`, { textoConfirmar: "Guardar", valorInicial: String(r.limite_asistente ?? 30) });
    if (v == null || v === "") return;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 1000) { showToast("Escribe un número entre 0 y 1000.", "error"); return; }
    const { error } = await supabase.rpc("cambiar_limite_asistente", { p_iglesia: r.id, p_limite: n });
    if (error) { showToast("No se pudo cambiar: " + error.message, "error"); return; }
    showToast("Tope del asistente actualizado.", "info");
    onCambio();
  };

  const correoAdmins = admins.map((a) => a.email).filter(Boolean).join(",");

  return (
    <div style={{ padding: 20, maxWidth: 960, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <button onClick={onVolver} style={{ ...ghostBtn, marginBottom: 14 }}><ArrowLeft size={15} /> Todas las iglesias</button>

      {/* Encabezado */}
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Inicial igl={r} size={56} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600 }}>{r.nombre}</span>
            <PildoraSalud estado={estado} />
            {r.en_vivo_ahora && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#fff", background: "#C23B32", borderRadius: 10, padding: "2px 8px" }}>EN VIVO AHORA</span>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--wf-muted)", marginTop: 3 }}>
            Fundada en la app el {fechaCorta(r.creada)}{!sinActividad && ` · última actividad ${haceCuanto(ultimaActividad(r))}`}
          </div>
        </div>
        {correoAdmins && <a href={`mailto:${correoAdmins}?subject=${encodeURIComponent(`WorshipFlow · ${r.nombre}`)}`} style={{ ...ghostBtn, textDecoration: "none" }}><Mail size={14} /> Escribirle</a>}
      </div>

      {alertas.length > 0 && (
        <div style={cardStyle}>
          <div style={tituloSeccion}>Para darle seguimiento</div>
          {alertas.map((a) => (
            <div key={a.texto} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0" }}>
              <AlertTriangle size={14} color={COLOR_ALERTA[a.nivel]} style={{ flexShrink: 0 }} /> {a.texto}
            </div>
          ))}
        </div>
      )}

      {!sinActividad && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {/* Arranque de iglesia fundadora */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={{ ...tituloSeccion, display: "flex", justifyContent: "space-between" }}><span>Primeros pasos</span><span style={{ color: hechos === pasos.length ? "#1F8A73" : "var(--wf-muted)" }}>{hechos} de {pasos.length}</span></div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--wf-hover)", marginBottom: 10, overflow: "hidden" }}><div style={{ width: `${(hechos / pasos.length) * 100}%`, height: "100%", background: "#1F8A73" }} /></div>
            {pasos.map((p) => (
              <div key={p.clave} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0" }}>
                {p.hecho ? <CheckCircle2 size={16} color="#1F8A73" /> : <Circle size={16} color="var(--wf-faint)" />}
                <span style={{ flex: 1, color: p.hecho ? "var(--wf-text)" : "var(--wf-muted)" }}>{p.label}</span>
                <span style={{ fontSize: 11.5, color: "var(--wf-faint)" }}>{p.detalle}</span>
              </div>
            ))}
          </div>

          {/* Actividad */}
          <div style={{ ...cardStyle, marginBottom: 0 }}>
            <div style={tituloSeccion}>Actividad</div>
            {[
              ["Último ingreso", haceCuanto(r.ultimo_ingreso)],
              ["Última canción propia agregada", haceCuanto(r.ultima_cancion)],
              ["Último evento creado", haceCuanto(r.ultimo_evento_creado)],
              ["Último culto (fecha)", r.ultimo_evento ? fechaEvento(r.ultimo_evento) : "—"],
              ["Próximo evento", r.proximo_evento ? `${r.proximo_evento.titulo} · ${fechaEvento(r.proximo_evento.fecha)}` : "ninguno"],
              ["Última transmisión en vivo", haceCuanto(r.ultima_transmision)],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, padding: "5px 0", borderBottom: "1px solid var(--wf-border)" }}>
                <span style={{ color: "var(--wf-muted)" }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!sinActividad && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <div style={tituloSeccion}>Números</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <Dato icon={Users} color="#5661B3" valor={r.usuarios} label="personas en el equipo" extra={r.usuarios_nuevos_30d ? `+${r.usuarios_nuevos_30d} este mes` : null} />
            <Dato icon={Users} color="#8996A6" valor={r.ingresaron_7d} label="entraron esta semana" />
            <Dato icon={Music} color="#1F8A73" valor={r.canciones} label={`canciones (${r.canciones_propias ?? 0} propias)`} extra={r.canciones_nuevas_30d ? `+${r.canciones_nuevas_30d} este mes` : null} />
            <Dato icon={CalendarDays} color="#2F5FA8" valor={r.eventos} label={`eventos · ${r.eventos_proximos} próximos`} extra={r.eventos_creados_30d ? `+${r.eventos_creados_30d} este mes` : null} />
            <Dato icon={LayoutGrid} color="#B15EA0" valor={r.ministerios} label={`grupos · ${r.plantillas} plantillas`} />
            <Dato icon={Tv} color="#E8821E" valor={r.transmisiones_30d} label="transmisiones este mes" />
            <Dato icon={Sparkles} color="#F6A623" valor={r.bosquejos_30d} label="bosquejos enviados este mes" />
            <Dato icon={Bot} color="#16324F" valor={r.asistente_30d} label={`mensajes al asistente (tope ${r.limite_asistente ?? 30}/día)`} />
          </div>
        </div>
      )}

      {/* Equipo */}
      <div style={{ ...cardStyle, marginTop: 12 }}>
        <div style={tituloSeccion}>Equipo ({equipo ? equipo.length : "…"})</div>
        {!equipo ? <div style={{ fontSize: 13, color: "var(--wf-faint)" }}>Cargando…</div> : equipo.length === 0 ? <div style={{ fontSize: 13, color: "var(--wf-muted)" }}>Sin usuarios.</div> : equipo.map((u) => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--wf-border)", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{u.nombre} {u.rol === "admin" && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#E8821E", marginLeft: 4 }}>ADMIN</span>}</div>
              <div style={{ fontSize: 11.5, color: "var(--wf-muted)" }}>{u.email}{u.ultimo_ingreso !== undefined && ` · entró ${haceCuanto(u.ultimo_ingreso)}`}</div>
            </div>
            <button disabled={busy} onClick={() => resetearPassword(u)} style={{ ...ghostBtn, opacity: busy ? 0.5 : 1 }}><KeyRound size={13} /> Nueva contraseña</button>
          </div>
        ))}
      </div>

      {/* Plan de suscripción: se activa a mano (transferencias, fundadoras, regalos) hasta conectar la pasarela. */}
      {r.plan && <PlanIglesia r={r} onCambio={onCambio} />}

      {/* Soporte */}
      <div style={{ ...cardStyle, marginTop: 12 }}>
        <div style={tituloSeccion}>Soporte</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!sinActividad && <button disabled={busy} onClick={cambiarTope} style={ghostBtn}><Bot size={13} /> Tope del asistente: {r.limite_asistente ?? 30}/día</button>}
          <button disabled={busy} onClick={forzarCierre} style={ghostBtn}><Radio size={13} /> Forzar cierre de transmisión</button>
          <button disabled={busy} onClick={toggleActiva} style={r.activa ? dangerBtn : ghostBtn}><Power size={13} /> {r.activa ? "Pausar iglesia" : "Reactivar iglesia"}</button>
        </div>
      </div>
    </div>
  );
}
