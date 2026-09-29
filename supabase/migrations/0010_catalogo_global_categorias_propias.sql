-- =============================================================================
-- 0010 · Catálogo global solo para el admin de plataforma + categorías propias
-- -----------------------------------------------------------------------------
-- 1. Admin de plataforma: solo miltonbarrientos2@gmail.com. Cualquier otro
--    usuario marcado queda desmarcado. (La app además exige que el correo esté
--    en ADMINS_PLATAFORMA; ver docs/arquitectura.md.)
--    El catálogo de vehículos (marcas, modelos, años, carrocerías,
--    especificaciones), las categorías generales y sus relacionadas ya solo
--    las escribe es_admin_plataforma() (0001/0002/0004); aquí no cambia.
-- 2. Categorías propias por empresa: `categorias.id_empresa` (null = general).
--    · Las ven y usan solo los miembros de esa empresa; las edita dueño/admin.
--    · Pueden colgar de una categoría general o de otra propia de la misma
--      empresa; una general nunca cuelga de una propia.
--    · Un producto solo puede usar categorías generales o de su empresa.
--    · Las relacionadas (complementos) siguen siendo solo entre generales.
--    · Vista nueva v_categorias_globales (Mantenimiento del admin).
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Admin de plataforma
-- -----------------------------------------------------------------------------

update public.usuarios
   set es_admin_plataforma = (correo = 'miltonbarrientos2@gmail.com')
 where es_admin_plataforma is distinct from (correo = 'miltonbarrientos2@gmail.com');

-- -----------------------------------------------------------------------------
-- 2. Categorías propias
-- -----------------------------------------------------------------------------

alter table public.categorias
  add column if not exists id_empresa uuid references public.empresas (id) on delete cascade;

create index if not exists categorias_id_empresa_idx on public.categorias (id_empresa);

comment on column public.categorias.id_empresa is
  'Null = categoría general (la mantiene el admin de plataforma). Con empresa = categoría propia de esa empresa.';

-- El árbol ahora también valida empresas. security definer: el slug debe ser
-- único entre TODAS las categorías (también las de otras empresas, que RLS oculta).
create or replace function public.tg_categorias_arbol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nivel integer := 1;
  v_actual integer := new.id_padre;
  v_base text;
  v_n integer := 1;
  v_padre_empresa uuid;
begin
  if tg_op = 'UPDATE' and new.id_empresa is distinct from old.id_empresa then
    raise exception 'No se puede cambiar una categoría de general a propia (ni de empresa).';
  end if;

  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.descripcion := nullif(btrim(new.descripcion), '');
  new.sinonimos := nullif(regexp_replace(lower(btrim(new.sinonimos)), '\s*,\s*', ', ', 'g'), '');

  if new.slug is null or btrim(new.slug) = '' then
    v_base := btrim(regexp_replace(public.wp_normalizar(new.nombre), '[^a-z0-9]+', '-', 'g'), '-');
    v_base := left(coalesce(nullif(v_base, ''), 'categoria'), 70);
    new.slug := v_base;
    while exists (select 1 from public.categorias where slug = new.slug and id is distinct from new.id) loop
      v_n := v_n + 1;
      new.slug := v_base || '-' || v_n;
    end loop;
  end if;

  if new.id_padre is not null then
    select c.id_empresa into v_padre_empresa from public.categorias c where c.id = new.id_padre;
    if not found then
      raise exception 'La categoría de arriba no existe.';
    end if;
    if v_padre_empresa is not null and new.id_empresa is null then
      raise exception 'Una categoría general no puede estar dentro de una categoría propia.';
    end if;
    if v_padre_empresa is not null and v_padre_empresa is distinct from new.id_empresa then
      raise exception 'Esa categoría de arriba es de otra empresa.';
    end if;
  end if;

  while v_actual is not null loop
    if v_actual = new.id then
      raise exception 'Una categoría no puede estar dentro de sí misma.';
    end if;
    v_nivel := v_nivel + 1;
    if v_nivel > 3 then
      raise exception 'El árbol de categorías admite como máximo 3 niveles.';
    end if;
    select c.id_padre into v_actual from public.categorias c where c.id = v_actual;
  end loop;

  if new.id_padre is not null then
    select c.es_servicio into new.es_servicio from public.categorias c where c.id = new.id_padre;
  end if;
  return new;
end;
$$;

-- Un producto solo usa categorías generales o de su propia empresa (la FK no mira RLS).
create or replace function public.tg_productos_categoria_empresa()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa uuid;
begin
  select c.id_empresa into v_empresa from public.categorias c where c.id = new.id_categoria;
  if v_empresa is not null and v_empresa <> new.id_empresa then
    raise exception 'Esa categoría es de otra empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists a_categoria_empresa on public.productos;
create trigger a_categoria_empresa
  before insert or update of id_categoria on public.productos
  for each row execute function public.tg_productos_categoria_empresa();

