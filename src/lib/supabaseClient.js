import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, publishableKey);

// Llama a una Edge Function (crear-usuario / eliminar-usuario / reiniciar-password) pasando la
// sesión actual como Authorization — así la función puede confirmar quién llama y si es admin.
export async function callUsersFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  let res;
  try {
    res = await fetch(`${url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        apikey: publishableKey,
      },
      body: JSON.stringify(body),
    });
  } catch {
    // fetch() rechaza con un TypeError genérico ("Failed to fetch", sin más detalle) cuando la
    // conexión se corta antes de recibir respuesta — sin internet, o el servidor cerró la conexión
    // (ej. un cuerpo de la petición más pesado de lo que acepta). Un mensaje claro en vez de eso.
    throw new Error("No se pudo conectar con el servidor — revisa tu conexión a internet e intenta de nuevo.");
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Error al llamar al servidor.");
  return json;
}
