-- Control remoto de las diapositivas desde el celular (pedido de Eldin, 2026-11-13).
--
-- El celular NO cambia la diapositiva: manda una orden ("siguiente", "anterior", "negro", "ir a esta
-- parte del culto") a esta tabla, y la computadora que lleva la transmisión la recibe por Realtime y la
-- ejecuta igual que si hubieran tocado su teclado. Así la computadora sigue mandando (sus ocultos, su
-- estilo, cómo divide versículos) y nunca se desincroniza. Desde el celular no hay forma de iniciar ni
-- terminar la transmisión: esas acciones ni existen aquí.
--
-- Quién puede mandar órdenes (la base lo revisa, no solo la app):
--  * Quien controla el en vivo (wf_controlo_vivo: admin, Multimedia o un rol con permiso de en vivo):
--    cualquier orden.
--  * El predicador asignado al bloque de Predicación del evento que está en vivo: solo "siguiente" y
--    "anterior", marcando su bloque (bloque_id). La computadora además solo le obedece mientras está al
--    aire su propio bosquejo.

create table if not exists public.comandos_en_vivo (
  id uuid primary key default gen_random_uuid(),
  iglesia_id uuid not null default public.mi_iglesia_id() references public.iglesias(id) on delete cascade,
  usuario_id uuid not null default auth.uid() references public.usuarios(id) on delete cascade,
  accion text not null check (accion in ('siguiente', 'anterior', 'negro', 'ir_item')),
  item_id text,
  bloque_id text,
  creado_at timestamptz not null default now()
);

create index if not exists comandos_en_vivo_iglesia_idx on public.comandos_en_vivo (iglesia_id, creado_at desc);

alter table public.comandos_en_vivo enable row level security;

drop policy if exists "la iglesia ve sus órdenes en vivo" on public.comandos_en_vivo;
create policy "la iglesia ve sus órdenes en vivo" on public.comandos_en_vivo
  for select to authenticated using (iglesia_id = public.mi_iglesia_id());

-- wf_controlo_vivo y wf_predico están cerradas al público (ver 20261102000000 y 20261108000000): la
-- regla pasa por esta función, que solo responde sí/no sobre quien llama.
create or replace function public.wf_puedo_mandar_comando(p_accion text, p_bloque text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select case
    when p_bloque is null then public.wf_controlo_vivo()
    else p_accion in ('siguiente', 'anterior')
      and public.wf_predico(p_bloque, (select s.evento_id from public.sesiones_en_vivo s where s.iglesia_id = public.mi_iglesia_id()))
  end
$$;
revoke execute on function public.wf_puedo_mandar_comando(text, text) from public, anon;
grant execute on function public.wf_puedo_mandar_comando(text, text) to authenticated;

drop policy if exists "mandar órdenes al en vivo" on public.comandos_en_vivo;
create policy "mandar órdenes al en vivo" on public.comandos_en_vivo
  for insert to authenticated with check (
    iglesia_id = public.mi_iglesia_id()
    and usuario_id = auth.uid()
    and public.wf_puedo_mandar_comando(accion, bloque_id)
  );

-- Las órdenes solo sirven en el momento: se borran las de más de una hora en cada orden nueva.
create or replace function public.wf_limpiar_comandos_en_vivo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.comandos_en_vivo where iglesia_id = new.iglesia_id and creado_at < now() - interval '1 hour';
  return new;
end $$;

drop trigger if exists limpiar_comandos_en_vivo on public.comandos_en_vivo;
create trigger limpiar_comandos_en_vivo after insert on public.comandos_en_vivo
  for each row execute function public.wf_limpiar_comandos_en_vivo();

alter publication supabase_realtime add table public.comandos_en_vivo;
revoke execute on function public.wf_limpiar_comandos_en_vivo() from public, anon, authenticated;
