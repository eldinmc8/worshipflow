-- Esquema inicial de WorshipFlow — foto EXACTA de la base de producción (proyecto oczqykwfdyfslsebinrl)
-- tomada el 2026-09-30 con consultas de solo lectura al catálogo de Postgres. Hasta esta fecha el
-- esquema vivía solo en el dashboard de Supabase; desde aquí, todo cambio de esquema va como una
-- migración nueva en supabase/migrations/ (nunca editando esta).
--
-- Reproduce tal cual lo que hay en producción, INCLUIDOS sus problemas conocidos (se arreglan en
-- migraciones siguientes, no aquí, para que este archivo siga siendo una foto fiel):
--   · roles_app, asistente_config y recordatorio_notificados tienen RLS apagado.
--   · Casi todas las tablas permiten TODO a cualquier usuario autenticado (no hay RLS por rol, p. ej.
--     sesiones_en_vivo no está restringido a Multimedia).
--
-- Los archivos sueltos supabase/schema.sql y supabase/migracion_*.sql son anteriores y están
-- desactualizados — este archivo es la referencia.

-- ===================== Extensiones =====================
create extension if not exists pg_cron with schema pg_catalog;

create extension if not exists pg_net with schema public;

create extension if not exists pg_stat_statements with schema extensions;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists supabase_vault with schema vault;

create extension if not exists "uuid-ossp" with schema extensions;

-- ===================== Tablas =====================
create table public.asignaciones_vistas (
  evento_id uuid not null,
  usuario_id uuid not null,
  visto_at timestamp with time zone default now() not null
);

create table public.asistente_config (
  id text default 'default'::text not null,
  reglas text default ''::text not null,
  actualizado_en timestamp with time zone default now() not null,
  actualizado_por uuid
);

create table public.avisos_confirmacion_enviados (
  evento_id uuid not null,
  usuario_id uuid not null,
  enviado_at timestamp with time zone default now() not null
);

