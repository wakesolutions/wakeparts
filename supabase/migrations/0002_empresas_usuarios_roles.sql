-- =============================================================================
-- 0002 · Empresas, usuarios, roles, preferencias y vistas del catálogo
-- -----------------------------------------------------------------------------
-- ESTADO: YA APLICADA (2026-09-28)
-- Idempotente y atómica.
--
-- Qué crea:
--   · roles                 Catálogo de roles (dueno, admin, vendedor).
--   · empresas              Tenant. Incluye la paleta visual.
--   · usuarios              Perfil 1:1 con auth.users (se crea solo por trigger).
--   · empresas_usuarios     Membresía usuario ↔ empresa con rol.
--   · preferencias_tablas   Configuración de columnas/orden por usuario y tabla.
--   · crear_empresa()       RPC del onboarding: crea empresa + membresía de dueño.
--   · Helpers de RLS        es_miembro, tiene_rol, es_admin_plataforma, comparte_empresa.
--   · Vistas v_*            Catálogo de vehículos "aplanado" para la tabla maestra.
--   · Escritura del catálogo global solo para administradores de la plataforma.
--   · Marca como admin de plataforma a miltonbarrientos2@gmail.com.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Tablas
-- -----------------------------------------------------------------------------

create table if not exists public.roles (
  codigo text primary key,
  nombre text not null,
  descripcion text,
  orden smallint not null default 0
);

insert into public.roles (codigo, nombre, descripcion, orden) values
  ('dueno',    'Dueño',         'Control total de la empresa: datos, usuarios, facturación.', 1),
  ('admin',    'Administrador', 'Gestiona inventario, catálogo y usuarios (no puede quitar al dueño).', 2),
  ('vendedor', 'Vendedor',      'Vende, factura y consulta inventario.', 3)
on conflict (codigo) do update
  set nombre = excluded.nombre, descripcion = excluded.descripcion, orden = excluded.orden;

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  razon_social text,
  rtn text,
  telefono text,
  correo text,
  direccion text,
  paleta text not null default 'rojo-negro',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null
);

create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null,
  nombre text,
  avatar_url text,
  id_empresa_activa uuid references public.empresas (id) on delete set null,
  es_admin_plataforma boolean not null default false,
  creado_en timestamptz not null default now()
);

create table if not exists public.empresas_usuarios (
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_usuario uuid not null references public.usuarios (id) on delete cascade,
  rol text not null references public.roles (codigo),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  constraint empresas_usuarios_pkey primary key (id_empresa, id_usuario)
);

create table if not exists public.preferencias_tablas (
  id_usuario uuid not null references public.usuarios (id) on delete cascade,
  clave text not null,
  config jsonb not null default '{}'::jsonb,
  actualizado_en timestamptz not null default now(),
  constraint preferencias_tablas_pkey primary key (id_usuario, clave)
);

-- Índices de FKs
create index if not exists empresas_creado_por_idx on public.empresas (creado_por);
create index if not exists usuarios_id_empresa_activa_idx on public.usuarios (id_empresa_activa);
create index if not exists empresas_usuarios_id_usuario_idx on public.empresas_usuarios (id_usuario);
create index if not exists empresas_usuarios_rol_idx on public.empresas_usuarios (rol);

-- Restricciones
create or replace function pg_temp.agregar_restriccion(tabla regclass, nombre text, definicion text)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = tabla and conname = nombre) then
    execute format('alter table %s add constraint %I %s', tabla, nombre, definicion);
  end if;
end;
$$;

select pg_temp.agregar_restriccion('public.empresas', 'empresas_nombre_check',
  $$check (btrim(nombre) <> '' and char_length(nombre) <= 120)$$);
select pg_temp.agregar_restriccion('public.empresas', 'empresas_rtn_check',
  $$check (rtn is null or rtn ~ '^\d{14}$')$$);
select pg_temp.agregar_restriccion('public.empresas', 'empresas_correo_check',
  $$check (correo is null or correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')$$);
select pg_temp.agregar_restriccion('public.empresas', 'empresas_paleta_check',
  $$check (paleta in ('rojo-negro', 'rojo-blanco'))$$);
select pg_temp.agregar_restriccion('public.preferencias_tablas', 'preferencias_tablas_clave_check',
  $$check (clave ~ '^[a-z0-9_:.-]{1,80}$')$$);

-- -----------------------------------------------------------------------------
-- 2. Funciones de apoyo para RLS (security definer: evitan recursión de políticas)
-- -----------------------------------------------------------------------------

create or replace function public.es_miembro(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.empresas_usuarios
     where id_empresa = p_empresa and id_usuario = (select auth.uid()) and activo
  );
$$;

create or replace function public.tiene_rol(p_empresa uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.empresas_usuarios
     where id_empresa = p_empresa and id_usuario = (select auth.uid())
       and activo and rol = any (p_roles)
  );
$$;

create or replace function public.es_admin_plataforma()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select es_admin_plataforma from public.usuarios where id = (select auth.uid())),
    false
  );
