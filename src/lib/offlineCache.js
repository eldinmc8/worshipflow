// Red de seguridad ligera para cuando se cae el internet a medio culto: guarda en el propio
// dispositivo (localStorage) la última copia de canciones/eventos/ministerios que sí se pudo cargar
// desde Supabase, para que si la conexión se corta y la app se recarga por cualquier motivo (batería
// baja, se bloqueó el celular, etc.) no se quede en blanco — sigue mostrando lo último que tenía. Es
// solo de lectura: no reemplaza guardar de verdad, ni sincroniza cambios hechos sin conexión.
const PREFIX = "worshipflow_cache_";

export function saveCache(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // Si no cabe (localStorage lleno, o hay diapositivas con imágenes propias en base64 que pesan
    // mucho) no pasa nada grave — esto es solo un respaldo, no la fuente de verdad de los datos.
  }
}

export function loadCache(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw)?.data ?? null;
  } catch {
    return null;
  }
}
