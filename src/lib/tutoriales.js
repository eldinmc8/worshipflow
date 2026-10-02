import { supabase } from "./supabaseClient.js";

// Recorridos guiados (ver components/Tour.jsx). Cada paso apunta a un elemento marcado con
// data-tour="..." en la pantalla real; si ese elemento no existe en este momento (no tiene el
// permiso, la iglesia todavía no tiene eventos, en celular no aparece, etc.) el paso se salta solo.
// Un paso sin "target" se muestra como tarjeta centrada.
//
// IMPORTANTE al mover o renombrar un botón: si tiene data-tour, dejarle el mismo valor — es lo único
// que conecta el recorrido con la pantalla.

export const TUTORIALES = ["bienvenida", "eventos", "evento", "canciones", "envivo"];

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
        "Ponle el logo y los colores de tu iglesia: Ajustes → Identidad de la iglesia.",
        "Invita a tu equipo: Ajustes → Usuarios.",
        "Agrega tus canciones en Canciones con el botón +.",
        "Crea tu primer evento en Eventos con el botón +.",
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
      titulo: "Arma el Setlist",
      texto: "Toca Editar para agregar canciones, versículos, slides y bloques del culto, reordenarlos y asignar encargados. Toca Guardar al terminar.",
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

export function pasosEnVivo() {
  return [
    {
      titulo: "Control en vivo",
      texto: "Desde aquí manejas lo que se ve en el proyector durante el culto. Te mostramos lo principal.",
    },
    {
      target: "envivo-proyeccion",
      titulo: "Pantalla de proyección",
      texto: "Abre la proyección en una ventana nueva y llévala al proyector o a la segunda pantalla.",
    },
    {
      target: "envivo-negro",
      titulo: "Pantalla en negro",
      texto: "Apaga la proyección al instante sin terminar la transmisión. Tócalo otra vez para volver.",
    },
    {
      target: "envivo-paneles",
      titulo: "Biblia, Transmisión y Estilo",
      texto: "Busca y proyecta versículos, recorre las diapositivas del Setlist o cambia el fondo y la letra en vivo.",
    },
    {
      target: "envivo-finalizar",
      titulo: "Finalizar",
      texto: "Al terminar el culto, finaliza la transmisión para que otro evento pueda salir en vivo.",
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
