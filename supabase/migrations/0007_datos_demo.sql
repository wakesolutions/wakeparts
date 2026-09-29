-- =============================================================================
-- 0007 · Datos de ejemplo por empresa
-- -----------------------------------------------------------------------------
-- `cargar_datos_demo(p_empresa)`: carga en la empresa ~45 productos de ejemplo
-- (repuestos, generales y mano de obra), sus compatibilidades con vehículos del
-- catálogo y 3 clientes. Sirve para que un taller nuevo pruebe el mostrador sin
-- capturar nada. La llama el botón «Cargar datos de ejemplo» del módulo Taller.
--
-- - security invoker: corre con los permisos (RLS) de quien la llama; además
--   exige dueño o admin de la empresa.
-- - Idempotente: salta productos cuyo código ya existe, compatibilidades
--   repetidas y clientes con el mismo nombre. Se puede apretar dos veces.
-- - No crea CAI: es un dato fiscal real que cada taller registra.
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

create or replace function public.cargar_datos_demo(p_empresa uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_productos int := 0;
  v_compat int := 0;
  v_clientes int := 0;
begin
  if not public.tiene_rol(p_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden cargar datos de ejemplo.'
      using errcode = '42501';
  end if;

  -- código, nombre, categoría (slug), marca de repuesto, costo, precio, existencia,
  -- mínimo, ubicación, oem, número de parte, referencias, condición, origen, unidad,
  -- vehículos: 'MARCA|MODELO|desde|hasta' · 'MARCA|MODELO' (todos los años) ·
  --            'marca|MARCA' · 'motor|MARCA|MODELO|CÓDIGO'
  create temporary table if not exists demo (
    codigo text, nombre text, categoria text, marca text, costo numeric, precio numeric,
    existencia numeric, minima numeric, ubicacion text, oem text, numero_parte text,
    referencias text, condicion text, origen text, unidad text, vehiculos text[]
  ) on commit drop;

  truncate pg_temp.demo;
  insert into pg_temp.demo values
    ('PF-0101', 'Pastillas de freno delanteras cerámicas', 'pastillas', 'AKEBONO', 520, 890, 8, 3, 'A1', '04465-02220', null, 'D1210', 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008', 'TOYOTA|YARIS|2006|2012']),
    ('PF-0102', 'Pastillas de freno delanteras', 'pastillas', 'BOSCH', 480, 820, 6, 2, 'A1', '04465-0K240', null, 'D1303', 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('PF-0103', 'Pastillas de freno delanteras', 'pastillas', 'BREMBO', 610, 1050, 4, 2, 'A1', '45022-SNA-A01', null, null, 'nuevo', null, 'unidad', array['HONDA|CIVIC|2006|2011']),
    ('PF-0104', 'Pastillas de freno delanteras', 'pastillas', 'SAKURA', 390, 690, 10, 3, 'A1', 'D1094', null, null, 'nuevo', null, 'unidad', array['NISSAN|FRONTIER|2005|2014']),
    ('PF-0105', 'Pastillas de freno delanteras', 'pastillas', 'CTR', 350, 620, 1, 3, 'A2', null, null, null, 'nuevo', null, 'unidad', array['HYUNDAI|ACCENT|2006|2011', 'KIA|RIO|2006|2011']),
    ('ZF-0201', 'Zapatas de freno traseras', 'zapatas', 'AKEBONO', 430, 760, 5, 2, 'A2', '04495-0K120', null, null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('DF-0301', 'Disco de freno delantero ventilado', 'discos', 'BREMBO', 780, 1350, 4, 2, 'B1', '43512-02190', null, null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008']),
    ('DF-0302', 'Disco de freno delantero', 'discos', 'TRW', 950, 1620, 2, 2, 'B1', '43512-0K090', null, null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('FA-0401', 'Filtro de aceite', 'filtro-aceite', 'DENSO', 65, 125, 40, 10, 'C1', '90915-YZZE1', null, 'PH4967, W68/3', 'nuevo', null, 'unidad', array['marca|TOYOTA']),
    ('FA-0402', 'Filtro de aceite', 'filtro-aceite', 'WIX', 75, 140, 25, 8, 'C1', '15400-PLM-A02', null, null, 'nuevo', null, 'unidad', array['marca|HONDA']),
    ('FA-0403', 'Filtro de aceite', 'filtro-aceite', 'SAKURA', 70, 130, 18, 8, 'C1', '15208-65F0E', null, null, 'nuevo', null, 'unidad', array['marca|NISSAN']),
    ('FA-0404', 'Filtro de aceite diésel', 'filtro-aceite', 'MANN-FILTER', 180, 320, 12, 4, 'C1', '90915-YZZD2', null, null, 'nuevo', null, 'unidad', array['motor|TOYOTA|HILUX|2KD-FTV']),
    ('FI-0501', 'Filtro de aire de motor', 'filtro-aire', 'SAKURA', 160, 290, 9, 3, 'C2', '17801-21050', null, null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008', 'TOYOTA|YARIS|2006|2012']),
    ('FI-0502', 'Filtro de aire de motor', 'filtro-aire', 'MANN-FILTER', 240, 420, 6, 3, 'C2', '17801-0C010', null, null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('FC-0601', 'Filtro de cabina con carbón activado', 'filtro-cabina', 'DENSO', 190, 350, 7, 2, 'C3', '87139-YZZ08', null, null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008', 'TOYOTA|RAV4|2006|2012', 'TOYOTA|YARIS|2006|2012']),
    ('FD-0701', 'Filtro de combustible diésel', 'filtro-combustible', 'DENSO', 380, 650, 5, 2, 'C3', '23390-0L041', null, null, 'nuevo', null, 'unidad', array['motor|TOYOTA|HILUX|2KD-FTV']),
    ('BJ-0801', 'Bujía de iridio', 'bujias', 'NGK', 150, 260, 32, 8, 'D1', '90919-01210', 'IZFR6K11', null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008', 'TOYOTA|YARIS|2006|2012']),
    ('BJ-0802', 'Bujía de iridio', 'bujias', 'DENSO', 165, 280, 16, 8, 'D1', null, 'SK20R11', null, 'nuevo', null, 'unidad', array['HONDA|CIVIC|2006|2011', 'HONDA|CRV|2007|2011']),
    ('AM-0901', 'Amortiguador delantero', 'amortiguadores', 'KYB', 1150, 1890, 4, 2, 'E1', null, '339038', null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008']),
    ('AM-0902', 'Amortiguador delantero', 'amortiguadores', 'MONROE', 1300, 2150, 2, 2, 'E1', null, null, null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('AM-0903', 'Amortiguador trasero', 'amortiguadores', 'KYB', 980, 1650, 3, 2, 'E1', null, null, null, 'nuevo', null, 'unidad', array['NISSAN|FRONTIER|2005|2014']),
    ('RT-1001', 'Rótula inferior', 'rotulas', '555', 420, 720, 6, 2, 'E2', null, 'SB-3882', null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('TR-1101', 'Terminal de dirección', 'terminales', '555', 360, 610, 8, 2, 'E2', null, 'SE-3791', null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015', 'TOYOTA|LAND CRUISER PRADO|2003|2009']),
    ('BL-1201', 'Balinera de rueda delantera', 'balineras-rueda', 'KOYO', 520, 890, 0, 2, 'E3', null, null, null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008']),
    ('KE-1301', 'Kit de embrague', 'embrague', 'EXEDY', 3200, 5200, 2, 1, 'F1', null, 'TYK-2151', null, 'nuevo', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('BA-1401', 'Banda de accesorios 6PK', 'bandas', 'GATES', 310, 540, 7, 2, 'F2', null, '6PK1215', null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008']),
    ('KT-1501', 'Kit de tiempo con bomba de agua', 'distribucion', 'AISIN', 2900, 4800, 2, 1, 'F2', null, null, null, 'nuevo', null, 'unidad', array['motor|TOYOTA|HILUX|2KD-FTV']),
    ('BW-1601', 'Bomba de agua', 'bomba-agua', 'AISIN', 1400, 2350, 3, 1, 'F3', '16100-29085', null, null, 'nuevo', null, 'unidad', array['TOYOTA|COROLLA|2003|2008']),
    ('TE-1701', 'Termostato 82 °C', 'termostatos', 'DENSO', 280, 480, 5, 2, 'F3', null, null, null, 'nuevo', null, 'unidad', array['marca|TOYOTA']),
    ('AL-1801', 'Alternador reconstruido', 'alternadores', 'DENSO', 2600, 4200, 1, 0, 'G1', null, null, null, 'reconstruido', null, 'unidad', array['TOYOTA|HILUX|2005|2015']),
    ('FR-1901', 'Faro delantero izquierdo (usado)', 'faros', null, 900, 2400, 1, 0, 'G2', null, null, null, 'usado', 'original', 'unidad', array['TOYOTA|COROLLA|2005|2005']),
    ('PL-2001', 'Plumilla limpiaparabrisas 22"', 'plumillas', 'BOSCH', 140, 250, 20, 6, 'H1', null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    -- Generales (le sirven a cualquier vehículo)
    ('AC-2101', 'Aceite 20W50 mineral · galón', 'aceite-motor', 'CASTROL', 520, 780, 24, 8, 'I1', null, null, null, 'nuevo', null, 'galon', array[]::text[]),
    ('AC-2102', 'Aceite 5W30 sintético · cuarto', 'aceite-motor', 'MOBIL', 175, 290, 48, 12, 'I1', null, null, null, 'nuevo', null, 'cuarto', array[]::text[]),
    ('AC-2103', 'Aceite 15W40 diésel · galón', 'aceite-motor', 'SHELL', 610, 920, 15, 6, 'I1', null, null, null, 'nuevo', null, 'galon', array[]::text[]),
    ('LF-2201', 'Líquido de frenos DOT 4', 'liquido-frenos', 'BOSCH', 110, 195, 18, 6, 'I2', null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    ('RF-2301', 'Refrigerante verde · galón', 'refrigerante', 'VALVOLINE', 260, 420, 12, 4, 'I2', null, null, null, 'nuevo', null, 'galon', array[]::text[]),
    ('AT-2401', 'Aceite ATF Dexron III · cuarto', 'atf', 'VALVOLINE', 140, 240, 20, 6, 'I2', null, null, null, 'nuevo', null, 'cuarto', array[]::text[]),
    ('SL-2501', 'Silicón gris formador de empaques', 'selladores', null, 95, 170, 14, 4, 'I3', null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    ('LI-2601', 'Limpiador de carburador y cuerpo de aceleración', 'limpiadores', null, 85, 160, 10, 4, 'I3', null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    ('BT-2701', 'Batería 12 V 45 Ah', 'baterias', 'LTH', 1850, 2900, 4, 2, 'J1', null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    -- Mano de obra (sin inventario)
    ('MO-2801', 'Cambio de aceite y filtro (mano de obra)', 'mo-mantenimiento', null, 0, 250, 0, 0, null, null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    ('MO-2802', 'Cambio de pastillas delanteras (mano de obra)', 'mo-frenos', null, 0, 350, 0, 0, null, null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    ('MO-2803', 'Alineación y balanceo', 'mo-alineacion', null, 0, 600, 0, 0, null, null, null, null, 'nuevo', null, 'unidad', array[]::text[]),
    ('MO-2804', 'Escaneo computarizado', 'mo-diagnostico', null, 0, 400, 0, 0, null, null, null, null, 'nuevo', null, 'unidad', array[]::text[]);

  -- Existencia inicial: el kardex la registra como «inicial».
  insert into public.productos (
    id_empresa, codigo, nombre, id_categoria, id_marca_producto, costo, precio,
    existencia, existencia_minima, ubicacion, oem, numero_parte, referencias,
    condicion, origen, unidad, garantia_dias
  )
  select p_empresa, d.codigo, d.nombre, c.id, m.id, d.costo, d.precio,
         d.existencia, d.minima, d.ubicacion, d.oem, d.numero_parte, d.referencias,
         d.condicion, d.origen, d.unidad, case when d.codigo like 'BT-%' then 365 else 30 end
    from pg_temp.demo d
    join public.categorias c on c.slug = d.categoria
    left join public.marcas_productos m on m.nombre = d.marca and m.id_empresa is null
   where not exists (
     select 1 from public.productos p where p.id_empresa = p_empresa and p.codigo = d.codigo
   );
  get diagnostics v_productos = row_count;

  -- Compatibilidades: cada texto de vehículo se resuelve contra el catálogo global.
  -- El trigger de la tabla completa los ancestros desde el nivel más específico.
  with v as (
    select p.id as id_producto, string_to_array(x, '|') as t
      from pg_temp.demo d
      join public.productos p on p.id_empresa = p_empresa and p.codigo = d.codigo
      cross join lateral unnest(d.vehiculos) as x
  ),
  filas as (
    -- Toda la marca
    select v.id_producto, ma.id as id_marca, null::int as id_modelo,
           null::int as id_modelo_anio, null::int as id_especificacion
      from v join public.marcas ma on ma.marca = v.t[2]
     where v.t[1] = 'marca'
    union all
    -- Motor (todas las especificaciones del modelo con ese código de motor)
    select v.id_producto, ma.id, mo.id, a.id, e.id
      from v
      join public.marcas ma on ma.marca = v.t[2]
      join public.modelos mo on mo.id_marca = ma.id and mo.modelo = v.t[3]
      join public.modelos_anios a on a.id_modelo = mo.id
      join public.especificaciones e on e.id_modelo_anio = a.id and e.motor_numero = v.t[4]
     where v.t[1] = 'motor'
    union all
    -- Rango de años (o todos los años si no trae rango)
    select v.id_producto, ma.id, mo.id,
           case when cardinality(v.t) = 4 then a.id end, null::int
      from v
      join public.marcas ma on ma.marca = v.t[1]
      join public.modelos mo on mo.id_marca = ma.id and mo.modelo = v.t[2]
      left join public.modelos_anios a
        on cardinality(v.t) = 4 and a.id_modelo = mo.id
       and a.anio between v.t[3]::int and v.t[4]::int
     where v.t[1] not in ('marca', 'motor')
       and (cardinality(v.t) = 2 or a.id is not null)
  )
  insert into public.productos_compatibilidades
    (id_empresa, id_producto, id_marca, id_modelo, id_modelo_anio, id_especificacion)
  select distinct p_empresa, f.id_producto, f.id_marca, f.id_modelo, f.id_modelo_anio, f.id_especificacion
    from filas f
  on conflict do nothing;
  get diagnostics v_compat = row_count;

  insert into public.clientes (id_empresa, nombre, rtn, telefono)
  select p_empresa, x.nombre, x.rtn, x.telefono
    from (values
      ('Transportes López S. de R.L.', '08019010123456', '2233-4455'),
      ('Juan Pérez', null, '9988-7766'),
      ('Taxi Rápido Capitalino', '08011985001234', '3322-1100')
    ) as x (nombre, rtn, telefono)
   where not exists (
     select 1 from public.clientes c where c.id_empresa = p_empresa and c.nombre = upper(x.nombre)
   )
  on conflict do nothing;
  get diagnostics v_clientes = row_count;

  return jsonb_build_object('productos', v_productos, 'compatibilidades', v_compat, 'clientes', v_clientes);
end;
$$;

revoke all on function public.cargar_datos_demo(uuid) from public, anon;
grant execute on function public.cargar_datos_demo(uuid) to authenticated;

commit;
