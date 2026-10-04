-- Seguridad: enviar-push-manual comparaba el header x-manual-secret contra una clave escrita
-- directo en el código de la función (expuesta en un chat) -- esa clave quedó invalidada y se
-- rotó una nueva, guardada en Supabase Vault bajo el nombre 'push_manual_secret' (no en esta
-- migración: el valor real se generó y se insertó aparte con vault.create_secret, directo en
-- Postgres con gen_random_bytes, para que nunca pasara por un archivo ni por un chat).
--
-- Esta función es la única forma de comparar un secreto recibido contra el que vive en el Vault,
-- sin que quien la llama necesite permiso directo sobre el esquema vault -- mismo patrón que
-- mi_iglesia_id()/soy_super_admin() en migraciones anteriores. SECURITY DEFINER corre con los
-- privilegios de quien la creó (con acceso al Vault), no con los de quien la invoca.
create function public.verificar_secreto_push(p_secreto text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'push_manual_secret' and decrypted_secret = p_secreto
  );
$$;

-- Solo la Edge Function (que llama con la service role key) puede ejecutarla -- ni siquiera un
-- usuario autenticado de la app debería poder intentar adivinar el secreto a fuerza bruta vía RPC.
revoke all on function public.verificar_secreto_push(text) from public, anon, authenticated;
grant execute on function public.verificar_secreto_push(text) to service_role;
