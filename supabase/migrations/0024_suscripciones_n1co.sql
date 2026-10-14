-- =============================================================================
-- 0024 · Suscripciones con n1co Business: planes Gratis, Arranque, Avance, Pleno
-- -----------------------------------------------------------------------------
-- Cobro dentro de la app (tarjeta tokenizada por n1co, suscripción recurrente,
-- cancelación). Sobre 0023 (planes, límites, permisos por rol).
--
--   · planes              + precio_anual, n1co_plan_mensual / n1co_plan_anual
--                         (IDs de los planes creados en n1co), publico,
--                         solo_admins (plan de prueba de $0.50, solo admins de
--                         plataforma), etiqueta y caracteristicas (texto de
--                         venta). Semilla con los planes del socio (2026-10-14)
--                         + Gratis (predeterminado) + Prueba. Se eliminan
--                         basico/avanzado/business de 0023.
--   · Nuevas claves de límite: sucursales (establecimientos distintos de los
--                         puntos de emisión) y almacenamiento_mb (fotos y
--                         archivos de la empresa en Storage).
--   · empresas_planes     + estado (prueba · activa · vencida · cancelada ·
--                         gratis · cortesia), prueba_hasta, plan_prueba, ciclo,
--                         n1co_suscripcion_id, periodo_fin, cancelada_en,
--                         recordatorios. Empresa nueva: 7 días de prueba con
--                         Pleno y después Gratis. Las existentes entran a la
--                         prueba al aplicar esta migración (pedido del usuario).
--   · plan_de_empresa()   El plan efectivo se calcula al vuelo: la prueba vence
--                         sola, la cancelada conserva el plan hasta fin de
--                         periodo y la vencida tiene 3 días de gracia.
--   · suscripciones_checkout  Intentos de pago (sin datos de tarjeta). Límite
--                         de intentos y ancla del 3D Secure.
--   · suscripciones_eventos   Bitácora de cobros, webhooks, recordatorios y
--                         cambios (idempotente por `clave`).
--   · Funciones para miembros: mi_suscripcion(), mi_uso(), planes_publicos().
--   · uso_planes_empresas() (admin) con estado, sucursales y almacenamiento.
--   · Storage: no se sube si la empresa ya llegó a su almacenamiento.
--
-- Escrituras de cobro: solo el servidor con la llave secreta (service_role).
-- Ningún usuario puede activarse un plan desde el navegador.
--
-- ESTADO: YA APLICADA (confirmado 2026-10-14) · Requiere 0023.
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Planes: columnas de cobro
-- -----------------------------------------------------------------------------

alter table public.planes add column if not exists precio_anual numeric(12, 2);
alter table public.planes add column if not exists n1co_plan_mensual integer;
alter table public.planes add column if not exists n1co_plan_anual integer;
alter table public.planes add column if not exists publico boolean not null default false;
alter table public.planes add column if not exists solo_admins boolean not null default false;
alter table public.planes add column if not exists etiqueta text;
alter table public.planes add column if not exists caracteristicas text[] not null default '{}';

create unique index if not exists planes_n1co_plan_mensual_key on public.planes (n1co_plan_mensual) where n1co_plan_mensual is not null;
create unique index if not exists planes_n1co_plan_anual_key on public.planes (n1co_plan_anual) where n1co_plan_anual is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.planes'::regclass
                  and conname = 'planes_precios_check') then
    alter table public.planes add constraint planes_precios_check
      check ((precio_mensual is null or precio_mensual >= 0) and (precio_anual is null or precio_anual >= 0));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.planes'::regclass
                  and conname = 'planes_n1co_check') then
    alter table public.planes add constraint planes_n1co_check
      check ((n1co_plan_mensual is null or n1co_plan_mensual > 0) and (n1co_plan_anual is null or n1co_plan_anual > 0));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.planes'::regclass
                  and conname = 'planes_textos_check') then
    alter table public.planes add constraint planes_textos_check
      check ((etiqueta is null or char_length(etiqueta) <= 160) and cardinality(caracteristicas) <= 30);
  end if;
