// Abrir la proyección en el segundo monitor/proyector (arreglo del 2026-11-08, reporte de una iglesia:
// "la computadora sí reconoce la segunda pantalla, pero al iniciar el evento dice que conecte una, y al
// darle Abrir proyección sale en mi pantalla y tengo que arrastrarla").
//
// Causas que había:
// 1. "La otra pantalla" se buscaba comparando objetos (s !== currentScreen). Chrome puede entregar
//    objetos distintos para la misma pantalla, y además se usaba una lista guardada al abrir la página
//    que podía estar vieja → "no se detectó una segunda pantalla" aunque sí estuviera.
// 2. La pantalla completa se pedía sin decir EN QUÉ pantalla, así que quedaba donde hubiera caído la
//    ventana (a veces la de la consola). La API permite pedirla en una pantalla concreta.
// 3. Si la ventana de proyección ya estaba abierta, se reutilizaba donde estaba, sin moverla.
// Aquí van las partes que se pueden probar solas; el uso está en PrototipoWorshipFlow (startPresentation).

const clave = (s) => (s ? `${s.left},${s.top},${s.width},${s.height}` : "");

// La pantalla donde NO está la consola. Se compara por posición y tamaño (no por objeto). Si la consola
// está en la pantalla secundaria, la otra es la principal, y viceversa.
export function elegirOtraPantalla(detalles) {
  const pantallas = Array.isArray(detalles?.screens) ? detalles.screens : [];
  if (pantallas.length < 2) return null;
  const actual = detalles.currentScreen || pantallas.find((s) => s.isPrimary) || pantallas[0];
  const otras = pantallas.filter((s) => clave(s) !== clave(actual));
  if (!otras.length) return null;
  return otras.find((s) => s.isPrimary !== actual.isPrimary) || otras[0];
}

// Medidas para window.open: el área útil (sin la barra de tareas) cuando el navegador la da.
export function medidasVentana(pantalla) {
  const x = Number.isFinite(pantalla.availLeft) ? pantalla.availLeft : pantalla.left;
  const y = Number.isFinite(pantalla.availTop) ? pantalla.availTop : pantalla.top;
  const ancho = pantalla.availWidth || pantalla.width;
  const alto = pantalla.availHeight || pantalla.height;
  return { x, y, ancho, alto, features: `left=${x},top=${y},width=${ancho},height=${alto}` };
}

// Mensaje claro según por qué no se pudo (en vez de "conecta una segunda pantalla" para todo).
// extendido: window.screen.isExtended (true si el sistema sí tiene más de una pantalla en modo Extender).
export function motivoSinSegundaPantalla({ soportado = true, permisoDenegado = false, extendido = null } = {}) {
  if (!soportado) return "Este navegador no puede abrir la proyección sola en el segundo monitor. Usa Google Chrome o Microsoft Edge en la computadora.";
  if (permisoDenegado) return "Chrome no tiene permiso para usar tus pantallas. Toca el candado junto a la dirección → Configuración del sitio → «Administración de ventanas» → Permitir, recarga la página y vuelve a intentar.";
  if (extendido === true) return "Hay una segunda pantalla, pero el navegador todavía no la ve. Recarga la página (F5) y vuelve a intentar.";
  return "No se ve una segunda pantalla en modo «Extender». Si el proyector muestra lo mismo que tu computadora, presiona las teclas Windows + P y elige «Extender» (en Mac: Ajustes → Pantallas → desactiva «Duplicar»). Luego vuelve a intentar.";
}
