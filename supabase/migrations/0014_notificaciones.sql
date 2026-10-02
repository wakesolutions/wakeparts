-- =============================================================================
-- 0014 · Notificaciones y tareas pendientes
-- -----------------------------------------------------------------------------
-- La campanita del escritorio. Genérico para cualquier fuente; la primera es
-- el pedido web (0013).
--
--   · notificaciones          Por empresa. `id_usuario` null = para todos sus
--                             miembros. `es_tarea` = alguien tiene que hacer
--                             algo; queda pendiente hasta `resuelta_en`.
--                             `enlace` (jsonb) dice adónde lleva:
--                             {modulo, seccion, recurso, id}. `origen_tabla`
--                             + `origen_id` la atan a su registro.
--   · notificaciones_leidas   Quién ya la vio (por usuario).
--   · Pedidos web             Trigger: al entrar uno nace la tarea «Atender
--                             pedido web #n»; al atenderlo o descartarlo se
--                             resuelve sola (y vuelve si lo recuperan).
--   · v_notificaciones        Lo visible para el usuario, con `leida` y `pendiente`.
--   · marcar_notificaciones_leidas(empresa, ids)  null = todas.
--   · resumen_notificaciones(empresa)  {pendientes, no_leidas, ultima} para
--                             consultar barato cada pocos segundos.
--
-- Sin trigger de auditoría (0011): son avisos, no datos del negocio; el pedido
-- ya se audita.
--
-- ESTADO: YA APLICADA (confirmado 2026-10-02)
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

drop function if exists pg_temp.agregar_restriccion(regclass, text, text);
create function pg_temp.agregar_restriccion(p_tabla regclass, p_nombre text, p_def text)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = p_tabla and conname = p_nombre) then
    execute format('alter table %s add constraint %I %s', p_tabla, p_nombre, p_def);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_usuario uuid references public.usuarios (id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  enlace jsonb not null default '{}'::jsonb,
  es_tarea boolean not null default false,
  origen_tabla text,
  origen_id text,
  resuelta_en timestamptz,
  resuelta_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now()
);

create index if not exists notificaciones_empresa_idx on public.notificaciones (id_empresa, creado_en desc);
create index if not exists notificaciones_pendientes_idx on public.notificaciones (id_empresa)
  where es_tarea and resuelta_en is null;
create index if not exists notificaciones_origen_idx on public.notificaciones (origen_tabla, origen_id);
create index if not exists notificaciones_id_usuario_idx on public.notificaciones (id_usuario);
create index if not exists notificaciones_resuelta_por_idx on public.notificaciones (resuelta_por);

select pg_temp.agregar_restriccion('public.notificaciones', 'notificaciones_textos_check',
  $$check (char_length(tipo) between 1 and 40 and char_length(titulo) between 1 and 160
           and (cuerpo is null or char_length(cuerpo) <= 400) and jsonb_typeof(enlace) = 'object')$$);

create table if not exists public.notificaciones_leidas (
  id_notificacion uuid not null references public.notificaciones (id) on delete cascade,
  id_usuario uuid not null references public.usuarios (id) on delete cascade,
  leida_en timestamptz not null default now(),
  constraint notificaciones_leidas_pkey primary key (id_notificacion, id_usuario)
);

create index if not exists notificaciones_leidas_id_usuario_idx on public.notificaciones_leidas (id_usuario);

alter table public.notificaciones enable row level security;
alter table public.notificaciones_leidas enable row level security;

revoke all on public.notificaciones, public.notificaciones_leidas from anon, authenticated;
grant select on public.notificaciones, public.notificaciones_leidas to authenticated;

drop policy if exists miembros_leer on public.notificaciones;
create policy miembros_leer on public.notificaciones
  for select to authenticated
  using (public.es_miembro(id_empresa) and (id_usuario is null or id_usuario = auth.uid()));

drop policy if exists propias on public.notificaciones_leidas;
create policy propias on public.notificaciones_leidas
  for select to authenticated using (id_usuario = auth.uid());

create or replace view public.v_notificaciones with (security_invoker = true) as
select n.id,
       n.id_empresa,
       n.tipo,
       n.titulo,
       n.cuerpo,
       n.enlace,
       n.es_tarea,
       n.creado_en,
       n.resuelta_en,
       u.nombre as resuelta_por,
       (n.es_tarea and n.resuelta_en is null) as pendiente,
       exists (select 1 from public.notificaciones_leidas l
                where l.id_notificacion = n.id and l.id_usuario = auth.uid()) as leida
  from public.notificaciones n
  left join public.usuarios u on u.id = n.resuelta_por;

