import { supabase } from "./supabaseClient.js";

// Recorridos guiados (ver components/Tour.jsx). Cada paso apunta a un elemento marcado con
// data-tour="..." en la pantalla real; si ese elemento no existe en este momento (no tiene el
// permiso, la iglesia todavía no tiene eventos, en celular no aparece, etc.) el paso se salta solo.
// Un paso sin "target" se muestra como tarjeta centrada.
//
// IMPORTANTE al mover o renombrar un botón: si tiene data-tour, dejarle el mismo valor — es lo único
// que conecta el recorrido con la pantalla.

// La clave es lo que se guarda en usuarios.tutoriales_vistos. Cuando un recorrido cambia lo
// suficiente como para que TODOS deban verlo otra vez (no solo los nuevos), se le sube la versión a
// la clave ("_v2", "_v3"...): para quien ya vio la anterior, la nueva cuenta como no vista.
// 2026-10-08: bienvenida y En vivo cambiaron mucho (consola tipo Office, borrar/mover diapositivas,
// estilo guardado...) y se agregó el del editor de canciones.
export const CLAVES_TUTORIAL = {
  bienvenida: "bienvenida_v2",
  eventos: "eventos",
  evento: "evento",
  canciones: "canciones",
  editorCancion: "editor_cancion",
  envivo: "envivo_v3", // 2026-10-11: consola sencilla — guía corta de 4 pasos, todos la ven otra vez
};
export const TUTORIALES = Object.values(CLAVES_TUTORIAL);

export function pasosBienvenida({ esAdmin, puedeGestionarEventos, puedeGestionarCanciones }) {
  const pasos = [
    {
      titulo: "¡Bienvenido/a a WorshipFlow!",
      texto: esAdmin
        ? "En un minuto te mostramos cómo moverte y cuáles son tus primeros pasos como administrador. Puedes saltarlo cuando quieras."
        : "En un minuto te mostramos cómo moverte por la app. Puedes saltarlo cuando quieras.",
    },
    {
      target: "nav",
      titulo: "Tu barra de navegación",
      texto: "Desde aquí vas a todas las secciones. La burbuja naranja te dice dónde estás.",
    },
    {
      target: "nav-inicio",
      titulo: "Inicio",
      texto: "Tu resumen: el próximo evento, lo que te toca y accesos rápidos.",
    },
    {
      target: "nav-canciones",
      titulo: "Canciones",
      texto: puedeGestionarCanciones
        ? "La biblioteca de la iglesia, con letra y acordes. Aquí agregas canciones nuevas y preparas lo que se proyecta."
        : "La biblioteca de la iglesia, con letra y acordes. Búscalas y marca tus favoritas.",
    },
    {
      target: "nav-eventos",
      titulo: "Eventos",
      texto: puedeGestionarEventos
        ? "Aquí creas cada culto, armas el Setlist y asignas a quién le toca qué."
        : "Aquí ves los cultos y lo que te toca en cada uno. Cuando te asignen algo, entra y confirma que lo viste.",
    },
    {
      target: "nav-envivo",
      titulo: "En vivo",
      texto: "La consola para proyectar durante el culto: letra, versículos y diapositivas. Se usa desde la computadora y solo la maneja quien tiene el rol de Multimedia.",
    },
    {
      target: "nav-proyeccion",
      titulo: "Pantalla",
      texto: "Lo que se está viendo en el proyector en este momento.",
    },
    {
      target: "nav-ministerios",
      titulo: "Grupos",
      texto: "La planificación semanal y los recursos de cada ministerio.",
    },
    {
      target: "campana",
      titulo: "Notificaciones",
      texto: "Te avisamos cuando te asignen en un evento o cuando se acerque uno.",
    },
    {
      target: "nav-ajustes",
      titulo: "Ajustes",
      texto: esAdmin
        ? "Tu perfil, invitar a tu equipo (Usuarios), definir Roles y poner el logo y los colores de tu iglesia."
        : "Tu perfil, activar las notificaciones, instalar la app y volver a ver este tutorial.",
    },
  ];
  if (esAdmin) {
    pasos.push({
      titulo: "Tus primeros pasos",
      lista: [
        "Ponle el logo y los colores de tu iglesia: Ajustes → Identidad de la iglesia. Ahí también eliges cómo se reparte la letra según el tamaño de tu pantalla.",
        "Invita a tu equipo: Ajustes → Usuarios.",
        "Agrega tus canciones en Canciones con el botón +.",
        "Crea tu primer evento en Eventos con el botón + y arma su Setlist.",
        "El día del culto, abre el evento y toca Iniciar evento para proyectar desde la computadora.",
      ],
      texto: "La primera vez que entres a cada sección te daremos un consejo rápido.",
      boton: "¡Empezar!",
    });
  } else {
    pasos.push({
      titulo: "¡Listo!",
      texto: "La primera vez que entres a cada sección te daremos un consejo rápido. Puedes repetir este tutorial desde Ajustes.",
      boton: "¡Empezar!",
    });
  }
  return pasos;
}

export function pasosEventos({ puedeGestionarEventos }) {
  return [
    {
      target: "eventos-nuevo",
      titulo: "Crea un evento",
      texto: "Toca + para crear un culto o evento. Puedes empezar en blanco o desde una plantilla que ya tenga el orden del culto.",
    },
    {
      target: "eventos-plantillas",
      titulo: "Plantillas",
      texto: "Guarda aquí el orden de culto que repites cada semana. Así crear el evento del domingo toma segundos.",
    },
    {
      target: "eventos-libre",
      titulo: "Transmitir sin evento",
      texto: "Para proyectar anuncios, oración o un versículo sin haber planificado nada.",
    },
    {
      target: "eventos-primero",
      titulo: "Tus eventos",
      texto: puedeGestionarEventos
        ? "Toca un evento para ver su Setlist y las personas asignadas."
        : "Toca un evento para ver el orden del culto y lo que te toca a ti.",
    },
    {
      target: "eventos-filtro",
      titulo: "Próximos y anteriores",
      texto: "Cambia aquí para ver los eventos de otros meses.",
    },
  ];
}

