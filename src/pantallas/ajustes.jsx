// Ajustes: perfil, iglesia, miembros, pantallas y TV, apariencia y ayuda. Separada de PrototipoWorshipFlow.jsx el 2026-11-02 sin cambiar el código.
import ConPlan from "../components/ConPlan.jsx";
import { useState, useEffect, useMemo } from "react";
import { getInstallState, subscribeInstallState, promptInstall, isIosSafari } from "../lib/pwaInstall.js";
import { showToast, notifyError } from "../lib/toast.js";
import { getTema, setTema } from "../lib/theme.js";
import { supabase } from "../lib/supabaseClient.js";
import { confirmDialog } from "../lib/confirm.js";
import { estaSuscritoPush, suscribirPush, desuscribirPush, esRechazoDeNotificaciones } from "../lib/notificaciones.js";
import { isUpcoming, formatFullDate } from "../lib/dates.js";
import { usePreferencias, TAMANOS_LETRA, setTamanoLetra, NOTACIONES, setNotacion, acordeEn } from "../lib/preferencias.js";
import { ChevronRight, ChevronLeft, KeyRound, Check, Calendar, Bell, Moon, Type, Music, Download, Radio, Tv, Users, Palette, Shield, Sparkles, MessageCircle, Send, LogOut, Speaker, Clock, Crown } from "lucide-react";
import PantallaOtroEquipo from "../components/PantallaOtroEquipo.jsx";
import { SalidaAudioModal, useSalidaAudioActual } from "../components/SalidaAudioVideos.jsx";
import { BibleDownloadSection } from "./biblia.jsx";
import { IdentidadIglesiaModal, PantallaProyeccionModal, ChangePasswordModal, ZonaHorariaModal } from "./ventanas.jsx";
import { etiquetaZona } from "../lib/zonasHorarias.js";
import { inputStyle, ModalShell } from "./compartido.jsx";
import { CORREO_SOPORTE, WHATSAPP_SOPORTE } from "../lib/soporte.js";
import { usePlan, planPorId, diasRestantes, abrirPlanes } from "../lib/planes.js";

function NavRow({ icon: Icon, label, onClick, right, danger }) {
  // Si no hay onClick propio de la fila (ej. cuando "right" ya es interactivo, como un ToggleSwitch),
  // usamos un <div> en vez de <button> — un <button> no puede contener otro <button> (HTML inválido).
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "14px 16px", marginBottom: 8, cursor: onClick ? "pointer" : "default", boxSizing: "border-box" }}>
      <Icon size={18} color={danger ? "#C23B32" : "var(--wf-text-2)"} />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: danger ? "#C23B32" : "var(--wf-text)" }}>{label}</span>
      {right}
    </Tag>
  );
}

function SectionLabel({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-muted)", letterSpacing: 0.5, margin: "18px 0 8px" }}>{children}</div>;
}

