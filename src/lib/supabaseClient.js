import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(url, publishableKey);

// Llama a una Edge Function (crear-usuario / eliminar-usuario / reiniciar-password) pasando la
// sesión actual como Authorization — así la función puede confirmar quién llama y si es admin.
export async function callUsersFunction(name, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      apikey: publishableKey,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Error al llamar al servidor.");
  return json;
}