revoke all on public.v_notificaciones from anon, authenticated;
grant select on public.v_notificaciones to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Funciones para la app
-- -----------------------------------------------------------------------------

create or replace function public.marcar_notificaciones_leidas(p_empresa uuid, p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if auth.uid() is null or not public.es_miembro(p_empresa) then
    return 0;
  end if;
  insert into public.notificaciones_leidas (id_notificacion, id_usuario)
  select n.id, auth.uid()
    from public.notificaciones n
   where n.id_empresa = p_empresa
     and (n.id_usuario is null or n.id_usuario = auth.uid())
     and (p_ids is null or n.id = any (p_ids))
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

create or replace function public.resumen_notificaciones(p_empresa uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'pendientes', count(*) filter (where v.pendiente),
    'no_leidas', count(*) filter (where not v.leida and v.creado_en > now() - interval '30 days'),
    'ultima', max(v.creado_en)
  )
  from public.v_notificaciones v
  where v.id_empresa = p_empresa;
$$;

revoke all on function public.marcar_notificaciones_leidas(uuid, uuid[]), public.resumen_notificaciones(uuid)
  from public, anon;
grant execute on function public.marcar_notificaciones_leidas(uuid, uuid[]), public.resumen_notificaciones(uuid)
  to authenticated;

-- Limpieza: leídas y resueltas de más de 90 días (a mano o con pg_cron).
create or replace function public.limpiar_notificaciones(p_dias integer default 90)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.notificaciones n
   where n.creado_en < now() - make_interval(days => greatest(p_dias, 30))
     and (not n.es_tarea or n.resuelta_en is not null);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.limpiar_notificaciones(integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Fuente: pedidos web
-- -----------------------------------------------------------------------------

create or replace function public.tg_pedidos_web_notificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Las líneas se insertan después del pedido: el detalle va en el enlace, no en el texto.
    insert into public.notificaciones (id_empresa, tipo, titulo, cuerpo, enlace, es_tarea, origen_tabla, origen_id)
    values (new.id_empresa, 'pedido_web',
            'Pedido web #' || new.numero || ' · ' || new.cliente_nombre,
            nullif(left(concat_ws(' · ', new.vehiculo, nullif(new.mensaje, '')), 400), ''),
            jsonb_build_object('modulo', 'ventas', 'seccion', 'pedidos_web', 'recurso', 'pedidos_web', 'id', new.id),
            true, 'pedidos_web', new.id::text);
    return new;
  end if;

  if new.estado is distinct from old.estado then
    if new.estado in ('atendido', 'descartado') then
      update public.notificaciones
         set resuelta_en = now(), resuelta_por = auth.uid()
       where origen_tabla = 'pedidos_web' and origen_id = new.id::text and resuelta_en is null;
    elsif new.estado = 'nuevo' then
      update public.notificaciones
         set resuelta_en = null, resuelta_por = null
       where origen_tabla = 'pedidos_web' and origen_id = new.id::text;
    end if;
  end if;
  return new;
exception when others then
  -- Avisar es secundario: el pedido se guarda igual.
  raise warning 'tg_pedidos_web_notificar: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.tg_pedidos_web_notificar() from public, anon, authenticated;

create or replace trigger zy_notificar
  after insert or update of estado on public.pedidos_web
  for each row execute function public.tg_pedidos_web_notificar();

-- Pedidos que ya estaban sin atender antes de esta migración: su tarea.
insert into public.notificaciones (id_empresa, tipo, titulo, cuerpo, enlace, es_tarea, origen_tabla, origen_id, creado_en)
select p.id_empresa, 'pedido_web', 'Pedido web #' || p.numero || ' · ' || p.cliente_nombre,
       nullif(left(concat_ws(' · ', p.vehiculo, nullif(p.mensaje, '')), 400), ''),
       jsonb_build_object('modulo', 'ventas', 'seccion', 'pedidos_web', 'recurso', 'pedidos_web', 'id', p.id),
       true, 'pedidos_web', p.id::text, p.creado_en
  from public.pedidos_web p
 where p.estado = 'nuevo'
   and not exists (select 1 from public.notificaciones n
                    where n.origen_tabla = 'pedidos_web' and n.origen_id = p.id::text);

commit;