end $$;

-- Planes del socio (2026-10-14). Los módulos que el texto no nombra se
-- asignaron así: Arranque = facturar, inventario, ventas, notas, caja, sitio y
-- usuarios; Avance + compras y actividad; Pleno + contabilidad. Editables en
-- el módulo Planes.
insert into public.planes
  (codigo, nombre, descripcion, etiqueta, precio_mensual, precio_anual, orden, modulos, limites,
   caracteristicas, publico, solo_admins, predeterminado)
values
  ('gratis', 'Gratis', 'Para conocer Wake Parts: lo básico para cotizar y facturar.',
   'Para probar el sistema en un negocio pequeño.', 0, 0, 0,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'ventas', 'mantenimiento', 'taller', 'mi-usuario'],
   '{"sucursales": 1, "puntos_emision": 1, "usuarios": 1, "productos": 50, "clientes": 25, "proveedores": 5,
     "fotos_por_producto": 1, "facturas_mes": 30, "cotizaciones_mes": 60, "almacenamiento_mb": 100}'::jsonb,
   array['Facturación con CAI', 'Búsqueda por vehículo', 'Kardex', '1 usuario', 'Hasta 50 productos'],
   true, false, false),
  ('arranque', 'Arranque', 'Tiendas, yonkers o talleres de una sola ubicación.',
   'Ideal para tiendas, yonkers o talleres de una sola ubicación.', 30, 300, 1,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'ventas', 'notas', 'sitio', 'mantenimiento', 'usuarios',
         'taller', 'mi-usuario'],
   '{"sucursales": 1, "puntos_emision": 1, "usuarios": 5, "productos": 500, "clientes": 150,
     "fotos_por_producto": 3, "almacenamiento_mb": 1024}'::jsonb,
   array['Facturación con CAI', 'Búsqueda por vehículo', 'Kardex', 'Importación de Excel', 'Reportes de ventas',
         'Roles de usuario', 'Catálogo web con tu marca', 'Soporte por WhatsApp y correo en horario laboral'],
   true, false, false),
  ('avance', 'Avance', 'Negocios en crecimiento con más inventario o 2 a 3 puntos.',
   'Ideal para negocios en crecimiento con más inventario o 2 a 3 puntos.', 50, 500, 2,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'compras', 'ventas', 'notas', 'sitio', 'mantenimiento',
         'usuarios', 'actividad', 'taller', 'mi-usuario'],
   '{"sucursales": 3, "usuarios": 15, "productos": 5000, "clientes": 3000,
     "fotos_por_producto": 6, "almacenamiento_mb": 10240}'::jsonb,
   array['Todo lo de Arranque', 'Varios CAI por sucursal', 'Soporte prioritario en horario extendido',
         '1 ajuste menor al año', '1 sesión virtual de capacitación'],
   true, false, false),
  ('pleno', 'Pleno', 'Cadenas, grupos o negocios grandes.',
   'Ideal para cadenas, grupos o negocios grandes.', 100, 1000, 3,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'compras', 'ventas', 'notas', 'contabilidad', 'sitio',
         'mantenimiento', 'usuarios', 'actividad', 'taller', 'mi-usuario'],
   '{"almacenamiento_mb": 51200}'::jsonb,
   array['Todo lo de Avance', 'Catálogo web con dominio propio', 'Soporte prioritario 24/7',
         'Ajustes a la medida según acuerdo', 'Sesión de arranque y acompañamiento'],
   true, false, false),
  ('prueba', 'Prueba n1co', 'Solo admins de Wake Parts: cobra $0.50 para probar el flujo de pago de punta a punta.',
   'Prueba interna del cobro. Da acceso de Pleno.', 0.50, null, 9,
   array['inicio', 'cotizar', 'caja', 'inventario', 'toma', 'compras', 'ventas', 'notas', 'contabilidad', 'sitio',
         'mantenimiento', 'usuarios', 'actividad', 'taller', 'mi-usuario'],
   '{"almacenamiento_mb": 51200}'::jsonb,
   array['Solo visible para administradores de plataforma'],
   false, true, false)
