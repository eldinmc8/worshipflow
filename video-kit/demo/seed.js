// Datos de DEMOSTRACIÓN (iglesia, personas y canciones inventadas).
export const USER_ID = "usr-demo";
const IG = "igl-demo";
const hoy = new Date();
const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`;

const canciones = [];
const secciones_cancion = [];
const estructura_cancion = [];
const diapositivas_letra = [];

function song(id, titulo, artista, tonalidad, tempo, partes, estructura) {
  canciones.push({ id, iglesia_id: IG, titulo, artista, tonalidad, tempo, compas: "4/4", temas: "", categoria: "Adoración", favorito: false, creado_por: USER_ID, created_at: "2026-01-01" });
  let o = 0;
  partes.forEach(([clave, etiqueta, badge, slides], i) => {
    secciones_cancion.push({ id: `${id}-s${i}`, iglesia_id: IG, cancion_id: id, clave, etiqueta, distintivo: badge, compases: 8, orden: i, contenido: slides.flat().join("\n") });
    slides.forEach((lines, j) => diapositivas_letra.push({ id: `${id}-d${o}`, iglesia_id: IG, cancion_id: id, seccion_clave: clave, orden_en_seccion: j, texto: lines.join("\n"), orden: o++ }));
  });
  estructura.forEach((k, i) => estructura_cancion.push({ id: `${id}-e${i}`, iglesia_id: IG, cancion_id: id, orden: i, seccion_clave: k, multiplicador: 1 }));
}

song("sng-cantare", "Cantaré de tu amor", "Ministerio Demo", "G", 74, [
  ["v1", "Verso 1", "V1", [["Desde el amanecer", "mi alma busca tu luz"], ["Tu fidelidad", "me sostiene, Jesús"]]],
  ["c", "Coro", "C", [["Cantaré de tu amor", "por siempre cantaré"], ["Tu gracia me alcanzó", "y en ti me quedaré"]]],
  ["v2", "Verso 2", "V2", [["Cuando todo cambió", "tú seguiste fiel"], ["Mi refugio y mi paz", "eres tú, Emanuel"]]],
  ["p", "Puente", "P", [["Santo, santo eres tú", "digno de toda honra"], ["Toda mi vida", "te pertenece a ti"]]],
], ["v1", "c", "v2", "c", "p", "c"]);
song("sng-fiel", "Fiel en la tormenta", "Ministerio Demo", "D", 70, [
  ["v1", "Verso 1", "V1", [["Aunque ruja el mar", "no temeré"], ["Tu mano me guía", "y en ti confiaré"]]],
  ["c", "Coro", "C", [["Fiel en la tormenta", "fiel en la calma"], ["Siempre fiel", "eres tú, Señor"]]],
], ["v1", "c", "c"]);
song("sng-refugio", "Eres mi refugio", "Ministerio Demo", "A", 68, [
  ["v1", "Verso 1", "V1", [["En tu presencia", "encuentro descanso"]]],
  ["c", "Coro", "C", [["Eres mi refugio", "mi fortaleza"]]],
], ["v1", "c"]);
const extra = [["sng-luz", "Luz de mi camino", "E"], ["sng-santo", "Santo y digno", "C"], ["sng-nada", "Nada me faltará", "F"], ["sng-rio", "Río de vida", "Bb"], ["sng-pactos", "Dios de pactos", "D"], ["sng-roca", "Mi roca firme", "A"], ["sng-canto", "Canto de victoria", "E"], ["sng-cielo", "Cielo abierto", "G"], ["sng-cantico", "Cántico nuevo", "C"]];
extra.forEach(([id, t, k]) => song(id, t, "Ministerio Demo", k, 72, [["v1", "Verso 1", "V1", [["Te alabaré", "con todo mi ser"]]], ["c", "Coro", "C", [["Grande es tu amor", "Señor"]]]], ["v1", "c"]));

const ACORDES = {
  "sng-fiel-s0": "[D]Aunque ruja el [A]mar\n[Bm]no te[G]meré\n[D]Tu mano me [A]guía\ny en [G]ti confia[A]ré",
  "sng-fiel-s1": "[G]Fiel en la tor[D]menta\n[A]fiel en la [Bm]calma\n[G]Siempre [D]fiel\neres [A]tú, Se[D]ñor",
  "sng-cantare-s0": "[G]Desde el ama[D]necer\n[Em]mi alma busca tu [C]luz\n[G]Tu fideli[D]dad\nme sos[C]tiene, Je[D]sús",
  "sng-cantare-s1": "[C]Cantaré de tu a[G]mor\npor [D]siempre canta[Em]ré\n[C]Tu gracia me al[G]canzó\ny en [D]ti me queda[G]ré",
};
secciones_cancion.forEach((x) => { if (ACORDES[x.id]) x.contenido = ACORDES[x.id]; });
const EV = "evt-demo";
const items_servicio = [
  { id: "it-1", evento_id: EV, iglesia_id: IG, tipo: "slide", orden: 0, titulo: "Bienvenidos", descripcion: "Bienvenida", subtitulo: "Culto dominical · 10:00 AM", fondo_color: "#0B0F17", fondo_tipo: "color" },
  { id: "it-2", evento_id: EV, iglesia_id: IG, tipo: "bloque", orden: 1, titulo: "Alabanza", descripcion: "" },
  { id: "it-3", evento_id: EV, iglesia_id: IG, tipo: "cancion", orden: 2, cancion_id: "sng-fiel" },
  { id: "it-4", evento_id: EV, iglesia_id: IG, tipo: "cancion", orden: 3, cancion_id: "sng-refugio" },
  { id: "it-5", evento_id: EV, iglesia_id: IG, tipo: "bloque", orden: 4, titulo: "Predicación", descripcion: "" },
];

export const SEED = {
  iglesias: [{ id: IG, nombre: "Iglesia Demo", slug: "demo", activa: true, zona_horaria: "America/Guatemala", color_primario: null, color_acento: null, categorias_canciones: null, formato_letra: null, dividir_versiculos: null }],
  usuarios: [{ id: USER_ID, iglesia_id: IG, email: "demo@iglesia.test", nombre: "Daniel Ruiz", rol: "admin", estado: "activo", perfil_completo: true, foto_url: null, rol_id: null, tutoriales_vistos: ["bienvenida_v2","eventos","evento","canciones","editor_cancion","envivo_v3"] }],
  roles_app: [],
  canciones, secciones_cancion, estructura_cancion, diapositivas_letra,
  eventos: [{ id: EV, iglesia_id: IG, titulo: "Culto dominical", fecha, hora: "23:59", fecha_label: null, ubicacion: "Templo principal", creado_por: USER_ID, es_plantilla: false, created_at: "2026-01-01" }],
  items_servicio,
  roles_evento: [{ id: "rol-mm", evento_id: EV, iglesia_id: IG, nombre: "Multimedia", orden: 0, visible_solo_admin: false }],
  miembros_rol: [{ id: "mr-1", rol_id: "rol-mm", iglesia_id: IG, nombre: "Daniel Ruiz", usuario_id: USER_ID, estado: "confirmado", lead: true, orden: 0 }],
  ministerios: [], sesiones_en_vivo: [], notificaciones: [], recordatorios_evento: [], adjuntos_cancion: [], animaciones_iglesia: [],
  push_subscriptions: [], plantillas_diapositivas: [], notas_seccion: [], codigos_invitacion: [], bosquejos: [],
  resumen_mensual_ministerio: [], musico_en_vivo: [], asignaciones_vistas: [{ evento_id: EV, usuario_id: USER_ID, iglesia_id: IG, visto_at: "2026-11-01" }], recursos_ministerio: [], planificacion_ministerio: [],
};

// ---------- Iglesia de demostración completa para la guía (nombres inventados) ----------
(() => {
  const S = SEED;
  const T = ["bienvenida_v2","eventos","evento","canciones","editor_cancion","envivo_v3","ministerios","ajustes","usuarios","plantillas","musico","bosquejo","editor_diapositivas","grupos"];
  S.usuarios[0].tutoriales_vistos = T;
  const U = (id, nombre, rol, rol_id = null, estado = "activo") => ({ id, iglesia_id: IG, email: nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, ".") + "@correo.test", nombre, rol, estado, perfil_completo: estado === "activo", foto_url: null, rol_id, tutoriales_vistos: T });
  S.roles_app = [
    { id: "ra-admin", iglesia_id: IG, nombre: "Administrador", protegido: true, orden: 0, permisos: { gestionar_roles: true, usar_asistente_ia: true, ver_todos_eventos: true, gestionar_usuarios: true, controlar_estilo_vivo: true, editar_eventos_setlist: true, iniciar_finalizar_vivo: true } },
    { id: "ra-mm", iglesia_id: IG, nombre: "Multimedia", protegido: false, orden: 1, permisos: { controlar_estilo_vivo: true, iniciar_finalizar_vivo: true } },
    { id: "ra-mus", iglesia_id: IG, nombre: "Músico", protegido: false, orden: 2, permisos: { ver_canciones: true } },
    { id: "ra-miem", iglesia_id: IG, nombre: "Miembro", protegido: false, orden: 3, permisos: {} },
    { id: "ra-sup", iglesia_id: IG, nombre: "Supervisor", protegido: false, orden: 4, permisos: { ver_canciones: true, ver_todos_eventos: true } },
    { id: "ra-lider", iglesia_id: IG, nombre: "Líder de ministerio", protegido: false, orden: 5, permisos: { ver_canciones: true, editar_setlist: true, ver_todos_eventos: true } },
  ];
  S.usuarios.push(
    U("u-pastor", "Samuel Ortiz", "admin", "ra-admin"), U("u-ana", "Ana López", "multimedia", "ra-mm"), U("u-carlos", "Carlos Méndez", "multimedia", "ra-mm"),
    U("u-marcos", "Marcos Pérez", "musico", "ra-mus"), U("u-luis", "Luis Herrera", "musico", "ra-mus"), U("u-sofia", "Sofía Ramírez", "musico", "ra-mus"),
    U("u-jorge", "Jorge Castillo", "musico", "ra-mus"), U("u-rosa", "Rosa Morales", "miembro", "ra-lider"), U("u-lucia", "Lucía Torres", "miembro", "ra-lider"),
    U("u-pedro", "Pedro Gómez", "miembro", "ra-miem"), U("u-elena", "Elena Vásquez", "miembro", "ra-miem", "invitado"));
  S.ministerios = [
    { id: "m-alab", iglesia_id: IG, nombre: "Alabanza", color: "#E8821E", lider_id: "u-marcos", permisos_lider: { editar_setlist: true, equipo: true, gestionar_canciones: true }, created_at: "2026-01-01" },
    { id: "m-inf", iglesia_id: IG, nombre: "Escuela dominical infantil", color: "#1F8A73", lider_id: "u-rosa", permisos_lider: {}, created_at: "2026-01-01" },
    { id: "m-adol", iglesia_id: IG, nombre: "Adolescentes", color: "#5661B3", lider_id: "u-lucia", permisos_lider: {}, created_at: "2026-01-01" },
    { id: "m-orden", iglesia_id: IG, nombre: "Orden y limpieza", color: "#8A6D3B", lider_id: "u-pedro", permisos_lider: {}, created_at: "2026-01-01" },
  ];
  const mes = fecha.slice(0, 7);
  const dom = (n) => { const d = new Date(hoy); d.setDate(d.getDate() + ((7 - d.getDay()) % 7) + 7 * n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  S.planificacion_ministerio = [
    ["m-inf", -1, "Clase: Noé y el arca", "Manualidad: arca de papel. Maestra: Rosa"],
    ["m-inf", 0, "Clase: David y Goliat", "Versículo para memorizar: 1 Samuel 17:45. Maestra: Rosa"],
    ["m-inf", 1, "Clase: Jonás", "Dinámica con títeres. Maestra: Elena"],
    ["m-inf", 2, "Clase: El buen samaritano", "Dramatización con los niños"],
    ["m-adol", 0, "Serie: Identidad en Cristo (1)", "Dinámica de grupos y preguntas"],
    ["m-adol", 1, "Serie: Identidad en Cristo (2)", "Invitar a los nuevos"],
  ].map(([m, n, t, d], i) => ({ id: `pl-${i}`, iglesia_id: IG, ministerio_id: m, fecha: dom(n), titulo: t, detalle: d, orden: i }));
  S.recursos_ministerio = [
    ["m-inf", "Hoja para colorear: David y Goliat"], ["m-inf", "Guía de la maestra (noviembre)"], ["m-inf", "Video: canción infantil"],
    ["m-adol", "Bosquejo de la serie Identidad"],
  ].map(([m, t], i) => ({ id: `rc-${i}`, iglesia_id: IG, ministerio_id: m, titulo: t, enlace: "", mes, orden: i }));

  // Plantillas como las de una iglesia real: Domingo AM, Domingo PM, Miércoles
  S.eventos = []; S.items_servicio = []; S.roles_evento = []; S.miembros_rol = []; S.bosquejos = [];
  let k = 0;
  const enc = (item, people) => people.forEach((p, i) => S.miembros_rol.push({ id: `enc-${k++}`, iglesia_id: IG, item_servicio_id: item, rol_id: null, nombre: S.usuarios.find((u) => u.id === p).nombre, usuario_id: p, estado: "confirmado", lead: i === 0, orden: i }));
  function armar(ev, titulo, fechaEv, hora, plantilla, conCanciones) {
    S.eventos.push({ id: ev, iglesia_id: IG, titulo, fecha: plantilla ? null : fechaEv, hora, fecha_label: null, ubicacion: "Templo principal", creado_por: USER_ID, es_plantilla: plantilla, created_at: "2026-01-01" });
    let o = 0; const it = (x) => { const id = `${ev}-i${o}`; S.items_servicio.push({ id, evento_id: ev, iglesia_id: IG, orden: o++, ...x }); return id; };
    it({ tipo: "bloque", titulo: "Bienvenida", descripcion: "" });
    it({ tipo: "slide", titulo: "Bienvenidos", subtitulo: "Nos alegra que estés aquí", fondo_color: "#16324F", fondo_tipo: "color" });
    enc(it({ tipo: "bloque", titulo: "Orden y limpieza", descripcion: "Limpieza del templo", ministerio_id: "m-orden" }), ["u-pedro"]);
    enc(it({ tipo: "bloque", titulo: "Multimedia", descripcion: "Encargados de multimedia" }), ["u-ana", "u-carlos"]);
    it({ tipo: "bloque", titulo: "Lectura y oración inicial", descripcion: "Lectura y oración de apertura" });
    if (conCanciones) it({ tipo: "biblia", titulo: "Salmo 100:1-2", referencia: "Salmo 100:1-2", version_biblia: "RVR1960", libro_id: 19, libro_nombre: "Salmos", capitulo: 100, versiculo_inicio: 1, versiculo_fin: 2, texto_biblia: "Cantad alegres a Dios, habitantes de toda la tierra. Servid a Jehová con alegría; venid ante su presencia con regocijo." });
    const alab = it({ tipo: "bloque", titulo: "Bloque de alabanza", descripcion: "Alabanza y adoración", ministerio_id: "m-alab" });
    if (conCanciones) { it({ tipo: "cancion", cancion_id: "sng-fiel" }); it({ tipo: "cancion", cancion_id: "sng-cantare" }); it({ tipo: "cancion", cancion_id: "sng-refugio" }); }
    enc(it({ tipo: "bloque", titulo: "Escuelita dominical", descripcion: "Los niños pasan a sus clases", ministerio_id: "m-inf" }), ["u-rosa", "u-elena"]);
    const pred = it({ tipo: "bloque", titulo: "Prédica", descripcion: "El momento de escuchar la Palabra", estructura: { predicacion: true } });
    enc(pred, ["u-pastor"]);
    enc(it({ tipo: "bloque", titulo: "Ofrenda y oración final", descripcion: "" }), ["u-pedro"]);
    it({ tipo: "slide", titulo: "Despedida", subtitulo: "¡Dios te bendiga!", fondo_color: "#16324F", fondo_tipo: "color" });
    const roles = [["Dirección de cantos", "u-marcos"], ["Guitarra acústica", "u-marcos"], ["Piano", "u-sofia"], ["Batería", "u-luis"], ["Bajo eléctrico", "u-jorge"]];
    roles.forEach(([n, p], i) => { const rid = `${ev}-r${i}`; S.roles_evento.push({ id: rid, evento_id: ev, iglesia_id: IG, nombre: n, orden: i, visible_solo_admin: false });
      S.miembros_rol.push({ id: `mr-${k++}`, rol_id: rid, iglesia_id: IG, nombre: S.usuarios.find((u) => u.id === p).nombre, usuario_id: p, estado: conCanciones && i === 4 ? "pendiente" : "confirmado", lead: false, orden: 0 }); });
    return { pred, alab };
  }
  armar("tpl-am", "Domingo AM", null, "10:00", true, false);
  armar("tpl-pm", "Domingo PM", null, "17:00", true, false);
  armar("tpl-mie", "Miércoles", null, "19:00", true, false);
  const { pred } = armar(EV, "Culto dominical", dom(0), "10:00", false, true);
  S.bosquejos.push({ item_servicio_id: pred, evento_id: EV, iglesia_id: IG, titulo: "Fiel en la tormenta",
    cita_base: { ref: "Marcos 4:39", version: "RVR1960", text: "Y levantándose, reprendió al viento, y dijo al mar: Calla, enmudece. Y cesó el viento, y se hizo grande bonanza.", bookId: 41, bookName: "Marcos", chapter: 4, verseStart: 39, verseEnd: 39 },
    idea_central: "Jesús tiene autoridad sobre cada tormenta de tu vida.", mostrar_idea: true,
    puntos: [{ id: "p1", titulo: "Las tormentas llegan", nota: "", versiculos: [{ ref: "Juan 16:33", version: "RVR1960", text: "En el mundo tendréis aflicción; pero confiad, yo he vencido al mundo.", bookId: 43, bookName: "Juan", chapter: 16, verseStart: 33, verseEnd: 33 }], subpuntos: [] }, { id: "p2", titulo: "Jesús está en la barca", nota: "", versiculos: [{ ref: "Isaías 43:2", version: "RVR1960", text: "Cuando pases por las aguas, yo estaré contigo.", bookId: 23, bookName: "Isaías", chapter: 43, verseStart: 2, verseEnd: 2 }], subpuntos: [] }, { id: "p3", titulo: "Su palabra trae calma", nota: "", versiculos: [], subpuntos: [] }],
    conclusiones: [], enviado_at: "2026-11-05T20:00:00Z", editado_por: "u-pastor", updated_at: "2026-11-05T20:00:00Z" });
  S.push_subscriptions = S.usuarios.map((u, i) => ({ id: `ps-${i}`, usuario_id: u.id, iglesia_id: IG, endpoint: "demo", created_at: "2026-11-01" }));
  S.asignaciones_vistas = S.eventos.map((e) => ({ evento_id: e.id, usuario_id: USER_ID, iglesia_id: IG, visto_at: "2026-11-01" }));
})();
