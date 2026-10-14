-- =============================================================================
-- 0023 · Planes por empresa, límites configurables y permisos por rol
-- -----------------------------------------------------------------------------
-- Solo para el admin de plataforma (los talleres no ven nada de esto todavía:
-- sin pasarela de pagos ni pantalla de planes para el usuario).
--
--   · planes              Básico (gratis), Avanzado y Business. Cada plan dice
--                         qué módulos incluye (`modulos`) y sus límites
--                         (`limites` jsonb: clave → número; sin clave o null =
--                         sin límite). Uno es el predeterminado para las
--                         empresas nuevas. Lo edita solo el admin de plataforma.
--   · empresas_planes     Plan asignado a cada empresa. Las existentes quedan en
--                         Business (no cambia nada para ellas); las nuevas toman
--                         el predeterminado (Business hasta que el admin diga).
--   · permisos_roles      Qué módulos y capacidades tiene cada rol (admin,
--                         vendedor). El dueño siempre tiene todo. Sin fila = lo
--                         que trae la app (lib/permisos.ts).
--   · mi_plan(empresa)    Módulos y límites efectivos de una empresa, para sus
--                         miembros (sin exponer la tabla de planes).
--   · uso_planes_empresas() Una fila por empresa con su plan y su consumo
--                         (solo admin de plataforma).
--   · Límites en la base: triggers que rechazan el alta cuando se llega al tope
--                         (productos, clientes, proveedores, puntos de emisión,
--                         usuarios, fotos por producto, facturas y cotizaciones
--                         del mes). Mensaje P0001 sin mencionar el plan.
--
-- Claves de límite: productos, clientes, proveedores, puntos_emision, usuarios,
-- fotos_por_producto, facturas_mes, cotizaciones_mes.
--
-- ESTADO: YA APLICADA (confirmado 2026-10-14)
-- Idempotente y transaccional: se puede ejecutar más de una vez. Los planes
-- semilla se insertan solo si no existen (no pisa lo que edite el admin).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Planes
-- -----------------------------------------------------------------------------

create table if not exists public.planes (
  codigo text primary key,
  nombre text not null,
  descripcion text,
  precio_mensual numeric(12, 2),
  orden smallint not null default 0,
  modulos text[] not null default '{}',
  limites jsonb not null default '{}'::jsonb,
  predeterminado boolean not null default false,
  activo boolean not null default true,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.usuarios (id) on delete set null default auth.uid()
);

create index if not exists planes_actualizado_por_idx on public.planes (actualizado_por);
create unique index if not exists planes_predeterminado_key on public.planes (predeterminado) where predeterminado;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.planes'::regclass
                  and conname = 'planes_codigo_check') then
    alter table public.planes add constraint planes_codigo_check check (codigo ~ '^[a-z0-9_]{2,30}$');
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.planes'::regclass
                  and conname = 'planes_limites_check') then
    alter table public.planes add constraint planes_limites_check check (jsonb_typeof(limites) = 'object');
  end if;
end $$;

insert into public.planes (codigo, nombre, descripcion, precio_mensual, orden, modulos, limites, predeterminado) values
  ('basico', 'Básico', 'Gratis: mostrador, inventario y ventas para un taller pequeño.', 0, 1,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'ventas', 'mantenimiento', 'usuarios', 'taller', 'mi-usuario'],
   '{"productos": 150, "clientes": 100, "proveedores": 10, "puntos_emision": 1, "usuarios": 2,
     "fotos_por_producto": 2, "facturas_mes": 100, "cotizaciones_mes": 200}'::jsonb, false),
  ('avanzado', 'Avanzado', 'Con costo: compras, notas, sitio web y más volumen.', null, 2,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'compras', 'ventas', 'notas', 'sitio', 'mantenimiento',
         'usuarios', 'actividad', 'taller', 'mi-usuario'],
   '{"productos": 3000, "clientes": 2000, "proveedores": 200, "puntos_emision": 3, "usuarios": 5,
     "fotos_por_producto": 5, "facturas_mes": 2000, "cotizaciones_mes": null}'::jsonb, false),
  ('business', 'Business', 'Completo: todos los módulos, sin límites.', null, 3,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'compras', 'ventas', 'notas', 'contabilidad', 'sitio',
         'mantenimiento', 'usuarios', 'actividad', 'taller', 'mi-usuario'],
   '{}'::jsonb, true)
on conflict (codigo) do nothing;