export function pasosEvento({ puedeGestionarEventos }) {
  return [
    {
      target: "evento-mi-cargo",
      titulo: "Lo que te toca",
      texto: "Toca aquí para avisarle al equipo que ya viste tu participación.",
    },
    {
      target: "evento-ajustes",
      titulo: "Ajustes del evento",
      texto: "Cambia la fecha, la hora y el lugar, y programa recordatorios para el equipo.",
    },
    {
      target: "evento-iniciar",
      titulo: "Iniciar evento",
      texto: "El día del culto, toca aquí para abrir el control en vivo y la pantalla de proyección.",
    },
    {
      target: "evento-editar-setlist",
      titulo: "Arma el culto",
      texto: "Toca Agregar para sumar canciones, versículos, avisos, diapositivas o bloques. En cada elemento, el botón ⋯ sirve para editarlo, duplicarlo, subirlo, bajarlo o quitarlo. Todo se guarda solo.",
    },
    {
      target: "evento-setlist",
      titulo: "El orden del culto",
      texto: puedeGestionarEventos
        ? "Aquí se ve el Setlist completo. Toca una canción para ver su letra y acordes."
        : "Aquí ves el orden del culto. Toca una canción para ver su letra y acordes.",
    },
    {
      target: "evento-pdf",
      titulo: "Respaldo en papel",
      texto: "Exporta el Setlist a PDF por si algún día falla el internet en pleno culto.",
    },
  ];
}

export function pasosCanciones({ puedeGestionarCanciones }) {
  return [
    {
      target: "canciones-nueva",
      titulo: "Agrega una canción",
      texto: "Toca + para crear una canción: detalles, letra con acordes, las diapositivas que se proyectan y el orden de sus partes.",
    },
    {
      target: "canciones-buscar",
      titulo: "Busca",
      texto: "Encuentra cualquier canción por su título.",
    },
    {
      target: "canciones-filtros",
      titulo: "Clasificaciones",
      texto: puedeGestionarCanciones
        ? "Filtra por tipo de canción. Con Editar puedes crear las clasificaciones de tu iglesia."
        : "Filtra por tipo de canción: himnos, coritos, adoración y más.",
    },
  ];
}

export function pasosEditorCancion() {
  return [
    {
      target: "cancion-detalles",
      titulo: "Detalles",
      texto: "Título, tonalidad, tempo, compás y artista de la canción.",
    },
    {
      target: "cancion-contenido",
      titulo: "Contenido",
      texto: "La letra con acordes, escritos así: [G]Cuando el día. La barra de abajo inserta los acordes de la tonalidad donde está el cursor.",
    },
    {
      target: "cancion-letra",
      titulo: "Letra",
      texto: "Las diapositivas que de verdad se proyectan. Divide cada sección como quieras; esto es lo que ve la congregación.",
    },
    {
      target: "cancion-estructura",
      titulo: "Estructura",
      texto: "El orden en que se canta: Estrofa, Coro x2, Puente... Arrastra las partes para cambiar el orden.",
    },
    {
      target: "cancion-guardar",
      titulo: "Guarda",
      texto: "Toca Guardar al terminar. Los cambios se ven al instante en todos los dispositivos.",
    },
  ];
}

export function pasosEnVivo() {
  // Corta a propósito (pedido de Eldin, 2026-10-11): alguien que nunca usó la consola debe poder
  // manejar un culto en 5 minutos. Lo demás (Estilo, Insertar...) está en "Más herramientas".
  return [
    {
      titulo: "Tu consola en 1 minuto",
      texto: "Con 4 cosas ya puedes llevar todo el culto. Si estás en Modo práctica, nada de lo que toques sale en la pantalla de la iglesia.",
    },
    {
      target: "envivo-orden",
      titulo: "1 · Toca para proyectar",
      texto: "Este es el orden del culto. Un clic en cualquier cosa (Bienvenida, un canto, la despedida) y sale de una vez en la pantalla.",
    },
    {
      target: "envivo-siguiente",
      titulo: "2 · Siguiente",
      texto: "Pasa a la siguiente diapositiva. También con la flecha → o la barra espaciadora. Al terminar un canto sigue solo con lo que viene.",
    },
    {
      target: "envivo-negro",
      titulo: "3 · ¿Algo salió mal? Negro",
      texto: "Esconde la pantalla al instante (o la tecla B). Arriba sale una franja roja; toca \"Volver a mostrar\" para regresar.",
    },
    {
      target: "envivo-agregar",
      titulo: "4 · Algo de último momento",
      texto: "Agregar mete un canto, un aviso, un video o un PDF al orden del culto. Nada sale en la pantalla hasta que lo toques.",
    },
    {
      target: "envivo-finalizar",
      titulo: "¡Listo!",
      texto: "Al terminar el culto toca Finalizar (te pide confirmar). Si se te olvida algo, el botón ? te enseña esta guía otra vez.",
      boton: "¡A servir!",
    },
  ];
}

export async function marcarTutorialVisto(clave) {
  const { error } = await supabase.rpc("marcar_tutorial_visto", { p_clave: clave });
  if (error) throw error;
}

export async function reiniciarTutoriales() {
  const { error } = await supabase.rpc("reiniciar_tutoriales");
  if (error) throw error;
}