function GrupoAjustes({ titulo, nota, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0 4px", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--wf-muted)" }}>{titulo}</span>
        {nota && <span style={{ fontSize: 11, color: "var(--wf-faint)" }}>{nota}</span>}
      </div>
      <div style={{ background: "var(--wf-card)", borderRadius: 18, boxShadow: "0 1px 3px rgba(22,50,79,0.08)", overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// Fila de la portada de Ajustes: ícono en cuadrito de color, título, resumen y flecha. Las filas van
// separadas por una línea fina (regla .fila-ajuste + .fila-ajuste en index.css).
function FilaAjuste({ icon: Icon, color, label, sub, onClick }) {
  return (
    <button onClick={onClick} className="hoverable fila-ajuste" style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 60, textAlign: "left", background: "transparent", border: "none", padding: "12px 14px", cursor: "pointer", color: "var(--wf-text)", fontFamily: "inherit" }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: color + "1F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={18} color={color} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 12, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>}
      </span>
      <ChevronRight size={16} color="var(--wf-faint)" style={{ flexShrink: 0 }} />
    </button>
  );
}

function useInstallState() {
  const [state, setState] = useState(getInstallState);
  useEffect(() => subscribeInstallState(() => setState(getInstallState())), []);
  return state;
}

export function SettingsView({ realIsAdmin, myRole, roleOverride, setRoleOverride, myName, nameOverride, setNameOverride, usuariosReales, perfil, events, onSelectEvent, onGoToUsuarios, onGoToRoles, onGoToPlataforma, userId, myIglesiaId, teamName, isCompact, onVerTutorial }) {
  const [showTeamList, setShowTeamList] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showIdentidad, setShowIdentidad] = useState(false);
  const [showPantalla, setShowPantalla] = useState(false);
  const [showSalidaAudio, setShowSalidaAudio] = useState(false);
  const [showZona, setShowZona] = useState(false);
  const [zonaIglesia, setZonaIglesia] = useState(perfil?.iglesias?.zona_horaria || null);
  useEffect(() => { if (perfil?.iglesias?.zona_horaria) setZonaIglesia(perfil.iglesias.zona_horaria); }, [perfil?.iglesias?.zona_horaria]);
  const salidaAudio = useSalidaAudioActual();
  const [showOtroEquipoAjustes, setShowOtroEquipoAjustes] = useState(false); // false · "proyeccion" · "escenario"
  const [pushEstado, setPushEstado] = useState("cargando"); // cargando | activo | inactivo | bloqueado | sin-soporte
  const [pushBusy, setPushBusy] = useState(false);
  const [screensBusy, setScreensBusy] = useState(false);
  const activarDeteccionPantallas = async () => {
    setScreensBusy(true);
    try {
      await window.getScreenDetails();
      showToast("Listo — con el proyector/monitor conectado, \"Iniciar evento\" debería abrir la proyección sola en pantalla completa ahí.", "info");
    } catch {
      showToast("No se concedió el permiso. Intenta de nuevo y acepta el permiso de \"administrar ventanas en varias pantallas\" que pida el navegador.");
    } finally {
      setScreensBusy(false);
    }
  };
  // Modo oscuro del chrome — de este dispositivo nada más (ver lib/theme.js), NO afecta a Proyección.
  // Por defecto la app se queda clara; "Automático" sigue el tema del celular/computadora.
  const [tema, setTemaState] = useState(getTema());
  const cambiarTema = (t) => { setTema(t); setTemaState(t); };
  const install = useInstallState();
  // "Continuar con Google" en Ajustes: vincula/desvincula Google como método alterno de inicio de
  // sesión para ESTA cuenta ya invitada — no reemplaza la invitación, solo evita tener que escribir la
  // contraseña la próxima vez. Ver AuthGate.jsx para el resguardo de que nadie sin invitación entre así.
  const [googleLinked, setGoogleLinked] = useState(null); // null: cargando · true/false
  const [googleBusy, setGoogleBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getUserIdentities()
      .then(({ data }) => setGoogleLinked(!!data?.identities?.some((i) => i.provider === "google")))
      .catch(() => setGoogleLinked(false));
  }, []);
  const vincularGoogle = async () => {
    setGoogleBusy(true);
    const { error } = await supabase.auth.linkIdentity({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { notifyError("No se pudo vincular Google", error); setGoogleBusy(false); }
    // si no hay error, el navegador redirige a Google — vuelve solo a esta pantalla ya vinculada
  };
  const desvincularGoogle = async () => {
    if (!(await confirmDialog("¿Dejar de poder entrar con Google? Vas a seguir pudiendo entrar con tu correo y contraseña.", { textoConfirmar: "Desvincular" }))) return;
    setGoogleBusy(true);
    try {
      const { data } = await supabase.auth.getUserIdentities();
      const identidad = data?.identities?.find((i) => i.provider === "google");
      if (identidad) { await supabase.auth.unlinkIdentity(identidad); setGoogleLinked(false); }
    } catch (e) {
      notifyError("No se pudo desvincular", e);
    } finally {
      setGoogleBusy(false);
    }
  };
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushEstado("sin-soporte");
      return;
    }
    const bloqueado = () => (typeof Notification !== "undefined" && Notification.permission === "denied" ? "bloqueado" : "inactivo");
    estaSuscritoPush().then((si) => setPushEstado(si ? "activo" : bloqueado())).catch(() => setPushEstado(bloqueado()));
  }, []);
  const activarPush = async () => {
    setPushBusy(true);
    try {
      await suscribirPush(userId);
      setPushEstado("activo");
    } catch (e) {
      // No dar permiso no es una falla: se explica cómo desbloquearlo (sin "inténtalo de nuevo" ni alerta).
      if (esRechazoDeNotificaciones(e)) setPushEstado(e.codigo === "sin-soporte" ? "sin-soporte" : "bloqueado");
      else notifyError("No se pudo activar las notificaciones push", e);
    } finally {
      setPushBusy(false);
    }
  };
  const desactivarPush = async () => {
    setPushBusy(true);
    try {
      await desuscribirPush();
      setPushEstado("inactivo");
    } catch (e) {
      notifyError("No se pudo desactivar las notificaciones push", e);
    } finally {
      setPushBusy(false);
    }
  };
  const ROLE_OPTIONS = ["Administrador", "Multimedia", "Músico", "Miembro", "Supervisor"];
  const initials = (myName || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const misEventos = useMemo(
    () => events.filter((e) => !e.esPlantilla && isUpcoming(e) && (
      e.serviceOrder.some((item) => (item.encargados || []).some((m) => m.n === myName)) ||
      (e.worshipRoles || []).some((r) => (r.members || []).some((m) => m.n === myName))
    )),
    [events, myName]
  );
  // Reorganizado (pedido de Eldin, 2026-10-09): agrupado por lo que la persona busca — su cuenta
  // arriba, lo suyo, cómo se ve, este aparato, la iglesia (admins), ayuda. Lo de pruebas de
  // administrador queda guardado en "Opciones avanzadas" para que nadie lo toque sin querer.
  const { tamanoLetra, notacion } = usePreferencias();
  const plan = usePlan();
  const [seccion, setSeccion] = useState(null); // null = portada · "cuenta" · "apariencia" · …
  const chevron = <ChevronRight size={16} color="var(--wf-faint)" />;
  const tarjeta = { background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 14, padding: "12px 16px", marginBottom: 8 };
  const opcion = (activa) => ({ flex: 1, fontSize: 12.5, fontWeight: 700, padding: "9px 6px", borderRadius: 12, border: "none", cursor: "pointer", background: activa ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: activa ? "var(--wf-brand-primary)" : "var(--wf-text)" });
  const subtitulo = (icono, texto) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      {icono}
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--wf-text)" }}>{texto}</span>
    </div>
  );

  const signOut = async () => {
    if (!(await confirmDialog("¿Cerrar sesión?", { textoConfirmar: "Cerrar sesión" }))) return;
    supabase.auth.signOut();
  };

  // Ventanas: se dibujan igual que antes, estén donde estén (portada o sub-pantalla).
  const modales = (
    <>
      {showOtroEquipoAjustes && <PantallaOtroEquipo tipo={showOtroEquipoAjustes} iglesiaId={myIglesiaId} onCerrar={() => setShowOtroEquipoAjustes(false)} />}
      {showIdentidad && <ConPlan funcion="identidad" onCerrar={() => setShowIdentidad(false)}><IdentidadIglesiaModal iglesiaId={myIglesiaId} onClose={() => setShowIdentidad(false)} /></ConPlan>}
      {showZona && <ZonaHorariaModal iglesiaId={myIglesiaId} actual={zonaIglesia} onClose={() => setShowZona(false)} onGuardada={setZonaIglesia} />}
      {showPantalla && <PantallaProyeccionModal iglesiaId={myIglesiaId} onClose={() => setShowPantalla(false)} />}
      {showTeamList && (
        <ModalShell title={teamName} icon={Users} color="#6E63C7" onClose={() => setShowTeamList(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: "60vh", overflowY: "auto" }}>
            {usuariosReales.map((u) => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid var(--wf-hover)" }}>
                {u.foto_url ? (
                  <img src={u.foto_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#6E63C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                    {u.nombre.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{u.nombre}</span>
                {u.rol === "admin" && <span style={{ fontSize: 10, fontWeight: 700, color: "#2F5FA8", background: "#E8F1FB", border: "1px solid #2F5FA8", borderRadius: 16, padding: "2px 8px" }}>ADMIN</span>}
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {showSalidaAudio && <SalidaAudioModal onClose={() => setShowSalidaAudio(false)} />}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </>
  );

  // Ajustes con "menú por categorías" (rediseño, idea A — 2026-11-11): la portada es corta y cada
  // categoría abre su propia pantalla con EXACTAMENTE los mismos controles de antes. No cambia ninguna
  // función: solo dónde se encuentra cada cosa.
  const estadoAvisos = { "sin-soporte": "No disponibles en este navegador", activo: "Activados", inactivo: "Desactivados", bloqueado: "Bloqueados en este navegador", cargando: "" }[pushEstado] || "";
  const nombreTema = { claro: "Claro", oscuro: "Oscuro", auto: "Automático" }[tema] || "";
  const nombreTamano = (TAMANOS_LETRA.find((t) => t.value === tamanoLetra) || {}).label || "";
  const nombreNotacion = ((NOTACIONES.find((n) => n.value === notacion) || {}).label || "").replace(/\s+/g, " ");
  const textoPlan = plan ? (plan.en_prueba ? `${planPorId(plan.plan).nombre} · Prueba, ${diasRestantes(plan.vence)} días` : planPorId(plan.plan).nombre) : "";
  const TITULOS = { cuenta: "Mi cuenta", fechas: "Mis próximas fechas", avisos: "Notificaciones", apariencia: "Apariencia", dispositivo: "Este dispositivo", proyeccion: "Proyección y pantallas", identidad: "Identidad y horario", ayuda: "Ayuda y contacto", avanzado: "Avanzado" };

  if (seccion) {
    return (
      <div className="screen-enter" style={{ padding: 20, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <button onClick={() => setSeccion(null)} style={{ display: "inline-flex", alignItems: "center", gap: 2, background: "none", border: "none", padding: "10px 0", minHeight: 44, cursor: "pointer", fontSize: 15, fontWeight: 600, color: "#2F5FA8", fontFamily: "inherit" }}>
          <ChevronLeft size={20} /> Volver a Ajustes
        </button>
        <h2 style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.03em", fontSize: 28, fontWeight: 700, color: "var(--wf-heading)", margin: "4px 0 18px" }}>{TITULOS[seccion]}</h2>
        {seccion === "apariencia" && <div style={{ fontSize: 13.5, color: "var(--wf-muted)", margin: "-10px 0 16px" }}>Solo cambia cómo ves la app en este dispositivo. La proyección no se afecta.</div>}

        {seccion === "cuenta" && (
          <>
          {(
            <div style={{ marginBottom: 6 }}>
              <NavRow icon={KeyRound} label="Cambiar contraseña" onClick={() => setShowChangePassword(true)} right={chevron} />
              {googleLinked === true ? (
                <NavRow
                  icon={Check} label="Puedes entrar con Google"
                  right={googleBusy ? null : <span onClick={(e) => { e.stopPropagation(); desvincularGoogle(); }} style={{ fontSize: 11, color: "var(--wf-faint)", fontWeight: 600, cursor: "pointer" }}>Desvincular</span>}
                />
              ) : googleLinked === false ? (
                <NavRow icon={KeyRound} label="Entrar con Google" onClick={googleBusy ? undefined : vincularGoogle} right={googleBusy ? null : chevron} />
              ) : null}
            </div>
          )}

          </>
        )}
        {seccion === "fechas" && (
          <>
          {(
            misEventos.length ? (
              <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {misEventos.map((e) => (
                  <button key={e.id} onClick={() => onSelectEvent(e.id)} className="hoverable" style={{ textAlign: "left", background: "var(--wf-card)", border: "none", boxShadow: "0 2px 10px rgba(22,50,79,0.07)", borderRadius: 14, padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{e.title}</div>
                      <div style={{ fontSize: 11, color: "var(--wf-faint)" }}>{formatFullDate(e.date) || e.dateLabel}</div>
                    </div>
                    <ChevronRight size={14} color="var(--wf-faint)" />
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--wf-faint)", marginBottom: 8, padding: "0 4px" }}>No tienes nada asignado en los próximos eventos.</div>
            )
          )}

          </>
        )}
        {seccion === "avisos" && (
          <>
          {pushEstado === "sin-soporte" ? (
            <NavRow icon={Bell} label="Avisos no disponibles en este navegador" right={null} />
          ) : pushEstado === "activo" ? (
            // A propósito sin un botón de un solo toque para desactivar — solo un enlace chico que primero
            // confirma con una advertencia, para que nadie las apague sin querer o sin pensarlo.
            <NavRow
              icon={Bell}
              label="Avisos al celular activados"
              right={pushBusy ? null : (
                <span
                  onClick={async (e) => { e.stopPropagation(); if (await confirmDialog("¿Seguro que quieres desactivar los avisos? Podrías perderte avisos de tus asignaciones y recordatorios de eventos.", { danger: true, textoConfirmar: "Desactivar" })) desactivarPush(); }}
                  style={{ fontSize: 11, color: "var(--wf-faint)", fontWeight: 600, cursor: "pointer" }}
                >
                  Desactivar
                </span>
              )}
            />
          ) : pushEstado === "inactivo" ? (
            <NavRow icon={Bell} label="Activar avisos al celular" onClick={activarPush} right={pushBusy ? null : chevron} />
          ) : pushEstado === "bloqueado" ? (
            <div style={{ ...tarjeta, display: "flex", gap: 10, alignItems: "flex-start" }}>
              <Bell size={18} color="var(--wf-brand-accent)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12.5, color: "var(--wf-text-2)", lineHeight: 1.5 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--wf-text)", marginBottom: 2 }}>Tus avisos están bloqueados en este navegador</div>
                Para recibirlos, permite las notificaciones y vuelve a abrir la app:
                <br />• <b>Computadora (Chrome o Edge):</b> clic en el ícono junto a la dirección → Notificaciones → Permitir.
                <br />• <b>Android (Chrome):</b> toca el candado junto a la dirección → Permisos → Notificaciones → Permitir.
                <br />• <b>iPhone con la app instalada:</b> Ajustes del iPhone → WorshipFlow → Notificaciones → Activar.
              </div>
            </div>
          ) : null}

          </>
        )}
        {seccion === "apariencia" && (
          <>
          <div style={tarjeta}>
            {subtitulo(<Moon size={18} color="var(--wf-text-2)" />, "Modo de color")}
            <div style={{ display: "flex", gap: 6 }}>
              {[["claro", "Claro"], ["oscuro", "Oscuro"], ["auto", "Automático"]].map(([val, label]) => (
                <button key={val} onClick={() => cambiarTema(val)} style={opcion(tema === val)}>{label}</button>
              ))}
            </div>
          </div>
          <div style={tarjeta}>
            {subtitulo(<Type size={18} color="var(--wf-text-2)" />, "Tamaño de letra")}
            <div style={{ display: "flex", gap: 6 }}>
              {TAMANOS_LETRA.map((t, i) => (
                <button key={t.value} onClick={() => setTamanoLetra(t.value)} aria-pressed={tamanoLetra === t.value} style={{ ...opcion(tamanoLetra === t.value), display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 14 + i * 4, lineHeight: 1.1 }}>Aa</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--wf-muted)", marginTop: 8 }}>Solo en este dispositivo. No cambia la pantalla de proyección.</div>
          </div>
          <div style={tarjeta}>
            {subtitulo(<Music size={18} color="var(--wf-text-2)" />, "Cómo ver los tonos y acordes")}
            <div style={{ display: "flex", gap: 6 }}>
              {NOTACIONES.map((n) => (
                <button key={n.value} onClick={() => setNotacion(n.value)} aria-pressed={notacion === n.value} style={{ ...opcion(notacion === n.value), fontFamily: "'JetBrains Mono', monospace" }}>{n.label}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--wf-muted)", marginTop: 8 }}>
              Ejemplo: <b style={{ fontFamily: "'JetBrains Mono', monospace", color: "#1F8A73" }}>{acordeEn("G", notacion)} · {acordeEn("Em", notacion)} · {acordeEn("D/F#", notacion)}</b> — solo cambia lo que tú ves.
            </div>
          </div>

          </>
        )}
        {seccion === "dispositivo" && (
          <>
          {install.installed ? (
            <NavRow icon={Check} label="La app ya está instalada" right={null} />
          ) : install.canInstall ? (
            <NavRow icon={Download} label="Instalar la app" onClick={() => promptInstall()} right={chevron} />
          ) : isIosSafari() ? (
            <NavRow icon={Download} label="Compartir → Agregar a inicio para instalar" right={null} />
          ) : (
            <NavRow icon={Download} label="Instalar la app" right={<span style={{ fontSize: 11, color: "var(--wf-faint)" }}>Desde el menú del navegador</span>} />
          )}
          {/* El navegador pide permiso para "administrar ventanas en varias pantallas" la primera vez que
              se usa getScreenDetails() -- si esa primera vez coincide con el clic de "Iniciar evento", para
              cuando la persona responde ya se perdió el "gesto de usuario" y la pantalla completa automática
              en el segundo monitor falla en silencio. Pidiéndolo acá, una sola vez, Chrome lo recuerda.
              Solo en computadora: un teléfono no maneja "otra pantalla" por HDMI. */}
          {!isCompact && typeof window !== "undefined" && "getScreenDetails" in window && (
            <>
              <NavRow
                icon={Radio}
                label={screensBusy ? "Pidiendo permiso…" : "Activar detección automática de pantalla"}
                onClick={screensBusy ? undefined : activarDeteccionPantallas}
                right={screensBusy ? null : chevron}
              />
              <div style={{ fontSize: 11, color: "var(--wf-faint)", margin: "-4px 4px 10px" }}>
                Hazlo una vez, con el proyector/monitor ya conectado — así "Iniciar evento" abre la proyección en pantalla completa ahí solo.
              </div>
            </>
          )}
          {/* Salida de audio de los videos (2026-11-08): imagen al proyector, sonido a la consola/mixer.
              Solo en computadora: es la que proyecta. */}
          {!isCompact && (
            <>
              <NavRow
                icon={Speaker}
                label="Salida de audio de los videos"
                onClick={() => setShowSalidaAudio(true)}
                right={<span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--wf-faint)", maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{salidaAudio ? salidaAudio.label || "Elegida" : "Predeterminada"} {chevron}</span>}
              />
              <div style={{ fontSize: 11, color: "var(--wf-faint)", margin: "-4px 4px 10px" }}>
                Para mandar el sonido del video a la consola o mixer mientras la imagen va al proyector.
              </div>
                </>
          )}
          {/* Solo tiene sentido en la computadora que proyecta. */}
          {!isCompact && <BibleDownloadSection />}

          </>
        )}
        {seccion === "proyeccion" && (
          <>
          <NavRow icon={Tv} label="Pantallas y TV" onClick={() => setShowOtroEquipoAjustes("proyeccion")} right={<span style={{ fontSize: 11, color: "var(--wf-faint)", display: "flex", alignItems: "center", gap: 4 }}>Proyección · Escenario {chevron}</span>} />

            {realIsAdmin && (
              <>
              <NavRow icon={Radio} label="Ajustes de la proyección" onClick={() => setShowPantalla(true)} right={<span style={{ fontSize: 11, color: "var(--wf-faint)", display: "flex", alignItems: "center", gap: 4 }}>Letra y versículos {chevron}</span>} />

              </>
            )}
          </>
        )}
        {seccion === "identidad" && realIsAdmin && (
          <>
              <NavRow icon={Palette} label="Identidad de la iglesia" onClick={() => setShowIdentidad(true)} right={chevron} />
              <NavRow icon={Clock} label="Zona horaria" onClick={() => setShowZona(true)} right={<span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--wf-faint)", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{zonaIglesia ? etiquetaZona(zonaIglesia) : ""} {chevron}</span>} />

          </>
        )}
        {seccion === "ayuda" && (
          <>
          {onVerTutorial && <NavRow icon={Sparkles} label="Ver el tutorial de nuevo" onClick={onVerTutorial} right={chevron} />}
          <NavRow icon={MessageCircle} label="Escríbenos por WhatsApp" onClick={() => { window.open(`https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent(`Hola, te escribo de ${teamName || "mi iglesia"} sobre WorshipFlow: `)}`, "_blank", "noopener"); }} right={<span style={{ fontSize: 11, color: "var(--wf-faint)" }}>Dudas o ideas</span>} />
          <NavRow icon={Send} label="Escríbenos por correo" onClick={() => { window.location.href = `mailto:${CORREO_SOPORTE}?subject=${encodeURIComponent("WorshipFlow — " + (teamName || "mi iglesia"))}`; }} right={<span style={{ fontSize: 11, color: "var(--wf-faint)" }}>{CORREO_SOPORTE}</span>} />

          </>
        )}
        {seccion === "avanzado" && realIsAdmin && (
          <>
              {/* Visible solo si soy_super_admin() dio true para esta cuenta (ver AuthGate.jsx). */}
              {onGoToPlataforma && <NavRow icon={Shield} label="Consola general" onClick={onGoToPlataforma} right={chevron} />}
              <SectionLabel>VER LA APP COMO OTRA PERSONA</SectionLabel>
              {(
            <div style={{ background: "var(--wf-card)", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 16, padding: 14, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text-2)", marginBottom: 6 }}>Elige a quién</div>
              <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 8 }}>Para revisar que cada quien vea solo lo que le corresponde.</div>
              <select value={nameOverride || ""} onChange={(e) => setNameOverride(e.target.value || null)} style={{ ...inputStyle, marginBottom: 14 }}>
                <option value="">Yo mismo</option>
                {usuariosReales.map((u) => <option key={u.nombre} value={u.nombre}>{u.nombre}{u.rol === "admin" ? " (administrador)" : ""}</option>)}
              </select>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wf-text-2)", marginBottom: 6 }}>Probar la app con otro rol</div>
              <div style={{ fontSize: 11.5, color: "var(--wf-muted)", marginBottom: 8 }}>Solo en este dispositivo. Solo Administrador y Multimedia pueden controlar la transmisión en vivo.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {ROLE_OPTIONS.map((r) => (
                  <button key={r} onClick={() => setRoleOverride(r === myRole && roleOverride ? null : r)} style={{ fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 20, border: "none", cursor: "pointer", background: myRole === r ? "var(--wf-brand-accent)" : "var(--wf-hover)", color: myRole === r ? "var(--wf-brand-primary)" : "var(--wf-text)" }}>{r}</button>
                ))}
              </div>
            </div>
              )}

          </>
        )}
        {modales}
      </div>
    );
  }

  return (
    <div className="screen-enter" style={{ padding: 20, maxWidth: 640, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <h2 style={{ fontFamily: "var(--wf-font-titulo)", letterSpacing: "-0.03em", fontSize: 28, fontWeight: 700, color: "var(--wf-heading)", margin: "4px 0 18px" }}>Ajustes</h2>

      {/* Perfil: abre "Mi cuenta" (contraseña y Google). */}
      <button onClick={() => setSeccion("cuenta")} className="hoverable" style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left", background: "var(--wf-card)", border: "none", boxShadow: "0 1px 3px rgba(22,50,79,0.08)", borderRadius: 18, padding: 16, cursor: "pointer", marginBottom: 12, color: "var(--wf-text)", fontFamily: "inherit" }}>
        {perfil?.foto_url ? (
          <img src={perfil.foto_url} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--wf-brand-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, flexShrink: 0, color: "var(--wf-on-brand-primary)" }}>{initials}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{myName || "Sin nombre"}</div>
          {perfil?.email && <div style={{ fontSize: 13, color: "var(--wf-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{perfil.email}</div>}
          <span style={{ display: "inline-block", marginTop: 6, background: "var(--wf-hover)", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 600, color: "var(--wf-text-2)" }}>{myRole}</span>
        </div>
        <span style={{ fontSize: 12, color: "var(--wf-faint)", display: "flex", alignItems: "center", gap: 2 }}>Mi cuenta {chevron}</span>
      </button>

      {realIsAdmin && plan && (plan.en_prueba || plan.vencido) && (
        <button onClick={abrirPlanes} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "var(--wf-active-bg)", border: "none", borderRadius: 16, padding: "14px 16px", cursor: "pointer", marginBottom: 12, fontFamily: "inherit" }}>
          <Crown size={20} color="var(--wf-active-text)" style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: "var(--wf-active-text)" }}>{plan.vencido ? "Tu plan venció" : `Plan ${planPorId(plan.plan).nombre} · Prueba`}</span>
            {plan.en_prueba && <span style={{ display: "block", fontSize: 12, color: "var(--wf-active-text)" }}>Te quedan {diasRestantes(plan.vence)} días</span>}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--wf-active-text)" }}>Ver planes</span>
        </button>
      )}

      <GrupoAjustes titulo="Para mí" nota="Solo en este dispositivo">
        <FilaAjuste icon={Bell} color="#E8821E" label="Notificaciones" sub={estadoAvisos} onClick={() => setSeccion("avisos")} />
        <FilaAjuste icon={Moon} color="#5661B3" label="Apariencia" sub={[nombreTema, `Letra ${nombreTamano.toLowerCase()}`, nombreNotacion].filter(Boolean).join(" · ")} onClick={() => setSeccion("apariencia")} />
        <FilaAjuste icon={Download} color="#1F8A73" label="Este dispositivo" sub={install.installed ? "App instalada" : "Instalar la app"} onClick={() => setSeccion("dispositivo")} />
        <FilaAjuste icon={Calendar} color="#2F5FA8" label="Mis próximas fechas" sub={misEventos.length ? `${misEventos.length} ${misEventos.length === 1 ? "fecha" : "fechas"}` : "Nada asignado por ahora"} onClick={() => setSeccion("fechas")} />
      </GrupoAjustes>

      <GrupoAjustes titulo="Mi iglesia" nota={realIsAdmin ? "Solo administradores" : ""}>
        <FilaAjuste icon={Users} color="#6E63C7" label={teamName || "Mi equipo"} sub={`${usuariosReales.length} ${usuariosReales.length === 1 ? "miembro" : "miembros"}`} onClick={() => setShowTeamList(true)} />
        {realIsAdmin && <FilaAjuste icon={Users} color="#2F5FA8" label="Miembros y roles" sub="Invitar, permisos y estado" onClick={onGoToUsuarios} />}
        <FilaAjuste icon={Tv} color="#C23B32" label="Proyección y pantallas" sub={realIsAdmin ? "Pantallas y TV · Letra y versículos" : "Proyección · Escenario"} onClick={() => setSeccion("proyeccion")} />
        {realIsAdmin && <FilaAjuste icon={Palette} color="#B15EA0" label="Identidad y horario" sub={["Logo y colores", zonaIglesia ? etiquetaZona(zonaIglesia) : ""].filter(Boolean).join(" · ")} onClick={() => setSeccion("identidad")} />}
        {realIsAdmin && <FilaAjuste icon={Crown} color="#E8821E" label="Plan" sub={textoPlan} onClick={abrirPlanes} />}
      </GrupoAjustes>

      <GrupoAjustes titulo="Más">
        <FilaAjuste icon={MessageCircle} color="#1F8A73" label="Ayuda y contacto" sub="Tutorial, WhatsApp y correo" onClick={() => setSeccion("ayuda")} />
        {realIsAdmin && <FilaAjuste icon={Shield} color="#64707F" label="Avanzado" sub={nameOverride || roleOverride ? `Viendo como: ${nameOverride || roleOverride}` : "Ver como otra persona" + (onGoToPlataforma ? " · Consola" : "")} onClick={() => setSeccion("avanzado")} />}
      </GrupoAjustes>

      <button onClick={signOut} style={{ width: "100%", minHeight: 48, borderRadius: 14, border: "1px solid var(--wf-divider)", background: "var(--wf-card)", color: "#C23B32", fontSize: 15, fontWeight: 600, cursor: "pointer", marginTop: 4, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <LogOut size={17} /> Cerrar sesión
      </button>

      {modales}

      <div style={{ textAlign: "center", fontSize: 11, color: "var(--wf-border-soft)", marginTop: 20 }}>WorshipFlow</div>
    </div>
  );
}