-- Si ninguno quedó como predeterminado (p. ej. el admin lo desmarcó a mano), Business.
update public.planes set predeterminado = true
 where codigo = 'business' and not exists (select 1 from public.planes where predeterminado);

alter table public.planes enable row level security;
revoke all on public.planes from anon, authenticated;
grant select, insert, update, delete on public.planes to authenticated;

drop policy if exists admin_plataforma on public.planes;
create policy admin_plataforma on public.planes
  for all to authenticated
  using (public.es_admin_plataforma())
  with check (public.es_admin_plataforma());

-- -----------------------------------------------------------------------------
-- 2. Plan de cada empresa
-- -----------------------------------------------------------------------------

create table if not exists public.empresas_planes (
  id_empresa uuid primary key references public.empresas (id) on delete cascade,
  plan text not null references public.planes (codigo) on update cascade,
  nota text,
  asignado_en timestamptz not null default now(),
  asignado_por uuid references public.usuarios (id) on delete set null default auth.uid()
);

create index if not exists empresas_planes_plan_idx on public.empresas_planes (plan);
create index if not exists empresas_planes_asignado_por_idx on public.empresas_planes (asignado_por);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.empresas_planes'::regclass
                  and conname = 'empresas_planes_nota_check') then
    alter table public.empresas_planes
      add constraint empresas_planes_nota_check check (nota is null or char_length(nota) <= 500);
  end if;
end $$;

-- Las empresas que ya existen quedan en Business: no pierden nada.
insert into public.empresas_planes (id_empresa, plan, nota, asignado_por)
select e.id, 'business', 'Asignado al crear los planes (0023)', null
  from public.empresas e
 where not exists (select 1 from public.empresas_planes p where p.id_empresa = e.id);

alter table public.empresas_planes enable row level security;
revoke all on public.empresas_planes from anon, authenticated;
grant select, insert, update, delete on public.empresas_planes to authenticated;

drop policy if exists admin_plataforma on public.empresas_planes;
create policy admin_plataforma on public.empresas_planes
  for all to authenticated
  using (public.es_admin_plataforma())
  with check (public.es_admin_plataforma());

-- Empresa nueva → plan predeterminado.
create or replace function public.asignar_plan_predeterminado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
begin
  select codigo into v_plan from public.planes where predeterminado and activo limit 1;
  if v_plan is null then
    select codigo into v_plan from public.planes where activo order by orden desc limit 1;
  end if;
  if v_plan is not null then
    insert into public.empresas_planes (id_empresa, plan, asignado_por)
    values (new.id, v_plan, null)
    on conflict (id_empresa) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.asignar_plan_predeterminado() from public, anon, authenticated;

create or replace trigger asignar_plan_predeterminado
  after insert on public.empresas
  for each row execute function public.asignar_plan_predeterminado();

-- -----------------------------------------------------------------------------
-- 3. Permisos por rol
-- -----------------------------------------------------------------------------

create table if not exists public.permisos_roles (
  rol text primary key references public.roles (codigo) on delete cascade,
  permisos text[] not null default '{}',
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.usuarios (id) on delete set null default auth.uid()
);

create index if not exists permisos_roles_actualizado_por_idx on public.permisos_roles (actualizado_por);

alter table public.permisos_roles enable row level security;
revoke all on public.permisos_roles from anon, authenticated;
grant select, insert, update, delete on public.permisos_roles to authenticated;

-- Todos los usuarios leen (la app arma el escritorio con esto); solo el admin escribe.
drop policy if exists permisos_roles_lectura on public.permisos_roles;
create policy permisos_roles_lectura on public.permisos_roles
  for select to authenticated
  using (true);

drop policy if exists admin_plataforma on public.permisos_roles;
drop policy if exists permisos_roles_escritura on public.permisos_roles;
create policy permisos_roles_escritura on public.permisos_roles
  for all to authenticated
  using (public.es_admin_plataforma())
  with check (public.es_admin_plataforma() and rol <> 'dueno');

-- -----------------------------------------------------------------------------
-- 4. Plan efectivo y límites
-- -----------------------------------------------------------------------------

create or replace function public.plan_de_empresa(p_empresa uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ep.plan from public.empresas_planes ep where ep.id_empresa = p_empresa),
    (select p.codigo from public.planes p where p.predeterminado limit 1),
    'business'
  );
$$;

revoke execute on function public.plan_de_empresa(uuid) from public, anon;

