// Regla única de "contraseña segura" para toda la app (cambiar contraseña, aceptar invitación, crear
// iglesia, reiniciar la de otra persona). La misma regla está copiada en las Edge Functions
// reiniciar-password y crear-iglesia, para que no se pueda saltar llamándolas directo.
// Pensada para gente de iglesia, no para expertos: pocas reglas, fáciles de entender.

const COMUNES = [
  "12345678", "123456789", "1234567890", "password", "password1", "contraseña", "contrasena",
  "qwerty123", "abc12345", "11111111", "00000000", "iloveyou", "jesus123", "jesucristo", "diosesamor",
  "aleluya1", "iglesia1", "admin123", "bienvenido",
];

export const REQUISITOS_PASSWORD = [
  { id: "largo", texto: "Al menos 8 caracteres", cumple: (p) => p.length >= 8 },
  { id: "letra", texto: "Al menos una letra", cumple: (p) => /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p) },
  { id: "numero", texto: "Al menos un número", cumple: (p) => /\d/.test(p) },
  { id: "comun", texto: "Que no sea una contraseña muy común", cumple: (p) => p.length > 0 && !COMUNES.includes(p.toLowerCase()) && !/^(.)\1+$/.test(p) },
];

// null si es válida; si no, el mensaje del primer requisito que falta.
export function validarPassword(p) {
  const falla = REQUISITOS_PASSWORD.find((r) => !r.cumple(p || ""));
  return falla ? `La contraseña necesita: ${falla.texto.toLowerCase()}.` : null;
}

// 0 a 4, para el medidor de colores. Solo orientativo: lo que se exige es validarPassword.
export function fuerzaPassword(p) {
  if (!p) return 0;
  if (validarPassword(p)) return 1;
  let puntos = 2;
  if (p.length >= 12) puntos++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p) && /[^A-Za-z0-9]/.test(p)) puntos++;
  return Math.min(puntos, 4);
}
