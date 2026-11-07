// Texto de los versículos que devuelve la API (bolls.life) viene como HTML.
// Ojo (arreglado 2026-10-18, "tu s obras" en Santiago 2:18): las etiquetas de formato como <i>, <mark> o
// <span> pueden caer EN MEDIO de una palabra ("tu<i>s</i>") — antes se cambiaban por un espacio y la
// palabra quedaba partida. Ahora solo los saltos (<br>, </br>, <p>, <div>) cuentan como espacio; las
// demás etiquetas se quitan sin dejar nada.
// Versiones en inglés (2026-11-07): KJV/ASV traen números de Strong (<S>1063</S>) y CSB/NABRE marcas de
// notas al pie (<sup>[5]</sup>, <sup>ⓜ</sup>) — se quitan CON su contenido, nunca se proyectan.
export const stripBibleSearchMarkup = (text) => String(text || "")
  .replace(/<\s*S\s*>[^<]*<\s*\/\s*S\s*>/g, "")
  .replace(/<\s*sup\b[^>]*>[\s\S]*?<\s*\/\s*sup\s*>/gi, "")
  .replace(/<\s*\/?\s*(br|p|div)\b[^>]*>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();