create table public.canciones (
  id uuid default gen_random_uuid() not null,
  titulo text not null,
  artista text,
  tonalidad text default 'C'::text not null,
  tempo integer,
  temas text,
  categoria text default 'corito'::text not null,
  favorito boolean default false not null,
  creado_por uuid,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table public.diapositivas_letra (
  id uuid default gen_random_uuid() not null,
  cancion_id uuid not null,
  seccion_clave text not null,
  orden_en_seccion integer default 0 not null,
  texto text default ''::text not null,
  orden integer default 0 not null
);

create table public.estructura_cancion (
  id uuid default gen_random_uuid() not null,
  cancion_id uuid not null,
  orden integer not null,
  seccion_clave text not null,
  multiplicador integer default 1 not null
);

create table public.eventos (
  id uuid default gen_random_uuid() not null,
  titulo text not null,
  fecha date,
  fecha_label text,
  ubicacion text,
  creado_por uuid,
  created_at timestamp with time zone default now(),
  es_plantilla boolean default false not null,
  hora time without time zone
);

create table public.items_servicio (
  id uuid default gen_random_uuid() not null,
  evento_id uuid not null,
  tipo text not null,
  orden integer default 0 not null,
  titulo text,
  descripcion text,
  ministerio_id uuid,
  cancion_id uuid,
  tonalidad_override text,
  referencia text,
  version_biblia text,
  texto_biblia text,
  libro_id integer,
  libro_nombre text,
  capitulo integer,
  versiculo_inicio integer,
  versiculo_fin integer,
  subtitulo text,
  fondo_color text,
  fondo_tipo text default 'color'::text,
  fondo_video_url text,
  es_punto_bosquejo boolean default false not null,
  created_at timestamp with time zone default now(),
  estructura jsonb default '[]'::jsonb not null,
  fondo_imagen_url text
);

create table public.miembros_rol (
  id uuid default gen_random_uuid() not null,
  rol_id uuid,
  subgrupo text,
  nombre text not null,
  usuario_id uuid,
  estado text default 'pendiente'::text not null,
  lead boolean default false not null,
  orden integer default 0 not null,
  item_servicio_id uuid
);

create table public.ministerios (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  color text default '#E8821E'::text not null,
  creado_por uuid,
  created_at timestamp with time zone default now(),
  lider_id uuid
);

create table public.musico_en_vivo (
  id integer default 1 not null,
  lider_id text,
  song_item_id text,
  section_idx integer,
  bpm numeric,
  auto boolean,
  heartbeat timestamp with time zone,
  updated_at timestamp with time zone default now()
);

create table public.notificaciones (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  evento_id uuid,
  leido boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.planificacion_ministerio (
  id uuid default gen_random_uuid() not null,
  ministerio_id uuid not null,
  fecha date,
  titulo text,
  detalle text,
  orden integer default 0 not null
);

create table public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  usuario_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now() not null
);

create table public.recordatorio_notificados (
  recordatorio_id uuid not null,
  usuario_id uuid not null,
  notificado_at timestamp with time zone default now() not null
);

create table public.recordatorios_evento (
  id uuid default gen_random_uuid() not null,
  evento_id uuid not null,
  cantidad integer not null,
  unidad text not null,
  enviado boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table public.recursos_ministerio (
  id uuid default gen_random_uuid() not null,
  ministerio_id uuid not null,
  titulo text not null,
  enlace text,
  orden integer default 0 not null,
  mes text default to_char(now(), 'YYYY-MM'::text) not null
);

create table public.roles_app (
  id uuid default gen_random_uuid() not null,
  nombre text not null,
  permisos jsonb default '{}'::jsonb not null,
  protegido boolean default false not null,
  orden integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table public.roles_evento (
  id uuid default gen_random_uuid() not null,
  evento_id uuid not null,
  nombre text not null,
  visible_solo_admin boolean default false not null,
  orden integer default 0 not null
);

create table public.secciones_cancion (
  id uuid default gen_random_uuid() not null,
  cancion_id uuid not null,
  clave text not null,
  etiqueta text not null,
  distintivo text,
  compases integer default 8,
  contenido text default ''::text
);

create table public.sesiones_en_vivo (
  id smallint default 1 not null,
  evento_id uuid,
  liderado_por uuid,
  slide_actual jsonb,
  blanked boolean default false not null,
  estilo_en_vivo jsonb,
  ad_hoc_label text,
  updated_at timestamp with time zone default now(),
  libre boolean default false not null
);

create table public.usuarios (
  id uuid not null,
  email text not null,
  nombre text not null,
  rol text not null,
  estado text default 'activo'::text not null,
  created_at timestamp with time zone default now(),
  perfil_completo boolean default true not null,
  foto_url text,
  rol_id uuid
);

-- ===================== Llaves primarias, únicas y checks =====================
alter table public.asignaciones_vistas add constraint asignaciones_vistas_pkey PRIMARY KEY (evento_id, usuario_id);

alter table public.asistente_config add constraint asistente_config_pkey PRIMARY KEY (id);

alter table public.avisos_confirmacion_enviados add constraint avisos_confirmacion_enviados_pkey PRIMARY KEY (evento_id, usuario_id);

alter table public.canciones add constraint canciones_categoria_check CHECK ((categoria = ANY (ARRAY['himno'::text, 'corito'::text, 'especial'::text, 'adoracion'::text])));

alter table public.canciones add constraint canciones_pkey PRIMARY KEY (id);

alter table public.diapositivas_letra add constraint diapositivas_letra_pkey PRIMARY KEY (id);

alter table public.estructura_cancion add constraint estructura_cancion_pkey PRIMARY KEY (id);

alter table public.eventos add constraint eventos_pkey PRIMARY KEY (id);

alter table public.items_servicio add constraint items_servicio_fondo_tipo_check CHECK ((fondo_tipo = ANY (ARRAY['color'::text, 'video'::text])));

alter table public.items_servicio add constraint items_servicio_tipo_check CHECK ((tipo = ANY (ARRAY['bloque'::text, 'cancion'::text, 'biblia'::text, 'slide'::text])));

alter table public.items_servicio add constraint items_servicio_pkey PRIMARY KEY (id);

alter table public.miembros_rol add constraint miembros_rol_estado_check CHECK ((estado = ANY (ARRAY['pendiente'::text, 'confirmado'::text, 'rechazado'::text])));

alter table public.miembros_rol add constraint miembros_rol_rol_o_item_check CHECK ((((rol_id IS NOT NULL) AND (item_servicio_id IS NULL)) OR ((rol_id IS NULL) AND (item_servicio_id IS NOT NULL))));

alter table public.miembros_rol add constraint miembros_rol_pkey PRIMARY KEY (id);

alter table public.ministerios add constraint ministerios_pkey PRIMARY KEY (id);

alter table public.musico_en_vivo add constraint musico_en_vivo_single_row CHECK ((id = 1));

alter table public.musico_en_vivo add constraint musico_en_vivo_pkey PRIMARY KEY (id);

alter table public.notificaciones add constraint notificaciones_tipo_check CHECK ((tipo = ANY (ARRAY['asignacion'::text, 'recordatorio'::text, 'general'::text])));

alter table public.notificaciones add constraint notificaciones_pkey PRIMARY KEY (id);

alter table public.planificacion_ministerio add constraint planificacion_ministerio_pkey PRIMARY KEY (id);

alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);

alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);

alter table public.recordatorio_notificados add constraint recordatorio_notificados_pkey PRIMARY KEY (recordatorio_id, usuario_id);

alter table public.recordatorios_evento add constraint recordatorios_evento_cantidad_check CHECK ((cantidad > 0));

alter table public.recordatorios_evento add constraint recordatorios_evento_unidad_check CHECK ((unidad = ANY (ARRAY['horas'::text, 'dias'::text])));

alter table public.recordatorios_evento add constraint recordatorios_evento_pkey PRIMARY KEY (id);

alter table public.recursos_ministerio add constraint recursos_ministerio_pkey PRIMARY KEY (id);

alter table public.roles_app add constraint roles_app_pkey PRIMARY KEY (id);

alter table public.roles_app add constraint roles_app_nombre_key UNIQUE (nombre);

alter table public.roles_evento add constraint roles_evento_pkey PRIMARY KEY (id);

alter table public.secciones_cancion add constraint secciones_cancion_pkey PRIMARY KEY (id);

alter table public.secciones_cancion add constraint secciones_cancion_cancion_id_clave_key UNIQUE (cancion_id, clave);

alter table public.sesiones_en_vivo add constraint sesiones_en_vivo_id_check CHECK ((id = 1));

alter table public.sesiones_en_vivo add constraint sesiones_en_vivo_pkey PRIMARY KEY (id);

alter table public.usuarios add constraint usuarios_estado_check CHECK ((estado = ANY (ARRAY['activo'::text, 'inactivo'::text])));

alter table public.usuarios add constraint usuarios_rol_check CHECK ((rol = ANY (ARRAY['admin'::text, 'multimedia'::text, 'musico'::text, 'miembro'::text, 'supervisor'::text])));

alter table public.usuarios add constraint usuarios_pkey PRIMARY KEY (id);

alter table public.usuarios add constraint usuarios_email_key UNIQUE (email);

-- ===================== Llaves foráneas =====================
alter table public.asignaciones_vistas add constraint asignaciones_vistas_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;

alter table public.asignaciones_vistas add constraint asignaciones_vistas_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

alter table public.asistente_config add constraint asistente_config_actualizado_por_fkey FOREIGN KEY (actualizado_por) REFERENCES usuarios(id);

alter table public.avisos_confirmacion_enviados add constraint avisos_confirmacion_enviados_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;

alter table public.avisos_confirmacion_enviados add constraint avisos_confirmacion_enviados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

alter table public.canciones add constraint canciones_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

alter table public.diapositivas_letra add constraint diapositivas_letra_cancion_id_fkey FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE CASCADE;

alter table public.estructura_cancion add constraint estructura_cancion_cancion_id_fkey FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE CASCADE;

alter table public.eventos add constraint eventos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

alter table public.items_servicio add constraint items_servicio_cancion_id_fkey FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE SET NULL;

alter table public.items_servicio add constraint items_servicio_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;

alter table public.items_servicio add constraint items_servicio_ministerio_id_fkey FOREIGN KEY (ministerio_id) REFERENCES ministerios(id) ON DELETE SET NULL;

alter table public.miembros_rol add constraint miembros_rol_item_servicio_id_fkey FOREIGN KEY (item_servicio_id) REFERENCES items_servicio(id) ON DELETE CASCADE;

alter table public.miembros_rol add constraint miembros_rol_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES roles_evento(id) ON DELETE CASCADE;

alter table public.miembros_rol add constraint miembros_rol_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL;

alter table public.ministerios add constraint ministerios_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

alter table public.ministerios add constraint ministerios_lider_id_fkey FOREIGN KEY (lider_id) REFERENCES usuarios(id) ON DELETE SET NULL;

alter table public.notificaciones add constraint notificaciones_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL;

alter table public.notificaciones add constraint notificaciones_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

alter table public.planificacion_ministerio add constraint planificacion_ministerio_ministerio_id_fkey FOREIGN KEY (ministerio_id) REFERENCES ministerios(id) ON DELETE CASCADE;

alter table public.push_subscriptions add constraint push_subscriptions_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE;

alter table public.recordatorio_notificados add constraint recordatorio_notificados_recordatorio_id_fkey FOREIGN KEY (recordatorio_id) REFERENCES recordatorios_evento(id) ON DELETE CASCADE;

alter table public.recordatorios_evento add constraint recordatorios_evento_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;

alter table public.recursos_ministerio add constraint recursos_ministerio_ministerio_id_fkey FOREIGN KEY (ministerio_id) REFERENCES ministerios(id) ON DELETE CASCADE;

alter table public.roles_evento add constraint roles_evento_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE;

alter table public.secciones_cancion add constraint secciones_cancion_cancion_id_fkey FOREIGN KEY (cancion_id) REFERENCES canciones(id) ON DELETE CASCADE;

alter table public.sesiones_en_vivo add constraint sesiones_en_vivo_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL;

alter table public.sesiones_en_vivo add constraint sesiones_en_vivo_liderado_por_fkey FOREIGN KEY (liderado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

alter table public.usuarios add constraint usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table public.usuarios add constraint usuarios_rol_id_fkey FOREIGN KEY (rol_id) REFERENCES roles_app(id);

-- ===================== Índices =====================
CREATE INDEX notificaciones_usuario_id_leido_idx ON public.notificaciones USING btree (usuario_id, leido);

CREATE INDEX push_subscriptions_usuario_id_idx ON public.push_subscriptions USING btree (usuario_id);

CREATE INDEX recordatorios_evento_evento_id_idx ON public.recordatorios_evento USING btree (evento_id);

-- ===================== Row Level Security =====================
alter table public.asignaciones_vistas enable row level security;

alter table public.avisos_confirmacion_enviados enable row level security;

alter table public.canciones enable row level security;

alter table public.diapositivas_letra enable row level security;

alter table public.estructura_cancion enable row level security;

alter table public.eventos enable row level security;

alter table public.items_servicio enable row level security;

alter table public.miembros_rol enable row level security;

alter table public.ministerios enable row level security;

alter table public.musico_en_vivo enable row level security;

alter table public.notificaciones enable row level security;

alter table public.planificacion_ministerio enable row level security;

alter table public.push_subscriptions enable row level security;

alter table public.recordatorios_evento enable row level security;

alter table public.recursos_ministerio enable row level security;

alter table public.roles_evento enable row level security;

alter table public.secciones_cancion enable row level security;

alter table public.sesiones_en_vivo enable row level security;

alter table public.usuarios enable row level security;

-- ===================== Políticas =====================
create policy asignaciones_vistas_insert on public.asignaciones_vistas as PERMISSIVE for INSERT to authenticated
  with check ((usuario_id = auth.uid()));

create policy asignaciones_vistas_select on public.asignaciones_vistas as PERMISSIVE for SELECT to authenticated
  using (true);

create policy asignaciones_vistas_update on public.asignaciones_vistas as PERMISSIVE for UPDATE to authenticated
  using ((usuario_id = auth.uid()))
  with check ((usuario_id = auth.uid()));

create policy avisos_confirmacion_select on public.avisos_confirmacion_enviados as PERMISSIVE for SELECT to authenticated
  using (true);

create policy "autenticados: todo en canciones" on public.canciones as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en diapositivas_letra" on public.diapositivas_letra as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en estructura_cancion" on public.estructura_cancion as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en eventos" on public.eventos as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en items_servicio" on public.items_servicio as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en miembros_rol" on public.miembros_rol as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en ministerios" on public.ministerios as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy musico_en_vivo_select on public.musico_en_vivo as PERMISSIVE for SELECT to authenticated
  using (true);

create policy musico_en_vivo_update on public.musico_en_vivo as PERMISSIVE for UPDATE to authenticated
  using (true)
  with check (true);

create policy "propias: leer" on public.notificaciones as PERMISSIVE for SELECT to public
  using ((usuario_id = auth.uid()));

create policy "propias: marcar leida" on public.notificaciones as PERMISSIVE for UPDATE to public
  using ((usuario_id = auth.uid()))
  with check ((usuario_id = auth.uid()));

create policy "autenticados: todo en planificacion_ministerio" on public.planificacion_ministerio as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "propias: borrar" on public.push_subscriptions as PERMISSIVE for DELETE to public
  using ((usuario_id = auth.uid()));

create policy "propias: insertar" on public.push_subscriptions as PERMISSIVE for INSERT to public
  with check ((usuario_id = auth.uid()));

create policy "propias: leer" on public.push_subscriptions as PERMISSIVE for SELECT to public
  using ((usuario_id = auth.uid()));

create policy "autenticados: todo en recordatorios_evento" on public.recordatorios_evento as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en recursos_ministerio" on public.recursos_ministerio as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en roles_evento" on public.roles_evento as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados: todo en secciones_cancion" on public.secciones_cancion as PERMISSIVE for ALL to public
  using ((auth.role() = 'authenticated'::text))
  with check ((auth.role() = 'authenticated'::text));

create policy "autenticados actualizan la sesión en vivo" on public.sesiones_en_vivo as PERMISSIVE for UPDATE to public
  using ((auth.role() = 'authenticated'::text));

create policy "autenticados escriben la sesión en vivo" on public.sesiones_en_vivo as PERMISSIVE for INSERT to public
  with check ((auth.role() = 'authenticated'::text));

create policy "cualquiera lee la sesión en vivo" on public.sesiones_en_vivo as PERMISSIVE for SELECT to public
  using (true);

create policy "admins editan todo" on public.usuarios as PERMISSIVE for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM usuarios u
  WHERE ((u.id = auth.uid()) AND (u.rol = 'admin'::text)))));