/** Límite de una clave para la empresa; null = sin límite. */
create or replace function public.limite_plan(p_empresa uuid, p_clave text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when jsonb_typeof(p.limites -> p_clave) = 'number' then (p.limites ->> p_clave)::numeric::integer
           else null
         end
    from public.planes p
   where p.codigo = public.plan_de_empresa(p_empresa);
$$;

revoke execute on function public.limite_plan(uuid, text) from public, anon;

/** Para los miembros: módulos y límites efectivos de su empresa (sin nombre del plan). */
create or replace function public.mi_plan(p_empresa uuid)
returns table (modulos text[], limites jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select p.modulos, p.limites
    from public.planes p
   where p.codigo = public.plan_de_empresa(p_empresa)
     and (public.es_miembro(p_empresa) or public.es_admin_plataforma());
$$;

revoke execute on function public.mi_plan(uuid) from public, anon;
grant execute on function public.mi_plan(uuid) to authenticated;

/** Lanza P0001 si `p_usado` ya llegó al límite de `p_clave`. */
create or replace function public.verificar_limite_plan(p_empresa uuid, p_clave text, p_usado bigint, p_que text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite integer := public.limite_plan(p_empresa, p_clave);
begin
  if v_limite is not null and p_usado >= v_limite then
    raise exception 'Llegaste al límite de % de tu cuenta (%). Escribinos para ampliarlo.', p_que, v_limite
      using errcode = 'P0001', hint = 'limite_plan:' || p_clave;
  end if;
end;
$$;

revoke execute on function public.verificar_limite_plan(uuid, text, bigint, text) from public, anon, authenticated;

-- Trigger genérico para tablas con id_empresa + activo (productos, clientes,
-- proveedores, puntos de emisión). TG_ARGV: clave del límite, texto para el mensaje.
create or replace function public.limite_plan_activos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usado bigint;
begin
  if not new.activo or (tg_op = 'UPDATE' and old.activo) then
    return new;
  end if;
  execute format('select count(*) from public.%I where id_empresa = $1 and activo', tg_table_name)
    into v_usado using new.id_empresa;
  perform public.verificar_limite_plan(new.id_empresa, tg_argv[0], v_usado, tg_argv[1]);
  return new;
end;
$$;

revoke execute on function public.limite_plan_activos() from public, anon, authenticated;

create or replace trigger limite_plan
  before insert or update of activo on public.productos
  for each row execute function public.limite_plan_activos('productos', 'productos');

create or replace trigger limite_plan
  before insert or update of activo on public.clientes
  for each row execute function public.limite_plan_activos('clientes', 'clientes');

do $$ begin
  if to_regclass('public.puntos_emision') is not null then
    execute 'create or replace trigger limite_plan before insert or update of activo on public.puntos_emision '
         || 'for each row execute function public.limite_plan_activos(''puntos_emision'', ''puntos de emisión'')';
  end if;
  if to_regclass('public.proveedores') is not null then
    execute 'create or replace trigger limite_plan before insert or update of activo on public.proveedores '
         || 'for each row execute function public.limite_plan_activos(''proveedores'', ''proveedores'')';
  end if;
end $$;

-- Fotos por producto.
create or replace function public.limite_plan_fotos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.verificar_limite_plan(
    new.id_empresa, 'fotos_por_producto',
    (select count(*) from public.productos_imagenes i where i.id_producto = new.id_producto),
    'fotos por producto');
  return new;
end;
$$;

revoke execute on function public.limite_plan_fotos() from public, anon, authenticated;

create or replace trigger limite_plan
  before insert on public.productos_imagenes
  for each row execute function public.limite_plan_fotos();

-- Facturas y cotizaciones del mes (hora de Honduras).
create or replace function public.limite_plan_documentos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := date_trunc('month', now() at time zone 'America/Tegucigalpa') at time zone 'America/Tegucigalpa';
begin
  if new.tipo not in ('factura', 'cotizacion') then
    return new;
  end if;
  perform public.verificar_limite_plan(
    new.id_empresa,
    case new.tipo when 'factura' then 'facturas_mes' else 'cotizaciones_mes' end,
    (select count(*) from public.documentos d
      where d.id_empresa = new.id_empresa and d.tipo = new.tipo and d.fecha >= v_desde),
    case new.tipo when 'factura' then 'facturas del mes' else 'cotizaciones del mes' end);
  return new;
end;
$$;

revoke execute on function public.limite_plan_documentos() from public, anon, authenticated;

create or replace trigger limite_plan
  before insert on public.documentos
  for each row execute function public.limite_plan_documentos();

-- Usuarios: al invitar cuentan los miembros activos + invitaciones pendientes;
-- al entrar a la empresa, los miembros activos (la invitación ya reservó el lugar).
create or replace function public.limite_plan_usuarios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usado bigint;
begin
  if tg_table_name = 'invitaciones' then
    v_usado := (select count(*) from public.empresas_usuarios m where m.id_empresa = new.id_empresa and m.activo)
             + (select count(*) from public.invitaciones i where i.id_empresa = new.id_empresa and i.aceptada_en is null);
  else
    if not new.activo or (tg_op = 'UPDATE' and old.activo) then
      return new;
    end if;
    v_usado := (select count(*) from public.empresas_usuarios m where m.id_empresa = new.id_empresa and m.activo);
  end if;
  perform public.verificar_limite_plan(new.id_empresa, 'usuarios', v_usado, 'usuarios');
  return new;
end;
$$;

revoke execute on function public.limite_plan_usuarios() from public, anon, authenticated;

create or replace trigger limite_plan
  before insert on public.invitaciones
  for each row execute function public.limite_plan_usuarios();

create or replace trigger limite_plan
  before insert or update of activo on public.empresas_usuarios
  for each row execute function public.limite_plan_usuarios();

-- -----------------------------------------------------------------------------
-- 5. Consumo por empresa (admin de plataforma)
-- -----------------------------------------------------------------------------

create or replace function public.uso_planes_empresas()
returns table (
  id_empresa uuid,
  empresa text,
  plan text,
  plan_nombre text,
  asignado_en timestamptz,
  nota text,
  productos integer,
  clientes integer,
  proveedores integer,
  puntos_emision integer,
  usuarios integer,
  facturas_mes integer,
  cotizaciones_mes integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_desde timestamptz := date_trunc('month', now() at time zone 'America/Tegucigalpa') at time zone 'America/Tegucigalpa';
  v_prov boolean := to_regclass('public.proveedores') is not null;
  v_pe boolean := to_regclass('public.puntos_emision') is not null;
begin
  if not public.es_admin_plataforma() then
    return;
  end if;

  return query
  select e.id,
         e.nombre,
         public.plan_de_empresa(e.id),
         (select p.nombre from public.planes p where p.codigo = public.plan_de_empresa(e.id)),
         ep.asignado_en,
         ep.nota,
         (select count(*) from public.productos x where x.id_empresa = e.id and x.activo)::integer,
         (select count(*) from public.clientes x where x.id_empresa = e.id and x.activo)::integer,
         case when v_prov then public.contar_activos('proveedores', e.id) end,
         case when v_pe then public.contar_activos('puntos_emision', e.id) end,
         (select count(*) from public.empresas_usuarios m where m.id_empresa = e.id and m.activo)::integer,
         (select count(*) from public.documentos d where d.id_empresa = e.id and d.tipo = 'factura' and d.fecha >= v_desde)::integer,
         (select count(*) from public.documentos d where d.id_empresa = e.id and d.tipo = 'cotizacion' and d.fecha >= v_desde)::integer
    from public.empresas e
    left join public.empresas_planes ep on ep.id_empresa = e.id
   where e.activo
   order by e.creado_en desc;
end;
$$;

-- Cuenta filas activas de una tabla que puede no existir todavía (0021 opcional).
create or replace function public.contar_activos(p_tabla text, p_empresa uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  if p_tabla not in ('proveedores', 'puntos_emision') or to_regclass('public.' || p_tabla) is null then
    return null;
  end if;
  execute format('select count(*)::integer from public.%I where id_empresa = $1 and activo', p_tabla)
    into v using p_empresa;
  return v;
end;
$$;

revoke execute on function public.contar_activos(text, uuid) from public, anon, authenticated;
revoke execute on function public.uso_planes_empresas() from public, anon;
grant execute on function public.uso_planes_empresas() to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Auditoría (0011)
-- -----------------------------------------------------------------------------

do $$ begin
  if to_regprocedure('public.registrar_cambio()') is not null then
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.planes '
         || 'for each row execute function public.registrar_cambio()';
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.empresas_planes '
         || 'for each row execute function public.registrar_cambio()';
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.permisos_roles '
         || 'for each row execute function public.registrar_cambio()';
  end if;
end $$;

comment on table public.planes is 'Planes (Básico, Avanzado, Business): módulos incluidos y límites. Solo admin de plataforma.';
comment on table public.empresas_planes is 'Plan asignado a cada empresa. Sin fila = plan predeterminado.';
comment on table public.permisos_roles is 'Módulos y capacidades por rol (admin, vendedor). El dueño siempre tiene todo.';

commit;
