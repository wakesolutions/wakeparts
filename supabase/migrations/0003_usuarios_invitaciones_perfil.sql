-- =============================================================================
-- 0003 · Usuarios de la empresa, invitaciones, perfil y datos del taller
-- -----------------------------------------------------------------------------
-- ESTADO: YA APLICADA (2026-09-28)
-- Idempotente y atómica.
--
-- Qué hace:
--   · invitaciones            Un dueño/admin invita por correo con un rol. Cuando
--                             esa persona entra con Google, aceptar_invitaciones()
--                             la agrega a la empresa.
--   · empresas_usuarios       Dueño/admin pueden cambiar rol y activar/desactivar.
--                             Reglas (trigger): nadie se modifica a sí mismo, solo
--                             un dueño toca a otro dueño o asigna el rol dueño, y
--                             siempre queda al menos un dueño activo.
--   · usuarios                + telefono. El nombre ya no se pisa con el de Google
--                             en cada inicio de sesión (el usuario puede editarlo).
--   · empresas                Normaliza RTN/correo también al editar; solo se
--                             pueden editar los campos de datos (no activo, etc.).
--   · Vistas                  v_miembros, v_invitaciones (tabla maestra).
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Usuarios: teléfono, nombre editable
-- -----------------------------------------------------------------------------

alter table public.usuarios add column if not exists telefono text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.usuarios'::regclass and conname = 'usuarios_nombre_check') then
    alter table public.usuarios add constraint usuarios_nombre_check
      check (nombre is null or (btrim(nombre) <> '' and char_length(nombre) <= 120));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.usuarios'::regclass and conname = 'usuarios_telefono_check') then
    alter table public.usuarios add constraint usuarios_telefono_check
      check (telefono is null or char_length(telefono) <= 30);
  end if;
end;
$$;

-- El nombre de Google solo se usa si el usuario no tiene uno.
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
        nombre = coalesce(public.usuarios.nombre, excluded.nombre),
        avatar_url = coalesce(excluded.avatar_url, public.usuarios.avatar_url);
  return new;
end;
$$;

revoke update on public.usuarios from authenticated;
grant update (id_empresa_activa, nombre, telefono) on public.usuarios to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Empresas: normalización y columnas editables
-- -----------------------------------------------------------------------------

create or replace function public.tg_normalizar_empresa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.nombre := btrim(new.nombre);
  new.razon_social := nullif(btrim(new.razon_social), '');
  new.rtn := nullif(regexp_replace(coalesce(new.rtn, ''), '\D', '', 'g'), '');
  new.telefono := nullif(btrim(new.telefono), '');
  new.correo := nullif(lower(btrim(new.correo)), '');
  new.direccion := nullif(btrim(new.direccion), '');
  return new;
end;
$$;

create or replace trigger a_normalizar
  before insert or update on public.empresas
  for each row execute function public.tg_normalizar_empresa();

revoke update on public.empresas from authenticated;
grant update (nombre, razon_social, rtn, telefono, correo, direccion, paleta) on public.empresas to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Membresías: edición por dueño/admin con reglas
-- -----------------------------------------------------------------------------

grant update (rol, activo) on public.empresas_usuarios to authenticated;

drop policy if exists empresas_usuarios_edicion on public.empresas_usuarios;
create policy empresas_usuarios_edicion on public.empresas_usuarios
  for update to authenticated
  using (public.tiene_rol(id_empresa, array['dueno', 'admin']))
  with check (public.tiene_rol(id_empresa, array['dueno', 'admin']));

create or replace function public.tg_reglas_membresia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  -- Cambios hechos por el sistema (SQL/migraciones) no se restringen.
  if v_actor is null then
    return new;
  end if;

  if old.id_usuario = v_actor then
    raise exception 'No podés cambiar tu propio rol ni desactivarte.';
  end if;

  if (old.rol = 'dueno' or new.rol = 'dueno')
     and not public.tiene_rol(old.id_empresa, array['dueno']) then
    raise exception 'Solo un dueño puede modificar a otro dueño o asignar ese rol.';
  end if;

  if old.rol = 'dueno' and old.activo and (new.rol <> 'dueno' or not new.activo)
     and not exists (
       select 1 from public.empresas_usuarios
        where id_empresa = old.id_empresa and rol = 'dueno' and activo
          and id_usuario <> old.id_usuario
     ) then
    raise exception 'La empresa debe tener al menos un dueño activo.';
  end if;

  return new;
end;
$$;

create or replace trigger a_reglas
  before update on public.empresas_usuarios
  for each row execute function public.tg_reglas_membresia();

-- -----------------------------------------------------------------------------
-- 4. Invitaciones
-- -----------------------------------------------------------------------------

create table if not exists public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  correo text not null,
  rol text not null references public.roles (codigo),
  creado_por uuid references public.usuarios (id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now(),
  aceptada_en timestamptz,
  aceptada_por uuid references public.usuarios (id) on delete set null
);