create policy "autenticados ven todos los usuarios" on public.usuarios as PERMISSIVE for SELECT to public
  using ((auth.role() = 'authenticated'::text));

create policy "ver propio usuario" on public.usuarios as PERMISSIVE for SELECT to public
  using ((auth.uid() = id));

-- ===================== Realtime =====================
alter publication supabase_realtime add table public.asignaciones_vistas;

alter publication supabase_realtime add table public.canciones;

alter publication supabase_realtime add table public.diapositivas_letra;

alter publication supabase_realtime add table public.estructura_cancion;

alter publication supabase_realtime add table public.eventos;

alter publication supabase_realtime add table public.items_servicio;

alter publication supabase_realtime add table public.miembros_rol;

alter publication supabase_realtime add table public.ministerios;

alter publication supabase_realtime add table public.musico_en_vivo;

alter publication supabase_realtime add table public.notificaciones;

alter publication supabase_realtime add table public.planificacion_ministerio;

alter publication supabase_realtime add table public.recordatorios_evento;

alter publication supabase_realtime add table public.recursos_ministerio;

alter publication supabase_realtime add table public.roles_evento;

alter publication supabase_realtime add table public.secciones_cancion;

alter publication supabase_realtime add table public.sesiones_en_vivo;

-- ===================== Datos base (filas únicas que la app espera que existan) =====================
insert into public.sesiones_en_vivo (id) values (1) on conflict (id) do nothing;