$$;

create or replace function public.comparte_empresa(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.empresas_usuarios yo
      join public.empresas_usuarios otro on otro.id_empresa = yo.id_empresa
     where yo.id_usuario = (select auth.uid()) and yo.activo
       and otro.id_usuario = p_usuario
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Perfil de usuario sincronizado con auth.users
-- -----------------------------------------------------------------------------

create or replace function public.tg_sincronizar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, correo, nombre, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set correo = excluded.correo,
        nombre = coalesce(excluded.nombre, public.usuarios.nombre),
        avatar_url = coalesce(excluded.avatar_url, public.usuarios.avatar_url);
  return new;
end;
$$;

create or replace trigger wp_sincronizar_usuario
  after insert or update of email, raw_user_meta_data on auth.users
  for each row execute function public.tg_sincronizar_usuario();

-- Usuarios que ya existían antes de esta migración.
insert into public.usuarios (id, correo, nombre, avatar_url)
select id, email,
       coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
       raw_user_meta_data ->> 'avatar_url'
  from auth.users
on conflict (id) do nothing;

-- Administrador de la plataforma (puede editar el catálogo global de vehículos).
update public.usuarios
   set es_admin_plataforma = true
 where correo = 'miltonbarrientos2@gmail.com' and not es_admin_plataforma;

-- -----------------------------------------------------------------------------
-- 4. Onboarding: crear empresa
-- -----------------------------------------------------------------------------

create or replace function public.crear_empresa(
  p_nombre text,
  p_razon_social text default null,
  p_rtn text default null,
  p_telefono text default null,
  p_correo text default null,
  p_direccion text default null,
  p_paleta text default 'rojo-negro'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_empresa uuid;
begin
  if v_usuario is null then
    raise exception 'Sesión no válida' using errcode = '28000';
  end if;

  -- Por si el trigger de auth no alcanzó a correr.
  insert into public.usuarios (id, correo)
  select id, email from auth.users where id = v_usuario
  on conflict (id) do nothing;

  insert into public.empresas (nombre, razon_social, rtn, telefono, correo, direccion, paleta, creado_por)
  values (
    btrim(p_nombre),
    nullif(btrim(p_razon_social), ''),
    nullif(regexp_replace(coalesce(p_rtn, ''), '\D', '', 'g'), ''),
    nullif(btrim(p_telefono), ''),
    nullif(lower(btrim(p_correo)), ''),
    nullif(btrim(p_direccion), ''),
    coalesce(nullif(p_paleta, ''), 'rojo-negro'),
    v_usuario
  )
  returning id into v_empresa;

  insert into public.empresas_usuarios (id_empresa, id_usuario, rol)
  values (v_empresa, v_usuario, 'dueno');

  update public.usuarios set id_empresa_activa = v_empresa where id = v_usuario;

  return v_empresa;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Permisos y RLS de las tablas nuevas
-- -----------------------------------------------------------------------------

revoke all on function public.crear_empresa(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.crear_empresa(text, text, text, text, text, text, text) to authenticated;

-- Supabase concede todo por defecto; se deja solo lo necesario.
revoke all on public.roles, public.empresas, public.usuarios,
              public.empresas_usuarios, public.preferencias_tablas from anon, authenticated;

grant select on public.roles to authenticated;
grant select, update on public.empresas to authenticated;
grant select on public.usuarios to authenticated;
grant update (id_empresa_activa) on public.usuarios to authenticated;
grant select on public.empresas_usuarios to authenticated;
grant select, insert, update, delete on public.preferencias_tablas to authenticated;

alter table public.roles enable row level security;
alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
alter table public.empresas_usuarios enable row level security;
alter table public.preferencias_tablas enable row level security;

drop policy if exists roles_lectura on public.roles;
create policy roles_lectura on public.roles
  for select to authenticated using (true);

drop policy if exists empresas_lectura on public.empresas;
create policy empresas_lectura on public.empresas
  for select to authenticated
  using (public.es_miembro(id) or public.es_admin_plataforma());

drop policy if exists empresas_edicion on public.empresas;
create policy empresas_edicion on public.empresas
  for update to authenticated
  using (public.tiene_rol(id, array['dueno', 'admin']))
  with check (public.tiene_rol(id, array['dueno', 'admin']));

drop policy if exists usuarios_lectura on public.usuarios;
create policy usuarios_lectura on public.usuarios
  for select to authenticated
  using (id = (select auth.uid()) or public.comparte_empresa(id));

drop policy if exists usuarios_edicion_propia on public.usuarios;
create policy usuarios_edicion_propia on public.usuarios
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (id_empresa_activa is null or public.es_miembro(id_empresa_activa))
  );

drop policy if exists empresas_usuarios_lectura on public.empresas_usuarios;
create policy empresas_usuarios_lectura on public.empresas_usuarios
  for select to authenticated
  using (id_usuario = (select auth.uid()) or public.es_miembro(id_empresa));

drop policy if exists preferencias_propias on public.preferencias_tablas;
create policy preferencias_propias on public.preferencias_tablas
  for all to authenticated
  using (id_usuario = (select auth.uid()))
  with check (id_usuario = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 6. Catálogo de vehículos: escritura para administradores de la plataforma
-- -----------------------------------------------------------------------------

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'marcas', 'modelos', 'modelos_anios', 'tipos_carrocerias', 'especificaciones'
  ] loop
    execute format('grant select on public.%I to anon, authenticated', tabla);
    execute format('grant insert, update, delete on public.%I to authenticated', tabla);
    execute format('grant usage, select on sequence public.%I to authenticated', tabla || '_id_seq');
    execute format('drop policy if exists catalogo_escritura_admin on public.%I', tabla);
    execute format(
      'create policy catalogo_escritura_admin on public.%I
         for all to authenticated
         using (public.es_admin_plataforma())
         with check (public.es_admin_plataforma())', tabla
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Vistas "aplanadas" del catálogo (lectura de la tabla maestra)
--    security_invoker: respetan el RLS de las tablas base.
-- -----------------------------------------------------------------------------

create or replace view public.v_marcas with (security_invoker = true) as
select ma.id,
       ma.marca,
       coalesce(c.modelos, 0)::integer as modelos
  from public.marcas ma
  left join (select id_marca, count(*) as modelos from public.modelos group by id_marca) c
    on c.id_marca = ma.id;

create or replace view public.v_modelos with (security_invoker = true) as
select mo.id,
       mo.id_marca,
       ma.marca,
       mo.modelo,
       coalesce(c.anios, 0)::integer as anios,
       c.anio_desde,
       c.anio_hasta
  from public.modelos mo
  join public.marcas ma on ma.id = mo.id_marca
  left join (
    select id_modelo, count(*) as anios, min(anio) as anio_desde, max(anio) as anio_hasta
      from public.modelos_anios group by id_modelo
  ) c on c.id_modelo = mo.id;

create or replace view public.v_modelos_anios with (security_invoker = true) as
select ya.id,
       ya.id_modelo,
       mo.id_marca,
       ma.marca,
       mo.modelo,
       ya.anio,
       coalesce(c.especificaciones, 0)::integer as especificaciones
  from public.modelos_anios ya
  join public.modelos mo on mo.id = ya.id_modelo
  join public.marcas ma on ma.id = mo.id_marca
  left join (
    select id_modelo_anio, count(*) as especificaciones
      from public.especificaciones group by id_modelo_anio
  ) c on c.id_modelo_anio = ya.id;

create or replace view public.v_tipos_carrocerias with (security_invoker = true) as
select tc.id,
       tc.carroceria,
       coalesce(c.especificaciones, 0)::integer as especificaciones
  from public.tipos_carrocerias tc
  left join (
    select id_tipo_carroceria, count(*) as especificaciones
      from public.especificaciones group by id_tipo_carroceria
  ) c on c.id_tipo_carroceria = tc.id;

create or replace view public.v_especificaciones with (security_invoker = true) as
select e.id,
       ma.id as id_marca,
       ma.marca,
       mo.id as id_modelo,
       mo.modelo,
       e.id_modelo_anio,
       ya.anio,
       e.id_tipo_carroceria,
       tc.carroceria,
       e.motor_cc,
       round(e.motor_cc / 1000.0, 1) as motor_litros,
       e.motor_numero_cilindros,
       e.motor_posicion_cilindros,
       e.motor_numero
  from public.especificaciones e
  join public.modelos_anios ya on ya.id = e.id_modelo_anio
  join public.modelos mo on mo.id = ya.id_modelo
  join public.marcas ma on ma.id = mo.id_marca
  join public.tipos_carrocerias tc on tc.id = e.id_tipo_carroceria;

grant select on public.v_marcas, public.v_modelos, public.v_modelos_anios,
                public.v_tipos_carrocerias, public.v_especificaciones
  to anon, authenticated;


-- -----------------------------------------------------------------------------
-- 8. Documentación en la base
-- -----------------------------------------------------------------------------

comment on table public.empresas is 'Tenant del ERP. Toda tabla operativa lleva id_empresa.';
comment on column public.empresas.paleta is 'Paleta visual de la app para esta empresa (ver lib/paletas.ts).';
comment on table public.usuarios is 'Perfil 1:1 con auth.users; se crea/actualiza por trigger.';
comment on column public.usuarios.es_admin_plataforma is 'Puede editar datos globales (catálogo de vehículos). Solo se asigna por migración/SQL.';
comment on table public.empresas_usuarios is 'Membresía de usuarios en empresas con su rol.';
comment on table public.preferencias_tablas is 'Configuración de la tabla maestra por usuario (columnas visibles, orden, anchos).';
comment on function public.crear_empresa(text, text, text, text, text, text, text) is 'Onboarding: crea la empresa y deja al usuario como dueño.';

commit;