on conflict (codigo) do nothing;

-- Gratis pasa a ser el plan predeterminado (adonde caen las empresas sin pago),
-- solo si el predeterminado todavía es uno de los de 0023.
do $$ begin
  if exists (select 1 from public.planes where predeterminado and codigo in ('basico', 'avanzado', 'business')) then
    update public.planes set predeterminado = false where predeterminado;
    update public.planes set predeterminado = true where codigo = 'gratis';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. Suscripción de cada empresa
-- -----------------------------------------------------------------------------

alter table public.empresas_planes add column if not exists estado text not null default 'prueba';
alter table public.empresas_planes add column if not exists plan_prueba text references public.planes (codigo) on update cascade;
alter table public.empresas_planes add column if not exists prueba_hasta timestamptz;
alter table public.empresas_planes add column if not exists ciclo text;
alter table public.empresas_planes add column if not exists n1co_suscripcion_id text;
alter table public.empresas_planes add column if not exists periodo_fin timestamptz;
alter table public.empresas_planes add column if not exists cancelada_en timestamptz;
alter table public.empresas_planes add column if not exists recordatorios text[] not null default '{}';
alter table public.empresas_planes add column if not exists actualizado_en timestamptz not null default now();

create unique index if not exists empresas_planes_n1co_key on public.empresas_planes (n1co_suscripcion_id) where n1co_suscripcion_id is not null;
create index if not exists empresas_planes_plan_prueba_idx on public.empresas_planes (plan_prueba);
create index if not exists empresas_planes_estado_idx on public.empresas_planes (estado);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.empresas_planes'::regclass
                  and conname = 'empresas_planes_estado_check') then
    alter table public.empresas_planes add constraint empresas_planes_estado_check
      check (estado in ('prueba', 'activa', 'vencida', 'cancelada', 'gratis', 'cortesia'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.empresas_planes'::regclass
                  and conname = 'empresas_planes_ciclo_check') then
    alter table public.empresas_planes add constraint empresas_planes_ciclo_check
      check (ciclo is null or ciclo in ('mensual', 'anual'));
  end if;
end $$;

/** Días de prueba con Pleno para cada empresa nueva. */
create or replace function public.dias_prueba()
returns integer
language sql
immutable
set search_path = ''
as $$ select 7 $$;

-- Las empresas existentes entran a la prueba hoy (una sola vez: prueba_hasta queda puesto).
update public.empresas_planes
   set estado = 'prueba',
       plan = 'gratis',
       plan_prueba = 'pleno',
       prueba_hasta = now() + make_interval(days => public.dias_prueba()),
       nota = coalesce(nota || ' · ', '') || 'Prueba de ' || public.dias_prueba() || ' días al activar los cobros (0024)',
       actualizado_en = now()
 where prueba_hasta is null
   and n1co_suscripcion_id is null
   and estado = 'prueba';

-- Empresas sin fila (por si acaso): también a prueba.
insert into public.empresas_planes (id_empresa, plan, estado, plan_prueba, prueba_hasta, asignado_por)
select e.id, 'gratis', 'prueba', 'pleno', now() + make_interval(days => public.dias_prueba()), null
  from public.empresas e
 where not exists (select 1 from public.empresas_planes p where p.id_empresa = e.id);

-- Los planes de prueba de 0023 ya no se usan.
delete from public.planes p
 where p.codigo in ('basico', 'avanzado', 'business')
   and not exists (select 1 from public.empresas_planes ep where ep.plan = p.codigo or ep.plan_prueba = p.codigo);

-- Empresa nueva → prueba con Pleno y después el predeterminado (Gratis).
create or replace function public.asignar_plan_predeterminado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text;
  v_prueba text;
begin
  select codigo into v_plan from public.planes where predeterminado and activo limit 1;
  if v_plan is null then
    select codigo into v_plan from public.planes where activo order by orden limit 1;
  end if;
  select codigo into v_prueba from public.planes where codigo = 'pleno' and activo;
  if v_plan is not null then
    insert into public.empresas_planes (id_empresa, plan, estado, plan_prueba, prueba_hasta, asignado_por)
    values (new.id, v_plan,
            case when v_prueba is null then 'gratis' else 'prueba' end,
            v_prueba,
            case when v_prueba is null then null else now() + make_interval(days => public.dias_prueba()) end,
            null)
    on conflict (id_empresa) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.asignar_plan_predeterminado() from public, anon, authenticated;

-- Plan efectivo, calculado al vuelo (no depende del cron).
create or replace function public.plan_de_empresa(p_empresa uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
              when ep.estado = 'prueba' and ep.prueba_hasta > now() then coalesce(ep.plan_prueba, ep.plan)
              when ep.estado in ('activa', 'cortesia', 'gratis') then ep.plan
              when ep.estado = 'cancelada' and ep.periodo_fin > now() then ep.plan
              when ep.estado = 'vencida' and ep.periodo_fin + interval '3 days' > now() then ep.plan
            end
       from public.empresas_planes ep
      where ep.id_empresa = p_empresa),
    (select p.codigo from public.planes p where p.predeterminado limit 1),
    'gratis'
  );
