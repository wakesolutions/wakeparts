-- =============================================================================
-- 0009 · Reporte de ventas, entradas de inventario e importación de productos
-- -----------------------------------------------------------------------------
-- 1. reporte_ventas(empresa, desde, hasta): primer reporte con el contrato
--    genérico de los tableros de reportes (ver docs/componentes.md):
--      { indicadores: { clave: { valor, anterior } },
--        serie:       [ { fecha, <clave>: valor, … } ],   -- un punto por día
--        rankings:    { clave: [ { … }, … ] } }
--    `anterior` es el mismo indicador en el período previo de igual largo.
-- 2. entrada_inventario(empresa, lineas, referencia, modo_costo): suma
--    existencias (compras, devoluciones de proveedor, conteos) en una sola
--    transacción; el kardex la registra como «compra».
-- 3. importar_productos(empresa, filas, actualizar, probar): alta/actualización
--    masiva desde Excel. Resuelve categoría y marca por nombre. Con `probar`
--    hace todo y lo deshace: sirve para revisar el archivo antes de importar.
--
-- Las tres son security invoker: corren con los permisos (RLS) de quien llama.
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Reporte de ventas
-- -----------------------------------------------------------------------------

create or replace function public.reporte_ventas(p_empresa uuid, p_desde date, p_hasta date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_dias int := p_hasta - p_desde + 1;
  v_prev_desde date := p_desde - (p_hasta - p_desde + 1);
  v_prev_hasta date := p_desde - 1;
  -- El costo y la utilidad solo los ven dueño y administradores.
  v_ve_costo boolean := public.tiene_rol(p_empresa, array['dueno', 'admin']);
  v_actual jsonb;
  v_previo jsonb;
  v_resultado jsonb;
begin
  if not public.es_miembro(p_empresa) then
    raise exception 'No tenés acceso a esta empresa.' using errcode = '42501';
  end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde then
    raise exception 'Rango de fechas no válido.' using errcode = '22023';
  end if;
  if v_dias > 400 then
    raise exception 'El rango máximo es de 400 días.' using errcode = '22023';
  end if;

  -- Totales de un período (facturas emitidas, cotizaciones y anuladas).
  with base as (
    select d.*, (d.fecha at time zone 'America/Tegucigalpa')::date as dia
      from public.documentos d
     where d.id_empresa = p_empresa
       and (d.fecha at time zone 'America/Tegucigalpa')::date between v_prev_desde and p_hasta
  ),
  lineas as (
    select b.dia, l.total, l.costo, l.cantidad
      from base b
      join public.documentos_lineas l on l.id_documento = b.id
     where b.tipo = 'factura' and b.estado = 'emitido'
  ),
  periodos as (
    select 'actual' as periodo, p_desde as desde, p_hasta as hasta
    union all
    select 'previo', v_prev_desde, v_prev_hasta
  )
  select
    jsonb_object_agg(p.periodo, jsonb_build_object(
      'ventas', coalesce((select sum(b.total) from base b
                           where b.tipo = 'factura' and b.estado = 'emitido' and b.dia between p.desde and p.hasta), 0),
      'neto', coalesce((select sum(b.importe_gravado + b.importe_exento) from base b
                         where b.tipo = 'factura' and b.estado = 'emitido' and b.dia between p.desde and p.hasta), 0),
      'isv', coalesce((select sum(b.isv) from base b
                        where b.tipo = 'factura' and b.estado = 'emitido' and b.dia between p.desde and p.hasta), 0),
      'descuentos', coalesce((select sum(b.descuento) from base b
                               where b.tipo = 'factura' and b.estado = 'emitido' and b.dia between p.desde and p.hasta), 0),
      'facturas', (select count(*) from base b
                    where b.tipo = 'factura' and b.estado = 'emitido' and b.dia between p.desde and p.hasta),
      'cotizaciones', (select count(*) from base b
                        where b.tipo = 'cotizacion' and b.dia between p.desde and p.hasta),
      'cotizado', coalesce((select sum(b.total) from base b
                             where b.tipo = 'cotizacion' and b.dia between p.desde and p.hasta), 0),
      'anuladas', (select count(*) from base b
                    where b.tipo = 'factura' and b.estado = 'anulado' and b.dia between p.desde and p.hasta),
      'utilidad', case when v_ve_costo then
        coalesce((select sum(l.total - coalesce(l.costo, 0) * l.cantidad) from lineas l
                   where l.dia between p.desde and p.hasta), 0) end
    ))
    into v_actual
    from periodos p;

  v_previo := v_actual -> 'previo';
  v_actual := v_actual -> 'actual';

  v_resultado := jsonb_build_object(
    'periodo', jsonb_build_object('desde', p_desde, 'hasta', p_hasta, 'dias', v_dias),
    'indicadores', jsonb_build_object(
      'ventas', jsonb_build_object('valor', v_actual -> 'ventas', 'anterior', v_previo -> 'ventas'),
      'facturas', jsonb_build_object('valor', v_actual -> 'facturas', 'anterior', v_previo -> 'facturas'),
      'ticket', jsonb_build_object(
        'valor', case when (v_actual ->> 'facturas')::int > 0
                      then round((v_actual ->> 'ventas')::numeric / (v_actual ->> 'facturas')::int, 2) else 0 end,
        'anterior', case when (v_previo ->> 'facturas')::int > 0
                         then round((v_previo ->> 'ventas')::numeric / (v_previo ->> 'facturas')::int, 2) else 0 end),
      'utilidad', case when v_ve_costo then
        jsonb_build_object('valor', v_actual -> 'utilidad', 'anterior', v_previo -> 'utilidad') end,
      'margen', case when v_ve_costo then jsonb_build_object(
        'valor', case when (v_actual ->> 'neto')::numeric > 0
                      then round((v_actual ->> 'utilidad')::numeric / (v_actual ->> 'neto')::numeric * 100, 1) else 0 end,
        'anterior', case when (v_previo ->> 'neto')::numeric > 0
                         then round((v_previo ->> 'utilidad')::numeric / (v_previo ->> 'neto')::numeric * 100, 1) else 0 end) end,
      'isv', jsonb_build_object('valor', v_actual -> 'isv', 'anterior', v_previo -> 'isv'),
      'descuentos', jsonb_build_object('valor', v_actual -> 'descuentos', 'anterior', v_previo -> 'descuentos'),
      'cotizaciones', jsonb_build_object('valor', v_actual -> 'cotizaciones', 'anterior', v_previo -> 'cotizaciones'),
      'cotizado', jsonb_build_object('valor', v_actual -> 'cotizado', 'anterior', v_previo -> 'cotizado'),
      'anuladas', jsonb_build_object('valor', v_actual -> 'anuladas', 'anterior', v_previo -> 'anuladas')
    ),
    -- Un punto por día, con ceros donde no hubo ventas.
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'fecha', g.dia::date,
               'ventas', coalesce(v.ventas, 0),
               'facturas', coalesce(v.facturas, 0)) order by g.dia), '[]'::jsonb)
        from generate_series(p_desde, p_hasta, interval '1 day') as g (dia)
        left join (
          select (d.fecha at time zone 'America/Tegucigalpa')::date as dia,
                 sum(d.total) as ventas, count(*) as facturas
            from public.documentos d
           where d.id_empresa = p_empresa and d.tipo = 'factura' and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
        ) v on v.dia = g.dia::date
    ),
    'rankings', jsonb_build_object(
      'productos', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select coalesce(max(l.codigo), '—') as codigo,
                 max(l.descripcion) as descripcion,
                 sum(l.cantidad) as cantidad,
                 sum(l.total) as total,
                 case when v_ve_costo then sum(l.total - coalesce(l.costo, 0) * l.cantidad) end as utilidad
            from public.documentos d
            join public.documentos_lineas l on l.id_documento = d.id
           where d.id_empresa = p_empresa and d.tipo = 'factura' and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by coalesce(l.id_producto::text, l.descripcion)
           order by sum(l.total) desc
           limit 10
        ) x
      ),
      'categorias', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select coalesce(c.nombre, 'Sin registrar') as nombre, sum(l.total) as total, sum(l.cantidad) as cantidad
            from public.documentos d
            join public.documentos_lineas l on l.id_documento = d.id
            left join public.productos p on p.id = l.id_producto
            left join public.categorias c on c.id = p.id_categoria
           where d.id_empresa = p_empresa and d.tipo = 'factura' and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
           order by 2 desc
           limit 8
        ) x
      ),
      'vendedores', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select coalesce(u.nombre, 'Sin usuario') as nombre, count(*) as facturas, sum(d.total) as total
            from public.documentos d
            left join public.usuarios u on u.id = d.creado_por
           where d.id_empresa = p_empresa and d.tipo = 'factura' and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
           order by 3 desc
           limit 10
        ) x
      ),
      'clientes', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select d.cliente_nombre as nombre, count(*) as facturas, sum(d.total) as total
            from public.documentos d
           where d.id_empresa = p_empresa and d.tipo = 'factura' and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
           order by 3 desc
           limit 8
        ) x
      )
    )
  );

  return v_resultado;