-- Políticas: generales para todos (también el catálogo web público), propias solo para su empresa.
drop policy if exists catalogo_lectura_publica on public.categorias;
drop policy if exists catalogo_escritura_admin on public.categorias;
drop policy if exists categorias_lectura_publica on public.categorias;
drop policy if exists categorias_lectura on public.categorias;
drop policy if exists categorias_escritura_general on public.categorias;
drop policy if exists categorias_escritura_propia on public.categorias;

create policy categorias_lectura_publica on public.categorias
  for select to anon using (id_empresa is null);
create policy categorias_lectura on public.categorias
  for select to authenticated using (id_empresa is null or public.es_miembro(id_empresa));
create policy categorias_escritura_general on public.categorias
  for all to authenticated
  using (id_empresa is null and public.es_admin_plataforma())
  with check (id_empresa is null and public.es_admin_plataforma());
create policy categorias_escritura_propia on public.categorias
  for all to authenticated
  using (id_empresa is not null and public.tiene_rol(id_empresa, array['dueno', 'admin']))
  with check (id_empresa is not null and public.tiene_rol(id_empresa, array['dueno', 'admin']));

-- Relacionadas: se leen si ambas categorías son visibles; las escribe el admin, solo entre generales.
drop policy if exists catalogo_lectura_publica on public.categorias_relacionadas;
drop policy if exists catalogo_escritura_admin on public.categorias_relacionadas;
drop policy if exists relacionadas_lectura on public.categorias_relacionadas;
drop policy if exists relacionadas_escritura on public.categorias_relacionadas;

create policy relacionadas_lectura on public.categorias_relacionadas
  for select to anon, authenticated
  using (exists (select 1 from public.categorias c where c.id = id_categoria)
         and exists (select 1 from public.categorias c where c.id = id_relacionada));
create policy relacionadas_escritura on public.categorias_relacionadas
  for all to authenticated
  using (public.es_admin_plataforma())
  with check (
    public.es_admin_plataforma()
    and exists (select 1 from public.categorias c where c.id = id_categoria and c.id_empresa is null)
    and exists (select 1 from public.categorias c where c.id = id_relacionada and c.id_empresa is null)
  );

-- Vista: agrega empresa y origen al final (create or replace solo permite columnas nuevas al final).
create or replace view public.v_categorias with (security_invoker = true) as
with recursive arbol as (
  select c.id, c.nombre::text as ruta, 1 as nivel,
         lpad(c.orden::text, 4, '0') || lpad(c.id::text, 6, '0') as orden_arbol
    from public.categorias c
   where c.id_padre is null
  union all
  select h.id, a.ruta || ' › ' || h.nombre, a.nivel + 1,
         a.orden_arbol || '.' || lpad(h.orden::text, 4, '0') || lpad(h.id::text, 6, '0')
    from public.categorias h
    join arbol a on a.id = h.id_padre
)
select c.id,
       c.id_padre,
       p.nombre as padre,
       c.nombre,
       a.ruta,
       a.nivel,
       a.orden_arbol,
       c.slug,
       c.descripcion,
       c.sinonimos,
       c.es_servicio,
       c.orden,
       c.activa,
       (select count(*) from public.categorias s where s.id_padre = c.id)::integer as subcategorias,
       (select count(*) from public.categorias_relacionadas r where r.id_categoria = c.id)::integer as relacionadas,
       c.id_empresa,
       (c.id_empresa is null) as global
  from public.categorias c
  join arbol a on a.id = c.id
  left join public.categorias p on p.id = c.id_padre;

-- Solo las generales: el mantenimiento del catálogo del admin de plataforma.
create or replace view public.v_categorias_globales with (security_invoker = true) as
select * from public.v_categorias where id_empresa is null;

grant select on public.v_categorias, public.v_categorias_globales to anon, authenticated;

-- La importación prefiere, a igual nombre, la categoría propia de la empresa.
create or replace function public.resolver_categoria(p_texto text)
returns integer
language sql
stable
set search_path = public, extensions
as $$
  with t as (
    select wp_normalizar(btrim(
             (regexp_split_to_array(coalesce(p_texto, ''), '\s*(›|>|/)\s*'))[
               array_length(regexp_split_to_array(coalesce(p_texto, ''), '\s*(›|>|/)\s*'), 1)]
           )) as v
  )
  select c.id
    from public.categorias c, t
   where t.v <> ''
     and c.activa
     and (c.slug = regexp_replace(t.v, '\s+', '-', 'g')
          or wp_normalizar(c.nombre) = t.v
          or t.v = any (select wp_normalizar(btrim(s)) from unnest(string_to_array(coalesce(c.sinonimos, ''), ',')) s))
   order by (wp_normalizar(c.nombre) = t.v or c.slug = regexp_replace(t.v, '\s+', '-', 'g')) desc,
            (c.id_empresa is not null) desc,
            (c.id_padre is not null) desc,
            c.id
   limit 1;
$$;

commit;