$$;

revoke execute on function public.plan_de_empresa(uuid) from public, anon;

-- -----------------------------------------------------------------------------
-- 3. Intentos de pago y bitácora (solo el servidor escribe)
-- -----------------------------------------------------------------------------

create table if not exists public.suscripciones_checkout (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_usuario uuid references public.usuarios (id) on delete set null,
  correo text not null,
  plan text not null references public.planes (codigo) on update cascade,
  ciclo text not null,
  n1co_plan_id integer not null,
  n1co_metodo_pago text,
  n1co_autenticacion text,
  estado text not null default 'iniciado',
  creado_en timestamptz not null default now(),
  expira_en timestamptz not null default now() + interval '2 hours'
);

create index if not exists suscripciones_checkout_empresa_idx on public.suscripciones_checkout (id_empresa, creado_en desc);
create index if not exists suscripciones_checkout_usuario_idx on public.suscripciones_checkout (id_usuario);
create index if not exists suscripciones_checkout_plan_idx on public.suscripciones_checkout (plan);
create index if not exists suscripciones_checkout_correo_idx on public.suscripciones_checkout (lower(correo), expira_en desc);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.suscripciones_checkout'::regclass
                  and conname = 'suscripciones_checkout_check') then
    alter table public.suscripciones_checkout add constraint suscripciones_checkout_check
      check (ciclo in ('mensual', 'anual') and estado in ('iniciado', 'autenticacion', 'procesando', 'exitoso', 'fallido'));
  end if;
end $$;

alter table public.suscripciones_checkout enable row level security;
revoke all on public.suscripciones_checkout from anon, authenticated;

drop policy if exists admin_plataforma on public.suscripciones_checkout;
create policy admin_plataforma on public.suscripciones_checkout
  for select to authenticated
  using (public.es_admin_plataforma());
grant select on public.suscripciones_checkout to authenticated;

create table if not exists public.suscripciones_eventos (
  id bigint generated by default as identity primary key,
  id_empresa uuid references public.empresas (id) on delete set null,
  origen text not null,
  tipo text not null,
  n1co_suscripcion_id text,
  plan text,
  ciclo text,
  monto numeric(12, 2),
  mensaje text,
  clave text,
  datos jsonb,
  creado_en timestamptz not null default now()
);

