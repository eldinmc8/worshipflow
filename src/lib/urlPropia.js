// Las imágenes de WorshipFlow (Bienvenida, Gloria a Dios, despedidas…) en eventos viejos quedaron
// guardadas con la dirección vieja de la app (https://worshipflow-pearl.vercel.app/diapositivas/…).
// Para la app eso era "otro sitio web": no las guardaba para usar sin conexión y sin internet no
// salían (pedido de Eldin, 2026-11-20). Se convierten a la ruta de la propia app (/diapositivas/…),
// que es el mismo archivo y sí se guarda.
const DOMINIOS_VIEJOS = /^https?:\/\/(worshipflow-pearl\.vercel\.app|(app\.|www\.)?worshipflowapp\.com)(?=\/diapositivas\/)/i;

export function urlPropia(url) {
  return typeof url === "string" ? url.replace(DOMINIOS_VIEJOS, "") : url;
}

// Igual, pero en cualquier estructura (diapositivas con capas, fondos…). Devuelve una copia solo si
// algo cambió; si no, el mismo objeto.
export function urlsPropias(valor) {
  if (valor == null || typeof valor !== "object") return urlPropia(valor);
  const texto = JSON.stringify(valor);
  if (!/worshipflow(-pearl\.vercel\.app|app\.com)\/diapositivas\//i.test(texto)) return valor;
  return JSON.parse(texto.replace(/https?:\/\/(worshipflow-pearl\.vercel\.app|(app\.|www\.)?worshipflowapp\.com)(\/diapositivas\/)/gi, "$3"));
}
