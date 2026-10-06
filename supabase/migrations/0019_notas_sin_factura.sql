-- =============================================================================
-- 0019 · Notas de crédito y débito sin factura relacionada (módulo Notas)
-- -----------------------------------------------------------------------------
-- ESTADO: PENDIENTE
-- Idempotente y atómica. Requiere 0018.
--
-- Qué crea o cambia:
--   · documentos_nota_check      Una nota ya no exige factura: exige motivo; sin
--                                factura no puede ser devolución ni reintegrar.
--   · emitir_nota_libre()        Nota de crédito o débito a nombre de un cliente
--                                (o consumidor final) sin factura: montos sin ISV
--                                y cómo se liquida (forma de pago o «sin dinero»).
--   · resumen_turno(), v_caja_movimientos   Una nota sin factura cae en la caja
--                                con su propia forma de pago (si tiene).
--   · v_notas                    Listado del módulo Notas.
--
-- Reglas (docs/negocio.md §3.7):
--   · Solo dueño/admin. Motivos: crédito = rebaja, corrección u otro; débito =
--     gastos/flete, intereses, corrección u otro. Sin devolución (no hay líneas
--     de factura que devolver).
--   · El ISV sigue la regla general: 15 % sobre lo gravado; cada monto puede ir
--     exento. Sin exoneración.
--   · No toca cuentas por cobrar (no hay factura cuyo saldo cambiar).
--   · A VERIFICAR con el contador: que el Régimen de Facturación admita notas
--     sin documento de origen para cada caso de uso.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Restricción: la factura pasa a ser opcional
-- -----------------------------------------------------------------------------

alter table public.documentos drop constraint if exists documentos_nota_check;
alter table public.documentos add constraint documentos_nota_check
  check (tipo not in ('nota_credito', 'nota_debito')
         or (motivo_tipo is not null and motivo is not null
             and (id_factura is not null or (motivo_tipo <> 'devolucion' and not reintegra_inventario))));

comment on column public.documentos.id_factura is
  'Notas de crédito/débito: factura que modifican (null = nota sin factura relacionada, 0019).';
comment on column public.documentos.forma_pago is
  'Factura de contado: cómo se pagó. Las notas usan la de su factura; una nota sin factura, la suya (null = no mueve dinero).';

-- -----------------------------------------------------------------------------
-- 2. emitir_nota_libre()
-- -----------------------------------------------------------------------------