create unique index if not exists suscripciones_eventos_clave_key on public.suscripciones_eventos (clave) where clave is not null;
create index if not exists suscripciones_eventos_empresa_idx on public.suscripciones_eventos (id_empresa, creado_en desc);
create index if not exists suscripciones_eventos_n1co_idx on public.suscripciones_eventos (n1co_suscripcion_id);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.suscripciones_eventos'::regclass
                  and conname = 'suscripciones_eventos_origen_check') then
    alter table public.suscripciones_eventos add constraint suscripciones_eventos_origen_check
      check (origen in ('checkout', 'webhook', 'cron', 'admin', 'cancelacion', 'sincronizacion')
             and (mensaje is null or char_length(mensaje) <= 1000));
  end if;
end $$;

alter table public.suscripciones_eventos enable row level security;
revoke all on public.suscripciones_eventos from anon, authenticated;
grant select on public.suscripciones_eventos to authenticated;

-- El dueño ve el historial de su empresa; el admin de plataforma, todo.
drop policy if exists suscripciones_eventos_lectura on public.suscripciones_eventos;
create policy suscripciones_eventos_lectura on public.suscripciones_eventos
  for select to authenticated
  using (public.es_admin_plataforma() or public.tiene_rol(id_empresa, array['dueno']));

-- -----------------------------------------------------------------------------
-- 4. Límites nuevos: sucursales y almacenamiento
-- -----------------------------------------------------------------------------

-- Sucursales = establecimientos distintos entre los puntos de emisión activos.
create or replace function public.limite_plan_sucursales()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usadas bigint;
begin
  if not new.activo then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.activo and old.establecimiento = new.establecimiento then
    return new;
  end if;
  -- Otro punto activo ya abrió esta sucursal: no suma.
  if exists (select 1 from public.puntos_emision p
              where p.id_empresa = new.id_empresa and p.activo and p.establecimiento = new.establecimiento
                and p.id is distinct from new.id) then
    return new;
  end if;
  select count(distinct p.establecimiento) into v_usadas
    from public.puntos_emision p
   where p.id_empresa = new.id_empresa and p.activo and p.id is distinct from new.id;
  perform public.verificar_limite_plan(new.id_empresa, 'sucursales', v_usadas, 'sucursales');
  return new;
end;
$$;

revoke execute on function public.limite_plan_sucursales() from public, anon, authenticated;

do $$ begin
  if to_regclass('public.puntos_emision') is not null then
    execute 'create or replace trigger limite_plan_sucursales before insert or update of activo, establecimiento '
         || 'on public.puntos_emision for each row execute function public.limite_plan_sucursales()';
  end if;
end $$;

/** Bytes que ocupa la empresa en Storage (fotos de productos, logo, fondo, sitio). */
create or replace function public.almacenamiento_empresa(p_empresa uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)::bigint
    from storage.objects o
   where o.bucket_id in ('productos', 'empresas')
     and o.name like p_empresa::text || '/%';
$$;

revoke execute on function public.almacenamiento_empresa(uuid) from public, anon, authenticated;

/** ¿Le queda espacio? (Para la política de subida de Storage.) */
create or replace function public.almacenamiento_libre(p_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.limite_plan(p_empresa, 'almacenamiento_mb') is null
      or public.almacenamiento_empresa(p_empresa) < public.limite_plan(p_empresa, 'almacenamiento_mb')::bigint * 1048576;
$$;

revoke execute on function public.almacenamiento_libre(uuid) from public, anon;
grant execute on function public.almacenamiento_libre(uuid) to authenticated;

/** La app la llama antes de subir: P0001 si el archivo no cabe. */
create or replace function public.verificar_almacenamiento(p_empresa uuid, p_bytes bigint)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limite integer := public.limite_plan(p_empresa, 'almacenamiento_mb');
begin
  if not public.es_miembro(p_empresa) then
    raise exception 'No tenés acceso a esta empresa.' using errcode = '42501';
  end if;
  if v_limite is not null
     and public.almacenamiento_empresa(p_empresa) + greatest(p_bytes, 0) > v_limite::bigint * 1048576 then
    raise exception 'Llegaste al límite de almacenamiento de tu cuenta (% MB). Borrá fotos que no uses o escribinos para ampliarlo.',
      v_limite using errcode = 'P0001', hint = 'limite_plan:almacenamiento_mb';
  end if;
end;
$$;

revoke execute on function public.verificar_almacenamiento(uuid, bigint) from public, anon;
grant execute on function public.verificar_almacenamiento(uuid, bigint) to authenticated;

-- Segundo candado en Storage (por si alguien sube sin pasar por la app).
drop policy if exists wp_productos_subir on storage.objects;
create policy wp_productos_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos'
              and public.tiene_rol(public.empresa_de_ruta(name), array['dueno', 'admin'])
              and public.almacenamiento_libre(public.empresa_de_ruta(name)));

