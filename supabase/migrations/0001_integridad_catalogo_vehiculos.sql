-- =============================================================================
-- 0001 · Integridad del catálogo de vehículos
-- -----------------------------------------------------------------------------
-- ESTADO: YA APLICADA (2026-09-28)
-- Idempotente: se puede ejecutar varias veces; la segunda vez no cambia nada.
-- Atómica: todo corre en una transacción; si algo falla no queda nada a medias.
--
-- Qué corrige (hallado analizando los datos reales, 2026-09-28):
--   · Textos con tabs/espacios al inicio o final (6 modelos: "\tTRACKER", …)
--     que generaban modelos duplicados.
--   · Años de 2 dígitos (Jeep Wrangler 95..99 → 1995..1999).
--   · Duplicados: modelos (por marca+nombre), modelos_anios (por modelo+año)
--     y especificaciones idénticas. Se conserva el id menor, se re-apuntan
--     los hijos y los sobrantes se copian al esquema `respaldo` antes de borrar.
--   · motor_tamanio_cc guardaba litros como texto libre ("2.O", "3..3", "6700",
--     "d", ""). Nueva columna motor_cc (entero, centímetros cúbicos) calculada
--     con public.parse_motor_cc(). motor_tamanio_cc queda como legado.
--   · 2 registros puntuales: posición vacía (Hilux 2023 2.4 → L) y
--     Frontier 2011 2.5 con 2 cilindros (→ 4).
--   · Restricciones: unique, checks de rango/valores, índice de FK faltante.
--   · Triggers que normalizan texto (MAYÚSCULAS, sin espacios sobrantes).
--   · RLS activado: lectura pública (catálogo web); escritura solo service_role.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Funciones auxiliares
-- -----------------------------------------------------------------------------