end;
$$;

revoke all on function public.reporte_ventas(uuid, date, date) from public, anon;
grant execute on function public.reporte_ventas(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Entrada de inventario (varias líneas, una transacción)
-- -----------------------------------------------------------------------------
-- p_lineas: [{ "id_producto": 1, "cantidad": 5, "costo": 120.50 }, …]
-- p_modo_costo: 'promedio' (ponderado con lo que había) · 'ultimo' (reemplaza)
--               · 'mantener' (no toca el costo). Sin costo en la línea, no se toca.

create or replace function public.entrada_inventario(
  p_empresa uuid,
  p_lineas jsonb,
  p_referencia text default null,
  p_modo_costo text default 'promedio'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_linea jsonb;
  v_producto public.productos;
  v_cantidad numeric;
  v_costo numeric;
  v_nuevo_costo numeric;
  v_unidades numeric := 0;
  v_valor numeric := 0;
  v_n int := 0;
begin
  if not public.tiene_rol(p_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden cargar inventario.' using errcode = '42501';
  end if;
  if p_modo_costo not in ('promedio', 'ultimo', 'mantener') then
    raise exception 'Modo de costo no válido.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agregá al menos un producto.' using errcode = '22023';
  end if;

  -- El kardex toma el tipo y la referencia de estas variables (solo en esta transacción).
  perform set_config('wp.movimiento_tipo', 'compra', true);
  perform set_config('wp.movimiento_ref', coalesce(nullif(btrim(p_referencia), ''), 'Entrada de inventario'), true);

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cantidad := (v_linea ->> 'cantidad')::numeric;
    v_costo := nullif(v_linea ->> 'costo', '')::numeric;
    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Las cantidades deben ser mayores que cero.' using errcode = '22023';
    end if;
    if v_costo is not null and v_costo < 0 then
      raise exception 'El costo no puede ser negativo.' using errcode = '22023';
    end if;

    select * into v_producto
      from public.productos p
     where p.id = (v_linea ->> 'id_producto')::bigint and p.id_empresa = p_empresa
       for update;
    if not found then
      raise exception 'Un producto de la lista no existe en tu inventario.' using errcode = 'P0002';
    end if;
    if not v_producto.controla_inventario then
      raise exception '«%» es un servicio: no lleva inventario.', v_producto.nombre using errcode = '22023';
    end if;

    v_nuevo_costo := case
      when v_costo is null or p_modo_costo = 'mantener' then v_producto.costo
      when p_modo_costo = 'ultimo' then v_costo
      -- Promedio ponderado; si la existencia era negativa o cero, manda el costo nuevo.
      when greatest(v_producto.existencia, 0) = 0 then v_costo
      else round((v_producto.existencia * v_producto.costo + v_cantidad * v_costo)
                 / (v_producto.existencia + v_cantidad), 2)
    end;

    update public.productos
       set existencia = existencia + v_cantidad,
           costo = v_nuevo_costo
     where id = v_producto.id;

    v_n := v_n + 1;
    v_unidades := v_unidades + v_cantidad;
    v_valor := v_valor + v_cantidad * coalesce(v_costo, v_producto.costo);
  end loop;

  return jsonb_build_object('productos', v_n, 'unidades', v_unidades, 'valor', round(v_valor, 2));
end;
$$;

revoke all on function public.entrada_inventario(uuid, jsonb, text, text) from public, anon;
grant execute on function public.entrada_inventario(uuid, jsonb, text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Importación de productos
-- -----------------------------------------------------------------------------

-- Categoría a partir de lo que escribió el usuario: slug, nombre, sinónimo o
-- ruta «Frenos › Pastillas». Prefiere subcategorías sobre categorías principales.
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
            (c.id_padre is not null) desc,
            c.id
   limit 1;
$$;

create or replace function public.importar_productos(
  p_empresa uuid,
  p_filas jsonb,
  p_actualizar boolean default true,
  p_probar boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
#variable_conflict use_column
declare
  v_fila jsonb;
  v_n int := 0;
  v_numero int;
  v_codigo text;
  v_categoria int;
  v_marca_txt text;
  v_marca int;
  v_existente public.productos;
  v_unidad text;
  v_condicion text;
  v_creados int := 0;
  v_actualizados int := 0;
  v_saltados int := 0;
  v_marcas_nuevas text[] := '{}';
  v_errores jsonb := '[]'::jsonb;
  v_resultado jsonb;
begin
  if not tiene_rol(p_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden importar productos.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Formato de filas no válido.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_filas) > 1000 then
    raise exception 'Máximo 1000 filas por envío.' using errcode = '22023';
  end if;

  perform set_config('wp.movimiento_ref', 'Importación', true);

  begin
    for v_fila in select * from jsonb_array_elements(p_filas) loop
      v_n := v_n + 1;
      -- Número de fila del archivo (para los mensajes); si no viene, la posición.
      v_numero := coalesce((v_fila ->> '_fila')::int, v_n);

      begin
        if nullif(btrim(v_fila ->> 'nombre'), '') is null and nullif(btrim(v_fila ->> 'codigo'), '') is null then
          raise exception 'Falta el nombre.';
        end if;

        v_codigo := nullif(upper(btrim(v_fila ->> 'codigo')), '');
        v_existente := null;
        if v_codigo is not null then
          select * into v_existente from productos p where p.id_empresa = p_empresa and p.codigo = v_codigo;
        end if;

        if v_existente.id is not null and not p_actualizar then
          v_saltados := v_saltados + 1;
          continue;
        end if;

        -- Categoría: obligatoria para productos nuevos.
        v_categoria := null;
        if nullif(btrim(v_fila ->> 'categoria'), '') is not null then
          v_categoria := resolver_categoria(v_fila ->> 'categoria');
          if v_categoria is null then
            raise exception 'La categoría «%» no existe.', btrim(v_fila ->> 'categoria');
          end if;
        elsif v_existente.id is null then
          raise exception 'Falta la categoría.';
        end if;

        -- Marca: del catálogo general o propia; si no existe, se crea como propia.
        v_marca := null;
        v_marca_txt := nullif(btrim(v_fila ->> 'marca'), '');
        if v_marca_txt is not null then
          select m.id into v_marca
            from marcas_productos m
           where (m.id_empresa is null or m.id_empresa = p_empresa)
             and wp_normalizar(m.nombre) = wp_normalizar(v_marca_txt)
           order by m.id_empresa nulls first
           limit 1;
          if v_marca is null then
            insert into marcas_productos (id_empresa, nombre) values (p_empresa, v_marca_txt)
            returning id into v_marca;
            v_marcas_nuevas := v_marcas_nuevas || upper(v_marca_txt);
          end if;
        end if;

        -- Unidad y condición: se aceptan con tildes y mayúsculas («Galón», «Usado»).
        v_unidad := nullif(wp_normalizar(btrim(v_fila ->> 'unidad')), '');
        v_unidad := case v_unidad when 'unidades' then 'unidad' when 'u' then 'unidad' when 'und' then 'unidad'
                                  when 'pares' then 'par' when 'juegos' then 'juego' when 'galones' then 'galon'
                                  when 'litros' then 'litro' when 'cuartos' then 'cuarto' when 'cajas' then 'caja'
                                  else v_unidad end;
        v_condicion := nullif(wp_normalizar(btrim(v_fila ->> 'condicion')), '');

        if v_existente.id is null then
          insert into productos (
            id_empresa, codigo, nombre, descripcion, id_categoria, id_marca_producto, oem, numero_parte,
            codigo_barras, referencias, condicion, unidad, costo, precio, exento, existencia,
            existencia_minima, ubicacion, garantia_dias
          ) values (
            p_empresa, coalesce(v_codigo, ''), btrim(v_fila ->> 'nombre'), v_fila ->> 'descripcion',
            v_categoria, v_marca, v_fila ->> 'oem', v_fila ->> 'numero_parte', v_fila ->> 'codigo_barras',
            v_fila ->> 'referencias', coalesce(v_condicion, 'nuevo'), coalesce(v_unidad, 'unidad'),
            coalesce((v_fila ->> 'costo')::numeric, 0), coalesce((v_fila ->> 'precio')::numeric, 0),
            coalesce((v_fila ->> 'exento')::boolean, false), coalesce((v_fila ->> 'existencia')::numeric, 0),
            coalesce((v_fila ->> 'existencia_minima')::numeric, 0), v_fila ->> 'ubicacion',
            (v_fila ->> 'garantia_dias')::int
          );
          v_creados := v_creados + 1;
        else
          -- Solo cambia lo que trae el archivo; lo vacío se respeta.
          update productos p set
            nombre = coalesce(nullif(btrim(v_fila ->> 'nombre'), ''), p.nombre),
            descripcion = coalesce(nullif(v_fila ->> 'descripcion', ''), p.descripcion),
            id_categoria = coalesce(v_categoria, p.id_categoria),
            id_marca_producto = coalesce(v_marca, p.id_marca_producto),
            oem = coalesce(nullif(v_fila ->> 'oem', ''), p.oem),
            numero_parte = coalesce(nullif(v_fila ->> 'numero_parte', ''), p.numero_parte),
            codigo_barras = coalesce(nullif(v_fila ->> 'codigo_barras', ''), p.codigo_barras),
            referencias = coalesce(nullif(v_fila ->> 'referencias', ''), p.referencias),
            condicion = coalesce(v_condicion, p.condicion),
            unidad = coalesce(v_unidad, p.unidad),
            costo = coalesce((v_fila ->> 'costo')::numeric, p.costo),
            precio = coalesce((v_fila ->> 'precio')::numeric, p.precio),
            exento = coalesce((v_fila ->> 'exento')::boolean, p.exento),
            existencia = coalesce((v_fila ->> 'existencia')::numeric, p.existencia),
            existencia_minima = coalesce((v_fila ->> 'existencia_minima')::numeric, p.existencia_minima),
            ubicacion = coalesce(nullif(v_fila ->> 'ubicacion', ''), p.ubicacion),
            garantia_dias = coalesce((v_fila ->> 'garantia_dias')::int, p.garantia_dias)
          where p.id = v_existente.id;
          v_actualizados := v_actualizados + 1;
        end if;
      exception when others then
        v_errores := v_errores || jsonb_build_object(
          'fila', v_numero,
          'mensaje', case
            when sqlstate = '22P02' then 'Hay un número o dato con formato no válido.'
            when sqlerrm like '%productos_unidad_check%' then 'Unidad no válida (unidad, par, juego, kit, litro, galón, cuarto, metro, caja).'
            when sqlerrm like '%productos_condicion_check%' then 'Condición no válida (nuevo, usado o reconstruido).'
            when sqlstate = '23514' then 'Un valor está fuera de lo permitido (¿precio o costo negativo?).'
            else sqlerrm end);
      end;
    end loop;

    v_resultado := jsonb_build_object(
      'creados', v_creados, 'actualizados', v_actualizados, 'saltados', v_saltados,
      'marcas_nuevas', (select coalesce(jsonb_agg(distinct m), '[]'::jsonb) from unnest(v_marcas_nuevas) m),
      'errores', v_errores, 'probado', p_probar);

    -- En modo prueba se deshace todo lo hecho en este bloque.
    if p_probar then
      raise exception using errcode = 'WP001', message = 'probar';
    end if;
  exception when sqlstate 'WP001' then
    null;
  end;

  return v_resultado;
end;
$$;

revoke all on function public.importar_productos(uuid, jsonb, boolean, boolean) from public, anon;
grant execute on function public.importar_productos(uuid, jsonb, boolean, boolean) to authenticated;
revoke all on function public.resolver_categoria(text) from public, anon;
grant execute on function public.resolver_categoria(text) to authenticated;

commit;