drop policy if exists wp_empresas_subir on storage.objects;
create policy wp_empresas_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empresas'
              and public.tiene_rol(public.empresa_de_ruta(name), array['dueno', 'admin'])
              and public.almacenamiento_libre(public.empresa_de_ruta(name)));

-- -----------------------------------------------------------------------------
-- 5. Lectura para los miembros y para el admin
-- -----------------------------------------------------------------------------

/** Consumo de una empresa (interna, sin control de acceso). */
create or replace function public.uso_de_empresa(p_empresa uuid)
returns table (
  productos integer,
  clientes integer,
  proveedores integer,
  puntos_emision integer,
  sucursales integer,
  usuarios integer,
  facturas_mes integer,
  cotizaciones_mes integer,
  almacenamiento_bytes bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_desde timestamptz := date_trunc('month', now() at time zone 'America/Tegucigalpa') at time zone 'America/Tegucigalpa';
  v_pe boolean := to_regclass('public.puntos_emision') is not null;
  v_suc integer;
begin
  if v_pe then
    execute 'select count(distinct establecimiento)::integer from public.puntos_emision where id_empresa = $1 and activo'
      into v_suc using p_empresa;
  end if;
  return query
  select (select count(*) from public.productos x where x.id_empresa = p_empresa and x.activo)::integer,
         (select count(*) from public.clientes x where x.id_empresa = p_empresa and x.activo)::integer,
         public.contar_activos('proveedores', p_empresa),
         public.contar_activos('puntos_emision', p_empresa),
         v_suc,
         (select count(*) from public.empresas_usuarios m where m.id_empresa = p_empresa and m.activo)::integer,
         (select count(*) from public.documentos d
           where d.id_empresa = p_empresa and d.tipo = 'factura' and d.fecha >= v_desde)::integer,
         (select count(*) from public.documentos d
           where d.id_empresa = p_empresa and d.tipo = 'cotizacion' and d.fecha >= v_desde)::integer,
         public.almacenamiento_empresa(p_empresa);
end;
$$;

revoke execute on function public.uso_de_empresa(uuid) from public, anon, authenticated;

create or replace function public.mi_uso(p_empresa uuid)
returns table (
  productos integer,
  clientes integer,
  proveedores integer,
  puntos_emision integer,
  sucursales integer,
  usuarios integer,
  facturas_mes integer,
  cotizaciones_mes integer,
  almacenamiento_bytes bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.uso_de_empresa(p_empresa)
   where public.es_miembro(p_empresa) or public.es_admin_plataforma();
$$;

revoke execute on function public.mi_uso(uuid) from public, anon;
grant execute on function public.mi_uso(uuid) to authenticated;

/** Estado de la suscripción para los miembros (sin IDs de n1co). */
create or replace function public.mi_suscripcion(p_empresa uuid)
returns table (
  estado text,
  plan text,
  plan_nombre text,
  plan_efectivo text,
  plan_efectivo_nombre text,
  plan_prueba text,
  prueba_hasta timestamptz,
  ciclo text,
  periodo_fin timestamptz,
  cancelada_en timestamptz,
  con_tarjeta boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select ep.estado,
         ep.plan,
         (select p.nombre from public.planes p where p.codigo = ep.plan),
         public.plan_de_empresa(p_empresa),
         (select p.nombre from public.planes p where p.codigo = public.plan_de_empresa(p_empresa)),
         ep.plan_prueba,
         ep.prueba_hasta,
         ep.ciclo,
         ep.periodo_fin,
         ep.cancelada_en,
         ep.n1co_suscripcion_id is not null
    from public.empresas_planes ep
   where ep.id_empresa = p_empresa
     and (public.es_miembro(p_empresa) or public.es_admin_plataforma());
$$;

revoke execute on function public.mi_suscripcion(uuid) from public, anon;
grant execute on function public.mi_suscripcion(uuid) to authenticated;

/** Planes que puede ver el usuario: los públicos y, para admins de plataforma, los de prueba. */
create or replace function public.planes_publicos()
returns table (
  codigo text,
  nombre text,
  descripcion text,
  etiqueta text,
  precio_mensual numeric,
  precio_anual numeric,
  orden smallint,
  modulos text[],
  limites jsonb,
  caracteristicas text[],
  mensual_disponible boolean,
  anual_disponible boolean,
  solo_admins boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.codigo, p.nombre, p.descripcion, p.etiqueta, p.precio_mensual, p.precio_anual, p.orden,
         p.modulos, p.limites, p.caracteristicas,
         p.n1co_plan_mensual is not null, p.n1co_plan_anual is not null, p.solo_admins
    from public.planes p
   where p.activo
     and (p.publico or (p.solo_admins and public.es_admin_plataforma()))
   order by p.orden;
$$;

revoke execute on function public.planes_publicos() from public, anon;
grant execute on function public.planes_publicos() to authenticated;

-- Consumo por empresa para el admin (cambia de columnas: se recrea).
drop function if exists public.uso_planes_empresas();
create function public.uso_planes_empresas()
returns table (
  id_empresa uuid,
  empresa text,
  plan text,
  plan_nombre text,
  plan_efectivo text,
  estado text,
  prueba_hasta timestamptz,
  ciclo text,
  periodo_fin timestamptz,
  n1co_suscripcion_id text,
  asignado_en timestamptz,
  nota text,
  productos integer,
  clientes integer,
  proveedores integer,
  puntos_emision integer,
  sucursales integer,
  usuarios integer,
  facturas_mes integer,
  cotizaciones_mes integer,
  almacenamiento_bytes bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.es_admin_plataforma() then
    return;
  end if;
  return query
  select e.id, e.nombre, ep.plan,
         (select p.nombre from public.planes p where p.codigo = ep.plan),
         public.plan_de_empresa(e.id),
         ep.estado, ep.prueba_hasta, ep.ciclo, ep.periodo_fin, ep.n1co_suscripcion_id, ep.asignado_en, ep.nota,
         u.productos, u.clientes, u.proveedores, u.puntos_emision, u.sucursales, u.usuarios,
         u.facturas_mes, u.cotizaciones_mes, u.almacenamiento_bytes
    from public.empresas e
    left join public.empresas_planes ep on ep.id_empresa = e.id
    cross join lateral public.uso_de_empresa(e.id) u
   where e.activo
   order by e.creado_en desc;
end;
$$;

revoke execute on function public.uso_planes_empresas() from public, anon;
grant execute on function public.uso_planes_empresas() to authenticated;

-- (Sin auditoría zz_registrar_cambio en suscripciones_eventos: ya es una bitácora.
-- Los cambios de empresas_planes y planes se auditan desde 0023.)

comment on table public.suscripciones_checkout is 'Intentos de pago con n1co (sin datos de tarjeta). Solo escribe el servidor.';
comment on table public.suscripciones_eventos is 'Bitácora de cobros, webhooks, recordatorios y cambios de suscripción. Solo escribe el servidor.';
comment on column public.empresas_planes.estado is 'prueba · activa · vencida · cancelada · gratis · cortesia. El plan efectivo lo calcula plan_de_empresa().';

commit;
