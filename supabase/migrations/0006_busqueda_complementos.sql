-- =============================================================================
-- 0006 · Búsqueda: complementos más precisos
-- -----------------------------------------------------------------------------
-- ESTADO: PENDIENTE
-- Idempotente y atómica. Requiere 0004.
--
-- buscar_productos() tomaba las categorías de los 12 primeros resultados para
-- sugerir complementos; con búsquedas amplias («aceite») aparecían cosas sin
-- relación (pastillas vía líquido de frenos). Ahora:
--   · categorías de los 4 primeros resultados,
--   · más las subcategorías (no las ramas principales) que nombra el texto,
--   · hasta 6 complementos.
-- =============================================================================

begin;

set local search_path = public, extensions;

create or replace function public.buscar_productos(
  p_empresa uuid,
  p_texto text default '',
  p_id_marca integer default null,
  p_id_modelo integer default null,
  p_id_modelo_anio integer default null,
  p_id_especificacion integer default null,
  p_id_categoria integer default null,
  p_limite integer default 60
)
returns table (
  id bigint,
  codigo text,
  nombre text,
  marca text,
  id_categoria integer,
  categoria text,
  oem text,
  numero_parte text,
  condicion text,
  unidad text,
  precio numeric,
  exento boolean,
  costo numeric,
  existencia numeric,
  controla_inventario boolean,
  disponible boolean,
  ubicacion text,
  imagen text,
  grupo text,
  ajuste text,
  relevancia real,
  orden integer
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_miembro boolean := public.es_miembro(p_empresa);
  v_marca integer := p_id_marca;
  v_modelo integer := p_id_modelo;
  v_anio integer := p_id_modelo_anio;
  v_esp integer := p_id_especificacion;
  v_texto text := btrim(public.wp_fonetico(left(coalesce(p_texto, ''), 120)));
  v_codigo text := public.wp_codigo(left(coalesce(p_texto, ''), 120));
  v_tokens text[];
  v_limite integer := least(greatest(coalesce(p_limite, 60), 1), 200);
  v_categorias integer[];
  v_difuso boolean := false;
begin
  if p_empresa is null then
    return;
  end if;
  if not v_miembro and not exists (select 1 from public.empresas e where e.id = p_empresa and e.activo) then
    return;
  end if;

  if v_esp is not null then
    select e.id_modelo_anio into v_anio from public.especificaciones e where e.id = v_esp;
  end if;
  if v_anio is not null then
    select ya.id_modelo into v_modelo from public.modelos_anios ya where ya.id = v_anio;
  end if;
  if v_modelo is not null then
    select mo.id_marca into v_marca from public.modelos mo where mo.id = v_modelo;
  end if;

  v_tokens := array(
    select distinct t from unnest(regexp_split_to_array(v_texto, '[^a-z0-9ñ]+')) t
     where char_length(t) >= 2 or t ~ '^[0-9]$'
     limit 8
  );
  if char_length(v_codigo) < 3 then
    v_codigo := '';
  end if;

  if p_id_categoria is not null then
    v_categorias := array(select public.categorias_subarbol(p_id_categoria));
  end if;

  -- Tolerancia a errores de dedo solo si la búsqueda exacta no encuentra nada
  -- (es la parte cara).
  if cardinality(v_tokens) > 0 then
    v_difuso := not exists (
      select 1 from public.productos p
       where p.id_empresa = p_empresa and p.activo
         and not exists (select 1 from unnest(v_tokens) t where not (p.texto_busqueda like '%' || t || '%'))
    ) and not exists (
      select 1 from public.productos p
       where v_codigo <> '' and p.id_empresa = p_empresa and p.activo and p.codigos like '%' || v_codigo || '%'
    );
  end if;

  return query
  with base as (
    select p.*
      from public.productos p
     where p.id_empresa = p_empresa
       and p.activo
       and (v_miembro or (p.visible_catalogo and (not p.controla_inventario or p.existencia > 0)))
       and (v_categorias is null or p.id_categoria = any (v_categorias))
  ),
  coincidencias as (
    select b.*,
           case
             when v_codigo <> '' and b.codigos like '% ' || v_codigo || ' %' then 100
             when v_codigo <> '' and b.codigos like '% ' || v_codigo || '%' then 60
             when v_codigo <> '' and char_length(v_codigo) >= 5 and b.codigos like '%' || v_codigo || '%' then 30
             else 0
           end as puntos_codigo,
           (select coalesce(sum(case when b.texto_busqueda like '%' || t || '%' then 1.0
                                     when v_difuso then word_similarity(t, b.texto_busqueda)
                                     else 0 end), 0)
              from unnest(v_tokens) t)::real as puntos_texto
      from base b
     where cardinality(v_tokens) = 0
        or (v_codigo <> '' and b.codigos like '%' || v_codigo || '%')
        or not exists (
          select 1 from unnest(v_tokens) t
           where not (b.texto_busqueda like '%' || t || '%'
                      or (v_difuso and char_length(t) >= 4 and t <% b.texto_busqueda))
        )
  ),
  ajustes as (
    select k.id_producto,
           max(case
                 when (k.id_modelo is null or k.id_modelo = v_modelo)
                  and (k.id_modelo_anio is null or k.id_modelo_anio = v_anio)
                  and (k.id_especificacion is null or k.id_especificacion = v_esp)
                 then k.nivel * 10
                 else k.nivel
               end) as puntos
      from public.productos_compatibilidades k
     where v_marca is not null
       and k.id_empresa = p_empresa
       and k.id_marca = v_marca
       and (v_modelo is null or k.id_modelo is null or k.id_modelo = v_modelo)
       and (v_anio is null or k.id_modelo_anio is null or k.id_modelo_anio = v_anio)
       and (v_esp is null or k.id_especificacion is null or k.id_especificacion = v_esp)
     group by k.id_producto
  ),
  clasificados as (
    select c.*,
           a.puntos as puntos_ajuste,
           case
             when v_marca is null then 'todos'
             when a.puntos is not null then 'vehiculo'
             when not exists (select 1 from public.productos_compatibilidades k where k.id_producto = c.id) then 'general'
           end as grupo_calc,
           case
             when a.puntos >= 40 then 'motor'
             when a.puntos >= 30 then 'anio'
             when a.puntos >= 20 then 'modelo'
             when a.puntos >= 10 then 'marca'
             when a.puntos is not null then 'verificar'
           end as ajuste_calc,
           (c.puntos_codigo
             + c.puntos_texto * 10
             + case when v_texto <> '' and public.wp_fonetico(c.nombre) like v_texto || '%' then 15 else 0 end
             + case when v_texto <> '' then similarity(public.wp_fonetico(c.nombre), v_texto) * 10 else 0 end
             + case when not c.controla_inventario or c.existencia > 0 then 2 else 0 end
           )::real as puntos_total
      from coincidencias c
      left join ajustes a on a.id_producto = c.id
  ),
  principal as (
    select x.*,
           row_number() over (
             order by
               case x.grupo_calc when 'vehiculo' then case when x.puntos_ajuste >= 10 then 0 else 1 end
                                 when 'todos' then 0 else 2 end,
               x.puntos_total desc,
               coalesce(x.puntos_ajuste, 0) desc,
               (not x.controla_inventario or x.existencia > 0) desc,
               x.nombre
           )::integer as posicion
      from clasificados x
     where x.grupo_calc is not null
  ),
  limitados as (
    select * from principal where posicion <= v_limite
  ),
  -- Categorías de lo encontrado + las que nombra el texto → sus relacionadas.
  categorias_base as (
    select l.id_categoria from limitados l where l.posicion <= 4
    union
    select c.id from public.categorias c
     where cardinality(v_tokens) > 0 and c.activa
       and c.id_padre is not null
       and not exists (
         select 1 from unnest(v_tokens) t
          where not (public.wp_fonetico(concat_ws(' ', c.nombre, c.sinonimos)) like '%' || t || '%')
       )
  ),
  relacionadas as (
    select distinct r.id_relacionada as id_categoria
      from public.categorias_relacionadas r
     where r.id_categoria in (select cb.id_categoria from categorias_base cb)
       and r.id_relacionada not in (select cb.id_categoria from categorias_base cb)
  ),
  complementos as (
    select b.*,
           a.puntos as puntos_ajuste,
           row_number() over (
             order by coalesce(a.puntos, 0) desc,
                      (not b.controla_inventario or b.existencia > 0) desc,
                      b.nombre
           )::integer as posicion
      from base b
      left join ajustes a on a.id_producto = b.id
     where b.id_categoria in (select rl.id_categoria from relacionadas rl)
       and b.id not in (select l.id from limitados l)
       and (v_marca is null
            or a.puntos is not null
            or not exists (select 1 from public.productos_compatibilidades k where k.id_producto = b.id))
  )
  select l.id, l.codigo, l.nombre, mp.nombre, l.id_categoria, cat.nombre, l.oem, l.numero_parte,
         l.condicion, l.unidad, l.precio, l.exento,
         case when v_miembro then l.costo end,
         case when v_miembro then l.existencia end,
         l.controla_inventario,
         (not l.controla_inventario or l.existencia > 0),
         case when v_miembro then l.ubicacion end,
         (select coalesce(i.ruta_miniatura, i.ruta) from public.productos_imagenes i
           where i.id_producto = l.id order by i.orden, i.id limit 1),
         l.grupo_calc, l.ajuste_calc, l.puntos_total, l.posicion
    from limitados l
    join public.categorias cat on cat.id = l.id_categoria
    left join public.marcas_productos mp on mp.id = l.id_marca_producto
  union all
  select cp.id, cp.codigo, cp.nombre, mp.nombre, cp.id_categoria, cat.nombre, cp.oem, cp.numero_parte,
         cp.condicion, cp.unidad, cp.precio, cp.exento,
         case when v_miembro then cp.costo end,
         case when v_miembro then cp.existencia end,
         cp.controla_inventario,
         (not cp.controla_inventario or cp.existencia > 0),
         case when v_miembro then cp.ubicacion end,
         (select coalesce(i.ruta_miniatura, i.ruta) from public.productos_imagenes i
           where i.id_producto = cp.id order by i.orden, i.id limit 1),
         'complemento',
         case
           when cp.puntos_ajuste >= 10 then 'vehiculo'
           when cp.puntos_ajuste is not null then 'verificar'
         end,
         0::real,
         10000 + cp.posicion
    from complementos cp
    join public.categorias cat on cat.id = cp.id_categoria
    left join public.marcas_productos mp on mp.id = cp.id_marca_producto
   where cp.posicion <= 6
     and (cardinality(v_tokens) > 0 or v_codigo <> '' or p_id_categoria is not null);
end;
$$;

commit;