create index if not exists invitaciones_id_empresa_idx on public.invitaciones (id_empresa);
create index if not exists invitaciones_rol_idx on public.invitaciones (rol);
create index if not exists invitaciones_creado_por_idx on public.invitaciones (creado_por);
create index if not exists invitaciones_aceptada_por_idx on public.invitaciones (aceptada_por);
create index if not exists invitaciones_correo_idx on public.invitaciones (correo) where aceptada_en is null;
-- Una invitación pendiente por correo y empresa.
create unique index if not exists invitaciones_pendiente_key
  on public.invitaciones (id_empresa, correo) where aceptada_en is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.invitaciones'::regclass and conname = 'invitaciones_correo_check') then
    alter table public.invitaciones add constraint invitaciones_correo_check
      check (correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  end if;
end;
$$;

create or replace function public.tg_normalizar_invitacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.correo := lower(btrim(new.correo));
  if tg_op = 'INSERT' and exists (
    select 1
      from public.empresas_usuarios eu
      join public.usuarios u on u.id = eu.id_usuario
     where eu.id_empresa = new.id_empresa and lower(u.correo) = new.correo
  ) then
    raise exception 'Esa persona ya es parte de la empresa.';
  end if;
  return new;
end;
$$;

create or replace trigger a_normalizar
  before insert or update on public.invitaciones
  for each row execute function public.tg_normalizar_invitacion();

revoke all on public.invitaciones from anon, authenticated;
grant select, insert, delete on public.invitaciones to authenticated;
grant update (rol) on public.invitaciones to authenticated;

alter table public.invitaciones enable row level security;

drop policy if exists invitaciones_lectura on public.invitaciones;
create policy invitaciones_lectura on public.invitaciones
  for select to authenticated
  using (public.tiene_rol(id_empresa, array['dueno', 'admin']));

-- Solo un dueño puede invitar como dueño.
drop policy if exists invitaciones_alta on public.invitaciones;
create policy invitaciones_alta on public.invitaciones
  for insert to authenticated
  with check (
    public.tiene_rol(id_empresa, array['dueno', 'admin'])
    and (rol <> 'dueno' or public.tiene_rol(id_empresa, array['dueno']))
    and aceptada_en is null
  );

drop policy if exists invitaciones_edicion on public.invitaciones;
create policy invitaciones_edicion on public.invitaciones
  for update to authenticated
  using (public.tiene_rol(id_empresa, array['dueno', 'admin']) and aceptada_en is null)
  with check (
    public.tiene_rol(id_empresa, array['dueno', 'admin'])
    and (rol <> 'dueno' or public.tiene_rol(id_empresa, array['dueno']))
  );

drop policy if exists invitaciones_baja on public.invitaciones;
create policy invitaciones_baja on public.invitaciones
  for delete to authenticated
  using (public.tiene_rol(id_empresa, array['dueno', 'admin']) and aceptada_en is null);

-- Convierte las invitaciones pendientes del correo del usuario en membresías.
create or replace function public.aceptar_invitaciones()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_correo text;
  v_cantidad integer := 0;
  inv record;
begin
  if v_usuario is null then
    return 0;
  end if;
  select lower(email) into v_correo from auth.users where id = v_usuario;
  if v_correo is null then
    return 0;
  end if;

  insert into public.usuarios (id, correo)
  select id, email from auth.users where id = v_usuario
  on conflict (id) do nothing;

  for inv in
    select * from public.invitaciones
     where correo = v_correo and aceptada_en is null
     for update
  loop
    insert into public.empresas_usuarios (id_empresa, id_usuario, rol)
    values (inv.id_empresa, v_usuario, inv.rol)
    on conflict (id_empresa, id_usuario) do nothing;

    update public.invitaciones
       set aceptada_en = now(), aceptada_por = v_usuario
     where id = inv.id;

    update public.usuarios
       set id_empresa_activa = coalesce(id_empresa_activa, inv.id_empresa)
     where id = v_usuario;

    v_cantidad := v_cantidad + 1;
  end loop;

  return v_cantidad;
end;
$$;

revoke all on function public.aceptar_invitaciones() from public, anon;
grant execute on function public.aceptar_invitaciones() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Vistas para la tabla maestra
-- -----------------------------------------------------------------------------

create or replace view public.v_miembros with (security_invoker = true) as
select eu.id_empresa,
       eu.id_usuario,
       u.nombre,
       u.correo,
       u.telefono,
       u.avatar_url,
       eu.rol,
       eu.activo,
       eu.creado_en
  from public.empresas_usuarios eu
  join public.usuarios u on u.id = eu.id_usuario;

create or replace view public.v_invitaciones with (security_invoker = true) as
select i.id,
       i.id_empresa,
       i.correo,
       i.rol,
       i.creado_en,
       u.nombre as invitado_por
  from public.invitaciones i
  left join public.usuarios u on u.id = i.creado_por
 where i.aceptada_en is null;

revoke all on public.v_miembros, public.v_invitaciones from anon;
grant select on public.v_miembros, public.v_invitaciones to authenticated;

comment on table public.invitaciones is
  'Invitaciones por correo a una empresa. Se aceptan solas cuando esa cuenta de Google entra (aceptar_invitaciones).';
comment on function public.aceptar_invitaciones() is
  'Agrega al usuario actual a las empresas que lo invitaron por su correo. Se llama al entrar.';

commit;
