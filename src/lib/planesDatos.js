// Planes y cuadro comparativo, sin dependencias (ni Supabase ni React): los usan la app, la página web y
// vite.config.js (datos para Google al publicar). Los límites reales están en la base; ver planes.js.
export const PLANES = [
  {
    id: "gratis", nombre: "Gratis", precio: 0, precioAnual: 0, color: "#5661B3",
    resumen: "Para empezar a proyectar el domingo",
    incluye: ["Hasta 5 miembros", "Biblia en todas las versiones", "Eventos y setlist", "Proyección en vivo y TV", "Control remoto desde el celular", "Temas de color y tipos de letra", "3 letras animadas básicas", "Hasta 20 canciones", "1 ministerio", "Asistente: 5 mensajes al día"],
  },
  {
    id: "ministerio", nombre: "Ministerio", precio: 9.99, precioAnual: 99, color: "#1F8A73",
    resumen: "Para el equipo de alabanza completo",
    incluye: ["Hasta 20 miembros", "Todo lo del plan Gratis", "Canciones ilimitadas", "Modo Músico (acordes, auto-avance, tap tempo)", "Pantalla de escenario y letras para OBS", "Todas las letras animadas y fondos en movimiento", "Galería completa de diseños para diapositivas", "Botones de un solo toque y música en la consola", "Material de la canción (tutoriales y partituras)", "Repertorios para que los músicos ensayen", "Usar sin conexión", "Plantillas de eventos", "Hasta 3 ministerios", "Asistente: 30 mensajes al día"],
  },
  {
    id: "crecimiento", nombre: "Crecimiento", precio: 19.99, precioAnual: 199, color: "#2F5FA8",
    resumen: "Para verse profesional cada domingo",
    incluye: ["Hasta 50 miembros", "Todo lo del plan Ministerio", "Importar PowerPoint y PDF al culto", "Bosquejo del predicador y Modo Predicar", "Logo y colores de tu iglesia", "Imagen o video propio de fondo", "Crear letras animadas propias", "Hasta 6 ministerios", "Asistente: 60 mensajes al día"],
  },
  {
    id: "iglesia", nombre: "Iglesia", precio: 29.99, precioAnual: 299, color: "#E8821E",
    resumen: "Toda la iglesia, organizada y sin límites",
    incluye: ["Miembros ilimitados", "Todo lo del plan Crecimiento", "Roles y permisos personalizados", "Importar tus canciones de Holyrics, ProPresenter, OpenLP y más", "Te ayudamos a cargar tus canciones", "Ministerios ilimitados", "Asistente: 100 mensajes al día", "Soporte prioritario por WhatsApp"],
  },
];

// Cuadro comparativo (página de precios). Valor por plan: true/false o un texto.
export const COMPARATIVO = [
  { grupo: "Equipo", filas: [
    ["Miembros con cuenta", "5", "20", "50", "Ilimitados"],
    ["Ministerios", "1", "3", "6", "Ilimitados"],
    ["Roles, confirmaciones y recordatorios", true, true, true, true],
    ["Roles y permisos personalizados", false, false, false, true],
  ] },
  { grupo: "Canciones y culto", filas: [
    ["Canciones", "20", "Ilimitadas", "Ilimitadas", "Ilimitadas"],
    ["Eventos y setlist", true, true, true, true],
    ["Plantillas de eventos", false, true, true, true],
    ["Biblia (RVR1960, NVI, TLA, DHH, NTV)", true, true, true, true],
    ["Importar PowerPoint y PDF al culto", false, false, true, true],
    ["Importar canciones de otros programas (Holyrics, ProPresenter, OpenLP…) o PDF", false, false, false, true],
    ["Bosquejo del predicador y Modo Predicar", false, false, true, true],
  ] },
  { grupo: "Proyección", filas: [
    ["Proyección en vivo y TV", true, true, true, true],
    ["Control remoto desde el celular", true, true, true, true],
    ["Pantalla de escenario (teleprompter)", false, true, true, true],
    ["Letras para transmisión en vivo (OBS, fondo transparente)", false, true, true, true],
    ["Botones de un solo toque", false, true, true, true],
    ["Música y diapositivas con audio", false, true, true, true],
    ["Usar sin conexión", false, true, true, true],
    ["Temas de color y tipos de letra", true, true, true, true],
    ["Diseños listos para diapositivas", "6 básicos", "Todos", "Todos", "Todos"],
    ["Letras animadas", "3 básicas", "Todas", "Todas", "Todas"],
    ["Fondos en movimiento", false, true, true, true],
    ["Imagen o video propio de fondo", false, false, true, true],
    ["Crear letras animadas propias", false, false, true, true],
    ["Logo y colores de tu iglesia", false, false, true, true],
  ] },
  { grupo: "Músicos", filas: [
    ["Acordes y transporte de tono", true, true, true, true],
    ["Modo Músico: auto-avance, tap tempo y dirigir", false, true, true, true],
    ["Material de la canción (tutoriales, partituras y fotos)", false, true, true, true],
    ["Repertorios de canciones para ensayar (sin evento)", false, true, true, true],
  ] },
  { grupo: "Extras", filas: [
    ["Asistente con IA (mensajes al día)", "5", "30", "60", "100"],
    ["Te ayudamos a cargar tus canciones", false, false, false, true],
    ["Soporte", "Correo", "Correo y WhatsApp", "Correo y WhatsApp", "Prioritario por WhatsApp"],
  ] },
];