insert into public.musico_en_vivo (id) values (1) on conflict (id) do nothing;

insert into public.asistente_config (id) values ('default') on conflict (id) do nothing;

insert into public.roles_app (nombre, protegido, permisos, orden) values ('Administrador', true, '{"gestionar_roles":true,"usar_asistente_ia":true,"ver_todos_eventos":true,"gestionar_usuarios":true,"controlar_estilo_vivo":true,"editar_eventos_setlist":true,"iniciar_finalizar_vivo":true}'::jsonb, 0) on conflict (nombre) do nothing;

insert into public.roles_app (nombre, protegido, permisos, orden) values ('Multimedia', false, '{"controlar_estilo_vivo":true,"iniciar_finalizar_vivo":true}'::jsonb, 1) on conflict (nombre) do nothing;

insert into public.roles_app (nombre, protegido, permisos, orden) values ('Músico', false, '{}'::jsonb, 2) on conflict (nombre) do nothing;

insert into public.roles_app (nombre, protegido, permisos, orden) values ('Miembro', false, '{}'::jsonb, 3) on conflict (nombre) do nothing;

insert into public.roles_app (nombre, protegido, permisos, orden) values ('Supervisor', false, '{"ver_todos_eventos":true}'::jsonb, 4) on conflict (nombre) do nothing;

-- ===================== Tarea programada (pg_cron) =====================
-- Comentada a propósito: lleva la clave anon y el CRON_SECRET, que NO van al repositorio. Para
-- recrearla en otro proyecto, reemplazar <ANON_KEY>/<CRON_SECRET> y la URL por los de ese proyecto.
-- select cron.schedule('procesar-recordatorios-evento', '*/15 * * * *', $cron$
--   select net.http_post(
--     url := 'https://oczqykwfdyfslsebinrl.supabase.co/functions/v1/procesar-recordatorios',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'apikey', '<ANON_KEY>',
--       'Authorization', 'Bearer <ANON_KEY>',
--       'x-cron-secret', '<CRON_SECRET>'
--     ),
--     body := '{}'::jsonb
--   );
--   $cron$);
