-- Hora del ensayo y nota de quien dirige la alabanza, por evento (pedido de Eldin, 2026-10-09).
-- Se muestran en la pantalla de Inicio a quienes tocan/cantan ese día. Cualquier miembro de la
-- iglesia ya puede actualizar eventos (política "autenticados: todo en eventos"); la app solo deja
-- editarlos a administradores y a quien dirige la alabanza en ese evento.
alter table public.eventos add column if not exists ensayo_fecha date;
alter table public.eventos add column if not exists ensayo_hora time;
alter table public.eventos add column if not exists nota_alabanza text;