-- Quita espacios/tabs de los extremos, pasa a MAYÚSCULAS; '' → null.
create or replace function public.limpiar_texto(valor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(upper(regexp_replace(valor, '^\s+|\s+$', '', 'g')), '');
$$;

-- Convierte la cilindrada escrita a mano en centímetros cúbicos.
--   "2.2" → 2200 · "2.O" → 2000 · "3..3" → 3300 · "3.6L" → 3600
--   "28" → 2800 (litros sin punto) · "6700" / "125" → ya en cc · "d" / "" → null
create or replace function public.parse_motor_cc(valor text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
  v numeric;
begin
  if valor is null then
    return null;
  end if;
  s := replace(upper(valor), 'O', '0');
  s := regexp_replace(s, '[^0-9.]', '', 'g');
  s := regexp_replace(s, '\.{2,}', '.', 'g');
  s := btrim(s, '.');
  if s !~ '^\d+(\.\d+)?$' then
    return null;
  end if;
  v := s::numeric;
  if v = 0 then
    return null;
  elsif v < 20 then
    return round(v * 1000)::integer;  -- litros
  elsif v < 100 then
    return round(v * 100)::integer;   -- litros sin punto decimal
  else
    return round(v)::integer;         -- ya viene en cc
  end if;
end;
$$;

-- Trigger genérico: normaliza con limpiar_texto las columnas pasadas como argumento.
create or replace function public.tg_normalizar_texto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  columna text;
  parche jsonb := '{}'::jsonb;
begin
  foreach columna in array tg_argv loop
    parche := parche || jsonb_build_object(
      columna, public.limpiar_texto(to_jsonb(new) ->> columna)
    );
  end loop;
  new := jsonb_populate_record(new, parche);
  return new;
end;
$$;

-- Trigger: completa motor_cc a partir de motor_tamanio_cc si no viene.
create or replace function public.tg_especificaciones_motor_cc()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.motor_cc is null then
    new.motor_cc := public.parse_motor_cc(new.motor_tamanio_cc);
  end if;
  return new;
end;
$$;

-- Helper temporal (desaparece al cerrar la sesión): agrega una restricción
-- solo si no existe, para que la migración sea idempotente.
create or replace function pg_temp.agregar_restriccion(tabla regclass, nombre text, definicion text)
returns void
language plpgsql
as $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = tabla and conname = nombre
  ) then
    execute format('alter table %s add constraint %I %s', tabla, nombre, definicion);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Respaldo de filas que se van a eliminar
-- -----------------------------------------------------------------------------

-- motor_tamanio_cc pasa a ser legado y puede venir vacío; motor_cc la reemplaza.
-- Se ajusta antes de crear el respaldo para que ambas tablas tengan la misma forma.
alter table public.especificaciones alter column motor_tamanio_cc drop not null;
alter table public.especificaciones add column if not exists motor_cc integer;

create schema if not exists respaldo;
revoke all on schema respaldo from anon, authenticated;

create table if not exists respaldo.modelos_0001 (like public.modelos including indexes);
create table if not exists respaldo.modelos_anios_0001 (like public.modelos_anios including indexes);
create table if not exists respaldo.especificaciones_0001 (like public.especificaciones including indexes);

comment on schema respaldo is
  'Copias de filas eliminadas por migraciones (sufijo = número de migración). Se pueden borrar cuando ya no hagan falta.';

-- -----------------------------------------------------------------------------
-- 3. Correcciones puntuales (condicionadas al valor erróneo → idempotentes)
-- -----------------------------------------------------------------------------

-- Toyota Hilux 2023 2.4 4 cil.: posición vacía → en línea.
update public.especificaciones
   set motor_posicion_cilindros = 'L'
 where id = 16076 and btrim(motor_posicion_cilindros) = '';

-- Nissan Frontier 2011 2.5: no existe versión de 2 cilindros.
update public.especificaciones
   set motor_numero_cilindros = 4
 where id = 13087 and motor_numero_cilindros = 2;

-- Años escritos con 2 dígitos.
update public.modelos_anios
   set anio = anio + case when anio >= 30 then 1900 else 2000 end
 where anio between 0 and 99;

-- -----------------------------------------------------------------------------
-- 4. Normalización de texto
-- -----------------------------------------------------------------------------

update public.marcas
   set marca = public.limpiar_texto(marca)
 where marca is distinct from public.limpiar_texto(marca);

update public.modelos
   set modelo = public.limpiar_texto(modelo)
 where modelo is distinct from public.limpiar_texto(modelo);

update public.tipos_carrocerias
   set carroceria = public.limpiar_texto(carroceria)
 where carroceria is distinct from public.limpiar_texto(carroceria);

update public.especificaciones
   set motor_posicion_cilindros = public.limpiar_texto(motor_posicion_cilindros),
       motor_numero             = public.limpiar_texto(motor_numero),
       motor_tamanio_cc         = public.limpiar_texto(motor_tamanio_cc)
 where motor_posicion_cilindros is distinct from public.limpiar_texto(motor_posicion_cilindros)
    or motor_numero             is distinct from public.limpiar_texto(motor_numero)
    or motor_tamanio_cc         is distinct from public.limpiar_texto(motor_tamanio_cc);

-- -----------------------------------------------------------------------------
-- 5. Cilindrada numérica
-- -----------------------------------------------------------------------------

update public.especificaciones
   set motor_cc = public.parse_motor_cc(motor_tamanio_cc)
 where motor_cc is null
   and public.parse_motor_cc(motor_tamanio_cc) is not null;

-- -----------------------------------------------------------------------------
-- 6. Consolidar duplicados (se conserva el id menor)
-- -----------------------------------------------------------------------------

-- 6a. modelos: misma marca + mismo nombre
with dup as (
  select id, min(id) over (partition by id_marca, modelo) as id_conservar
    from public.modelos
)
update public.modelos_anios ma
   set id_modelo = dup.id_conservar
  from dup
 where ma.id_modelo = dup.id and dup.id <> dup.id_conservar;

with dup as (
  select id, min(id) over (partition by id_marca, modelo) as id_conservar
    from public.modelos
)
insert into respaldo.modelos_0001
select m.* from public.modelos m join dup on dup.id = m.id
 where dup.id <> dup.id_conservar
on conflict (id) do nothing;

with dup as (
  select id, min(id) over (partition by id_marca, modelo) as id_conservar
    from public.modelos
)
delete from public.modelos m
 using dup
 where m.id = dup.id and dup.id <> dup.id_conservar;

-- 6b. modelos_anios: mismo modelo + mismo año
with dup as (
  select id, min(id) over (partition by id_modelo, anio) as id_conservar
    from public.modelos_anios
)
update public.especificaciones e
   set id_modelo_anio = dup.id_conservar
  from dup
 where e.id_modelo_anio = dup.id and dup.id <> dup.id_conservar;

with dup as (
  select id, min(id) over (partition by id_modelo, anio) as id_conservar
    from public.modelos_anios
)
insert into respaldo.modelos_anios_0001
select ma.* from public.modelos_anios ma join dup on dup.id = ma.id
 where dup.id <> dup.id_conservar
on conflict (id) do nothing;

with dup as (
  select id, min(id) over (partition by id_modelo, anio) as id_conservar
    from public.modelos_anios
)
delete from public.modelos_anios ma
 using dup
 where ma.id = dup.id and dup.id <> dup.id_conservar;

-- 6c. especificaciones idénticas (misma variante de motor y carrocería)
with dup as (
  select id,
         min(id) over (
           partition by id_modelo_anio, id_tipo_carroceria, motor_cc,
                        motor_numero_cilindros, motor_posicion_cilindros, motor_numero
         ) as id_conservar
    from public.especificaciones
)
insert into respaldo.especificaciones_0001
select e.* from public.especificaciones e join dup on dup.id = e.id
 where dup.id <> dup.id_conservar
on conflict (id) do nothing;

with dup as (
  select id,
         min(id) over (
           partition by id_modelo_anio, id_tipo_carroceria, motor_cc,
                        motor_numero_cilindros, motor_posicion_cilindros, motor_numero
         ) as id_conservar
    from public.especificaciones
)
delete from public.especificaciones e
 using dup
 where e.id = dup.id and dup.id <> dup.id_conservar;

-- -----------------------------------------------------------------------------
-- 7. Restricciones
-- -----------------------------------------------------------------------------

select pg_temp.agregar_restriccion('public.marcas', 'marcas_marca_key',
  'unique (marca)');

select pg_temp.agregar_restriccion('public.modelos', 'modelos_id_marca_modelo_key',
  'unique (id_marca, modelo)');

select pg_temp.agregar_restriccion('public.modelos_anios', 'modelos_anios_id_modelo_anio_key',
  'unique (id_modelo, anio)');
select pg_temp.agregar_restriccion('public.modelos_anios', 'modelos_anios_anio_check',
  'check (anio between 1900 and 2100)');

select pg_temp.agregar_restriccion('public.especificaciones', 'especificaciones_variante_key',
  'unique nulls not distinct (id_modelo_anio, id_tipo_carroceria, motor_cc,
     motor_numero_cilindros, motor_posicion_cilindros, motor_numero)');
select pg_temp.agregar_restriccion('public.especificaciones', 'especificaciones_cilindros_check',
  'check (motor_numero_cilindros between 1 and 16)');
select pg_temp.agregar_restriccion('public.especificaciones', 'especificaciones_posicion_check',
  $$check (motor_posicion_cilindros in ('L', 'V', 'H'))$$);
select pg_temp.agregar_restriccion('public.especificaciones', 'especificaciones_motor_cc_check',
  'check (motor_cc between 50 and 20000)');

-- Los unique de arriba ya indexan id_marca, id_modelo e id_modelo_anio
-- (columna líder). Falta la FK hacia carrocerías.
create index if not exists especificaciones_id_tipo_carroceria_idx
  on public.especificaciones (id_tipo_carroceria);

-- -----------------------------------------------------------------------------
-- 8. Triggers de normalización
-- -----------------------------------------------------------------------------

create or replace trigger a_normalizar_texto
  before insert or update on public.marcas
  for each row execute function public.tg_normalizar_texto('marca');

create or replace trigger a_normalizar_texto
  before insert or update on public.modelos
  for each row execute function public.tg_normalizar_texto('modelo');

create or replace trigger a_normalizar_texto
  before insert or update on public.tipos_carrocerias
  for each row execute function public.tg_normalizar_texto('carroceria');

create or replace trigger a_normalizar_texto
  before insert or update on public.especificaciones
  for each row execute function public.tg_normalizar_texto(
    'motor_posicion_cilindros', 'motor_numero', 'motor_tamanio_cc'
  );

create or replace trigger b_motor_cc
  before insert or update on public.especificaciones
  for each row execute function public.tg_especificaciones_motor_cc();

-- -----------------------------------------------------------------------------
-- 9. RLS: catálogo de lectura pública, escritura solo con service_role
-- -----------------------------------------------------------------------------

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'marcas', 'modelos', 'modelos_anios', 'tipos_carrocerias', 'especificaciones'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('drop policy if exists catalogo_lectura_publica on public.%I', tabla);
    execute format(
      'create policy catalogo_lectura_publica on public.%I
         for select to anon, authenticated using (true)', tabla
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Documentación en la base
-- -----------------------------------------------------------------------------

comment on table public.marcas is 'Fabricantes de vehículos. Catálogo global (no depende de empresa).';
comment on table public.modelos is 'Modelos por marca.';
comment on table public.modelos_anios is 'Años disponibles por modelo.';
comment on table public.tipos_carrocerias is 'Tipos de carrocería (TURISMO, PICKUP, …).';
comment on table public.especificaciones is
  'Variante concreta de un modelo-año: carrocería + motor. Nivel al que se asocia la compatibilidad de piezas.';
comment on column public.especificaciones.motor_cc is 'Cilindrada en centímetros cúbicos. Usar esta columna.';
comment on column public.especificaciones.motor_tamanio_cc is
  'LEGADO: cilindrada escrita a mano (en litros, pese al nombre). Si motor_cc viene null se calcula desde aquí.';
comment on column public.especificaciones.motor_posicion_cilindros is 'L = en línea, V = en V, H = horizontal/bóxer.';
comment on column public.especificaciones.motor_numero is 'Código de motor (p. ej. 1ZZ-FE). Null si no se conoce.';

commit;