/*
  Nota sin factura. p_lineas: [{ descripcion, monto, exento }] (montos sin ISV).
  p_cliente: un cliente registrado; si es null se usan p_cliente_nombre y
  p_cliente_rtn (vacío = consumidor final). p_forma_pago null = la nota no mueve
  dinero (ajuste documental); con forma de pago cae en la caja abierta.
*/
create or replace function public.emitir_nota_libre(
  p_empresa uuid,
  p_tipo text,
  p_cliente bigint,
  p_cliente_nombre text,
  p_cliente_rtn text,
  p_motivo_tipo text,
  p_motivo text,
  p_lineas jsonb,
  p_forma_pago text default null,
  p_referencia text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa public.empresas;
  v_cliente public.clientes;
  v_punto public.puntos_emision;
  v_cai public.cai;
  v_numero text;
  v_doc uuid;
  v_item jsonb;
  v_monto numeric;
  v_exento_linea boolean;
  v_descripcion text;
  v_subtotal numeric := 0;
  v_exento numeric := 0;
  v_gravado numeric := 0;
  v_isv numeric;
  v_orden integer := 0;
  v_motivo text := nullif(regexp_replace(btrim(coalesce(p_motivo, '')), '\s+', ' ', 'g'), '');
  v_nombre text := nullif(regexp_replace(btrim(coalesce(p_cliente_nombre, '')), '\s+', ' ', 'g'), '');
  v_rtn text := nullif(regexp_replace(coalesce(p_cliente_rtn, ''), '\D', '', 'g'), '');
  v_telefono text;
  v_referencia text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_turno uuid;
begin
  if p_tipo not in ('nota_credito', 'nota_debito') then
    raise exception 'Tipo de nota no válido.';
  end if;
  if (p_tipo = 'nota_credito' and p_motivo_tipo not in ('descuento', 'correccion', 'otro'))
     or (p_tipo = 'nota_debito' and p_motivo_tipo not in ('intereses', 'gastos', 'correccion', 'otro')) then
    raise exception 'Motivo no válido para una nota sin factura.';
  end if;
  if v_motivo is null then
    raise exception 'Escribí el motivo de la nota.';
  end if;
  if char_length(v_motivo) > 300 then
    raise exception 'El motivo es muy largo (máximo 300 caracteres).';
  end if;
  if p_forma_pago is not null
     and p_forma_pago not in ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque', 'otro') then
    raise exception 'Forma de pago no válida.';
  end if;
  if char_length(coalesce(v_referencia, '')) > 80 then
    raise exception 'La referencia es muy larga (máximo 80 caracteres).';
  end if;
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La nota no tiene líneas.';
  end if;
  if jsonb_array_length(p_lineas) > 100 then
    raise exception 'Máximo 100 líneas por nota.';
  end if;

  select * into v_empresa from public.empresas where id = p_empresa;
  if not found or not public.es_miembro(p_empresa) then
    raise exception 'La empresa no existe.';
  end if;
  if not public.tiene_rol(p_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden emitir notas de crédito o débito.';
  end if;

  if p_cliente is not null then
    select * into v_cliente from public.clientes where id = p_cliente and id_empresa = p_empresa;
    if not found then
      raise exception 'El cliente no existe.';
    end if;
    v_nombre := v_cliente.nombre;
    v_rtn := v_cliente.rtn;
    v_telefono := v_cliente.telefono;
  end if;
  if v_rtn is not null and char_length(v_rtn) <> 14 then
    raise exception 'El RTN son 14 dígitos.';
  end if;
  if char_length(coalesce(v_nombre, '')) > 160 then
    raise exception 'El nombre del cliente es muy largo.';
  end if;

  v_punto := public.punto_emision_actual(p_empresa);
  v_turno := public.turno_abierto(v_punto.id);
  -- Caja (0018): si la nota mueve dinero y la empresa lo exige, necesita la caja abierta.
  if p_forma_pago is not null and v_empresa.caja_obligatoria and v_turno is null then
    raise exception 'Abrí la caja (módulo Caja) antes de emitir una nota que mueve dinero.';
  end if;
  v_cai := public.tomar_numero_cai(v_punto, p_tipo);
  v_numero := public.numero_cai(v_cai, v_cai.siguiente);

  insert into public.documentos (
    id_empresa, tipo, numero, correlativo,
    id_cai, cai, cai_rango, cai_fecha_limite, emisor,
    id_punto_emision, establecimiento, punto_emision,
    id_cliente, cliente_nombre, cliente_rtn, cliente_telefono,
    subtotal, descuento, importe_exento, importe_gravado, importe_exonerado, isv, total,
    motivo_tipo, motivo, reintegra_inventario, condicion, forma_pago, referencia_pago, id_turno
  ) values (
    p_empresa, p_tipo, v_numero, v_cai.siguiente,
    v_cai.id, v_cai.cai,
    public.numero_cai(v_cai, v_cai.rango_inicial) || ' al ' || public.numero_cai(v_cai, v_cai.rango_final),
    v_cai.fecha_limite,
    public.emisor_documento(v_empresa, v_punto),
    v_punto.id, v_punto.establecimiento, v_punto.punto_emision,
    v_cliente.id, coalesce(v_nombre, 'CONSUMIDOR FINAL'), v_rtn, v_telefono,
    0, 0, 0, 0, 0, 0, 0,
    p_motivo_tipo, v_motivo, false, 'contado', p_forma_pago,
    case when p_forma_pago is not null then v_referencia end, v_turno
  )
  returning id into v_doc;

  for v_item in select * from jsonb_array_elements(p_lineas)
  loop
    v_orden := v_orden + 1;
    if v_item ? 'id_linea' then
      raise exception 'Línea %: una nota sin factura no devuelve productos.', v_orden;
    end if;
    v_descripcion := nullif(regexp_replace(btrim(coalesce(v_item ->> 'descripcion', '')), '\s+', ' ', 'g'), '');
    v_monto := round((v_item ->> 'monto')::numeric, 2);
    if v_descripcion is null or char_length(v_descripcion) > 240 then
      raise exception 'Línea %: escribí una descripción (máximo 240 caracteres).', v_orden;
    end if;
    if v_monto is null or v_monto <= 0 or v_monto > 99999999 then
      raise exception 'Línea %: el monto debe ser mayor que cero.', v_orden;
    end if;
    v_exento_linea := coalesce((v_item ->> 'exento')::boolean, false);
    insert into public.documentos_lineas (
      id_documento, id_empresa, descripcion, cantidad, precio, descuento_pct, descuento,
      exento, total, controla_inventario, orden
    ) values (
      v_doc, p_empresa, v_descripcion, 1, v_monto, 0, 0, v_exento_linea, v_monto, false, v_orden
    );
    v_subtotal := v_subtotal + v_monto;
    if v_exento_linea then
      v_exento := v_exento + v_monto;
    else
      v_gravado := v_gravado + v_monto;
    end if;
  end loop;

  v_isv := round(v_gravado * 0.15, 2);

  update public.documentos
     set subtotal = v_subtotal, importe_exento = v_exento, importe_gravado = v_gravado,
         isv = v_isv, total = v_exento + v_gravado + v_isv
   where id = v_doc;

  return v_doc;
end;
$$;

revoke all on function public.emitir_nota_libre(uuid, text, bigint, text, text, text, text, jsonb, text, text)
  from public, anon;
grant execute on function public.emitir_nota_libre(uuid, text, bigint, text, text, text, text, jsonb, text, text)
  to authenticated;

comment on function public.emitir_nota_libre(uuid, text, bigint, text, text, text, text, jsonb, text, text) is
  'Nota de crédito o débito sin factura relacionada: montos sin ISV, cliente o consumidor final, forma de pago opcional.';

-- -----------------------------------------------------------------------------
-- 3. Caja: las notas sin factura usan su propia forma de pago
-- -----------------------------------------------------------------------------

/*
  Resumen de un turno (vivo mientras está abierto). Por forma de pago:
  ventas de contado, abonos, devoluciones y cargos (notas de facturas de
  contado, con la forma de su factura; notas sin factura, con la suya) y neto.
  Efectivo esperado = fondo + neto en efectivo + entradas − salidas.
*/
create or replace function public.resumen_turno(p_turno uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with t as (
    select * from public.cajas_turnos where id = p_turno
  ),
  formas as (
    select f.forma, f.orden
      from unnest(array['efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque', 'otro']) with ordinality as f (forma, orden)
  ),
  ventas as (
    select coalesce(d.forma_pago, 'efectivo') as forma, sum(d.total) as monto, count(*) as n
      from public.documentos d join t on d.id_turno = t.id
     where d.tipo = 'factura' and d.condicion = 'contado' and d.estado = 'emitido'
     group by 1
  ),
  notas as (
    select case when f.id is null then n.forma_pago else coalesce(f.forma_pago, 'efectivo') end as forma,
           coalesce(sum(n.total) filter (where n.tipo = 'nota_credito'), 0) as devoluciones,
           coalesce(sum(n.total) filter (where n.tipo = 'nota_debito'), 0) as cargos,
           count(*) as n
      from public.documentos n
      join t on n.id_turno = t.id
      left join public.documentos f on f.id = n.id_factura
     where n.tipo in ('nota_credito', 'nota_debito') and n.estado = 'emitido'
       and ((f.id is not null and f.condicion = 'contado') or (n.id_factura is null and n.forma_pago is not null))
     group by 1
  ),
  abonos as (
    select p.forma_pago as forma, sum(p.monto) as monto, count(*) as n
      from public.pagos p join t on p.id_turno = t.id
     where p.estado = 'emitido'
     group by 1
  ),
  por_forma as (
    select fo.forma, fo.orden,
           coalesce(v.monto, 0) as ventas,
           coalesce(a.monto, 0) as abonos,
           coalesce(nn.devoluciones, 0) as devoluciones,
           coalesce(nn.cargos, 0) as cargos,
           coalesce(v.monto, 0) + coalesce(a.monto, 0) + coalesce(nn.cargos, 0) - coalesce(nn.devoluciones, 0) as neto
      from formas fo
      left join ventas v on v.forma = fo.forma
      left join abonos a on a.forma = fo.forma
      left join notas nn on nn.forma = fo.forma
  ),
  mov as (
    select coalesce(sum(m.monto) filter (where m.tipo = 'entrada'), 0) as entradas,
           coalesce(sum(m.monto) filter (where m.tipo = 'salida'), 0) as salidas,
           count(m.id) as n
      from t left join public.cajas_movimientos m on m.id_turno = t.id
  )
  select jsonb_build_object(
    'fondo', t.fondo_inicial,
    'formas', (select jsonb_agg(jsonb_build_object(
                 'forma', pf.forma, 'ventas', pf.ventas, 'abonos', pf.abonos,
                 'devoluciones', pf.devoluciones, 'cargos', pf.cargos, 'neto', pf.neto) order by pf.orden)
                 from por_forma pf),
    'entradas', mov.entradas,
    'salidas', mov.salidas,
    'esperado_efectivo', t.fondo_inicial + (select pf.neto from por_forma pf where pf.forma = 'efectivo')
                         + mov.entradas - mov.salidas,
    'total_cobrado', (select sum(pf.neto) from por_forma pf),
    'facturas', (select coalesce(sum(v.n), 0) from ventas v),
    'abonos', (select coalesce(sum(a.n), 0) from abonos a),
    'notas', (select coalesce(sum(nn.n), 0) from notas nn),
    'movimientos', mov.n,
    'credito', (select coalesce(sum(d.total), 0) from public.documentos d
                 where d.id_turno = t.id and d.tipo = 'factura' and d.condicion = 'credito' and d.estado = 'emitido'),
    'anuladas', (select count(*) from public.documentos d where d.id_turno = t.id and d.estado = 'anulado')
  )
  from t, mov;
$$;

-- Todo lo que pasó en un turno, en orden: ventas, notas, abonos y movimientos.
-- `monto` con signo para la caja; `en_caja` = mueve dinero (las ventas al crédito no).
create or replace view public.v_caja_movimientos with (security_invoker = true) as
select d.id::text as id,
       d.id_turno,
       d.id_empresa,
       d.fecha,
       case d.tipo when 'factura' then case when d.condicion = 'credito' then 'venta_credito' else 'venta' end
                   when 'nota_credito' then 'devolucion' else 'cargo' end as tipo,
       d.numero as referencia,
       d.cliente_nombre as detalle,
       coalesce(d.forma_pago, f.forma_pago) as forma_pago,
       case when d.tipo = 'nota_credito' then -d.total else d.total end as monto,
       (d.tipo = 'factura' and d.condicion = 'contado')
         or (d.tipo in ('nota_credito', 'nota_debito')
             and (coalesce(f.condicion = 'contado', false) or (d.id_factura is null and d.forma_pago is not null))) as en_caja,
       d.estado,
       u.nombre as usuario
  from public.documentos d
  left join public.documentos f on f.id = d.id_factura
  left join public.usuarios u on u.id = d.creado_por
 where d.id_turno is not null and d.tipo <> 'cotizacion'
union all
select p.id::text, p.id_turno, p.id_empresa, p.fecha, 'abono', p.numero, p.cliente_nombre, p.forma_pago,
       p.monto, true, p.estado, u.nombre
  from public.pagos p
  left join public.usuarios u on u.id = p.creado_por
 where p.id_turno is not null
union all
select m.id::text, m.id_turno, m.id_empresa, m.creado_en, m.tipo, null, m.concepto, 'efectivo',
       case when m.tipo = 'salida' then -m.monto else m.monto end, true, 'emitido', u.nombre
  from public.cajas_movimientos m
  left join public.usuarios u on u.id = m.creado_por;

-- -----------------------------------------------------------------------------
-- 4. Vista del módulo Notas
-- -----------------------------------------------------------------------------

create or replace view public.v_notas with (security_invoker = true) as
select d.id,
       d.id_empresa,
       d.tipo,
       d.numero,
       d.fecha,
       d.cliente_nombre,
       d.cliente_rtn,
       d.id_factura,
       d.factura_numero,
       d.id_factura is not null as con_factura,
       d.motivo_tipo,
       d.motivo,
       d.isv,
       d.total,
       case when d.id_factura is not null then f.forma_pago else d.forma_pago end as forma_pago,
       d.estado,
       d.establecimiento || '-' || d.punto_emision as punto,
       u.nombre as emitio
  from public.documentos d
  left join public.documentos f on f.id = d.id_factura
  left join public.usuarios u on u.id = d.creado_por
 where d.tipo in ('nota_credito', 'nota_debito');

revoke all on public.v_notas, public.v_caja_movimientos from anon;
grant select on public.v_notas, public.v_caja_movimientos to authenticated;

comment on view public.v_notas is 'Notas de crédito y débito, con o sin factura relacionada (módulo Notas).';

commit;
