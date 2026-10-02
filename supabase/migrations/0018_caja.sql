-- =============================================================================
-- 0018 · Caja: turnos, movimientos, arqueo y cierre
-- -----------------------------------------------------------------------------
-- ESTADO: PENDIENTE
-- Idempotente y atómica. Requiere 0017.
--
-- Qué crea o cambia:
--   · empresas.caja_obligatoria   Si es true, no se factura de contado ni se
--                                 registran abonos sin la caja abierta.
--   · cajas_turnos                Un turno por punto de emisión: apertura con
--                                 fondo, cierre con arqueo (conteo por
--                                 denominación), efectivo esperado, contado y
--                                 diferencia, y el resumen congelado.
--   · cajas_movimientos           Entradas y salidas de efectivo (gastos,
--                                 retiros al banco, cambio).
--   · carritos/documentos.forma_pago, referencia_pago   Cómo se pagó una venta
--                                 de contado. documentos.id_turno, pagos.id_turno.
--   · turno_abierto(), abrir_caja(), movimiento_caja(), resumen_turno(),
--     cerrar_caja().
--   · emitir_documento(), emitir_nota(), registrar_pago()  Quedan en el turno
--                                 abierto del punto de quien emite.
--   · reporte_ventas()            Resta las notas de crédito y suma las de
--                                 débito (ventas, utilidad, series y rankings).
--   · Vistas v_cajas_turnos, v_caja_movimientos.
--
-- Reglas (docs/negocio.md §3.9):
--   · Efectivo esperado = fondo + ventas de contado + abonos + notas de débito
--     (de facturas de contado) − devoluciones (notas de crédito de facturas de
--     contado) + entradas − salidas, todo en efectivo. Las notas usan la forma
--     de pago de su factura.
--   · Las ventas al crédito se informan, pero no son dinero de la caja.
--   · Cierra quien abrió o dueño/admin; una diferencia exige una nota.
-- =============================================================================

begin;

create or replace function pg_temp.restriccion_0018(tabla regclass, nombre text, definicion text)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = tabla and conname = nombre) then
    execute format('alter table %s add constraint %I %s', tabla, nombre, definicion);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Configuración y forma de pago de las ventas de contado
-- -----------------------------------------------------------------------------

alter table public.empresas add column if not exists caja_obligatoria boolean not null default false;
grant update (caja_obligatoria) on public.empresas to authenticated;

alter table public.carritos add column if not exists forma_pago text not null default 'efectivo';
alter table public.carritos add column if not exists referencia_pago text;
select pg_temp.restriccion_0018('public.carritos', 'carritos_forma_pago_check',
  $$check (forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque', 'otro')
           and (referencia_pago is null or char_length(referencia_pago) <= 80))$$);
grant update (forma_pago, referencia_pago) on public.carritos to authenticated;

alter table public.documentos add column if not exists forma_pago text;
alter table public.documentos add column if not exists referencia_pago text;
select pg_temp.restriccion_0018('public.documentos', 'documentos_forma_pago_check',
  $$check (forma_pago is null or forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque', 'otro'))$$);

-- Las facturas de contado anteriores a la caja se toman como efectivo.
update public.documentos set forma_pago = 'efectivo'
 where tipo = 'factura' and condicion = 'contado' and forma_pago is null;

-- -----------------------------------------------------------------------------
-- 2. Turnos y movimientos
-- -----------------------------------------------------------------------------

create table if not exists public.cajas_turnos (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_punto_emision bigint not null references public.puntos_emision (id),
  numero integer not null,
  abierta_por uuid references public.usuarios (id) on delete set null default auth.uid(),
  abierta_en timestamptz not null default now(),
  fondo_inicial numeric(14, 2) not null default 0,
  estado text not null default 'abierta',
  cerrada_por uuid references public.usuarios (id) on delete set null,
  cerrada_en timestamptz,
  efectivo_esperado numeric(14, 2),
  efectivo_contado numeric(14, 2),
  diferencia numeric(14, 2),
  arqueo jsonb,
  resumen jsonb,
  notas text,
  constraint cajas_turnos_numero_key unique (id_empresa, numero)
);

create unique index if not exists cajas_turnos_abierta_key on public.cajas_turnos (id_punto_emision) where estado = 'abierta';
create index if not exists cajas_turnos_empresa_idx on public.cajas_turnos (id_empresa, abierta_en desc);
create index if not exists cajas_turnos_abierta_por_idx on public.cajas_turnos (abierta_por);
create index if not exists cajas_turnos_cerrada_por_idx on public.cajas_turnos (cerrada_por);

select pg_temp.restriccion_0018('public.cajas_turnos', 'cajas_turnos_estado_check',
  $$check (estado in ('abierta', 'cerrada') and fondo_inicial >= 0
           and (efectivo_contado is null or efectivo_contado >= 0)
           and (notas is null or char_length(notas) <= 500))$$);

create table if not exists public.cajas_movimientos (
  id bigint generated by default as identity primary key,
  id_turno uuid not null references public.cajas_turnos (id) on delete cascade,
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  tipo text not null,
  monto numeric(14, 2) not null,
  concepto text not null,
  creado_por uuid references public.usuarios (id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now()
);

create index if not exists cajas_movimientos_turno_idx on public.cajas_movimientos (id_turno);
create index if not exists cajas_movimientos_empresa_idx on public.cajas_movimientos (id_empresa);
create index if not exists cajas_movimientos_creado_por_idx on public.cajas_movimientos (creado_por);

select pg_temp.restriccion_0018('public.cajas_movimientos', 'cajas_movimientos_check',
  $$check (tipo in ('entrada', 'salida') and monto > 0 and btrim(concepto) <> '' and char_length(concepto) <= 160)$$);

alter table public.documentos add column if not exists id_turno uuid references public.cajas_turnos (id);
alter table public.pagos add column if not exists id_turno uuid references public.cajas_turnos (id);
create index if not exists documentos_id_turno_idx on public.documentos (id_turno);
create index if not exists pagos_id_turno_idx on public.pagos (id_turno);

-- -----------------------------------------------------------------------------
-- 3. Funciones de caja
-- -----------------------------------------------------------------------------

-- Turno abierto de un punto. Lo comparte (for share) para que no se cierre a
-- mitad de una venta: el cierre espera y la venta queda dentro del turno.
create or replace function public.turno_abierto(p_punto bigint)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_turno uuid;
begin
  if p_punto is null then
    return null;
  end if;
  select t.id into v_turno from public.cajas_turnos t
   where t.id_punto_emision = p_punto and t.estado = 'abierta'
   for share;
  return v_turno;
end;
$$;

revoke all on function public.turno_abierto(bigint) from public, anon, authenticated;

/*
  Resumen de un turno (vivo mientras está abierto). Por forma de pago:
  ventas de contado, abonos, devoluciones y cargos (notas de facturas de
  contado, con la forma de su factura) y neto. Efectivo esperado = fondo +
  neto en efectivo + entradas − salidas.
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
    select coalesce(f.forma_pago, 'efectivo') as forma,
           coalesce(sum(n.total) filter (where n.tipo = 'nota_credito'), 0) as devoluciones,
           coalesce(sum(n.total) filter (where n.tipo = 'nota_debito'), 0) as cargos,
           count(*) as n
      from public.documentos n
      join t on n.id_turno = t.id
      join public.documentos f on f.id = n.id_factura
     where n.tipo in ('nota_credito', 'nota_debito') and n.estado = 'emitido' and f.condicion = 'contado'
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

create or replace function public.abrir_caja(p_empresa uuid, p_fondo numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_punto public.puntos_emision;
  v_abierto record;
  v_numero integer;
  v_turno uuid;
begin
  if not public.es_miembro(p_empresa) then
    raise exception 'No tenés acceso a esta empresa.';
  end if;
  if p_fondo is null or p_fondo < 0 then
    raise exception 'El fondo inicial no puede ser negativo.';
  end if;
  v_punto := public.punto_emision_actual(p_empresa);
  if v_punto.id is null then
    raise exception 'No hay un punto de emisión activo. Registralo en Ventas › Puntos de emisión.';
  end if;

  select t.numero, u.nombre into v_abierto
    from public.cajas_turnos t left join public.usuarios u on u.id = t.abierta_por
   where t.id_punto_emision = v_punto.id and t.estado = 'abierta';
  if found then
    raise exception '% ya está abierta (turno %, por %).', v_punto.nombre, v_abierto.numero, coalesce(v_abierto.nombre, 'otra persona');
  end if;

  insert into public.correlativos (id_empresa, tipo) values (p_empresa, 'turno')
  on conflict (id_empresa, tipo) do nothing;
  update public.correlativos set siguiente = siguiente + 1
   where id_empresa = p_empresa and tipo = 'turno'
  returning siguiente - 1 into v_numero;

  insert into public.cajas_turnos (id_empresa, id_punto_emision, numero, fondo_inicial)
  values (p_empresa, v_punto.id, v_numero, round(p_fondo, 2))
  returning id into v_turno;
  return v_turno;
end;
$$;

create or replace function public.movimiento_caja(p_turno uuid, p_tipo text, p_monto numeric, p_concepto text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turno public.cajas_turnos;
  v_id bigint;
begin
  select * into v_turno from public.cajas_turnos where id = p_turno for update;
  if not found or not public.es_miembro(v_turno.id_empresa) then
    raise exception 'El turno no existe.';
  end if;
  if v_turno.estado <> 'abierta' then
    raise exception 'La caja ya se cerró.';
  end if;
  if p_tipo not in ('entrada', 'salida') then
    raise exception 'Tipo de movimiento no válido.';
  end if;
  if p_monto is null or round(p_monto, 2) <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;
  if nullif(btrim(p_concepto), '') is null then
    raise exception 'Escribí el concepto.';
  end if;
  insert into public.cajas_movimientos (id_turno, id_empresa, tipo, monto, concepto)
  values (v_turno.id, v_turno.id_empresa, p_tipo, round(p_monto, 2), left(btrim(p_concepto), 160))
  returning id into v_id;
  return v_id;
end;
$$;

/*
  Cierra un turno con el efectivo contado. p_arqueo: { "500": 3, "100": 7, … }
  (cantidad por denominación, solo informativo; manda p_contado). Congela el
  resumen. Cierra quien abrió o dueño/admin. Con diferencia, exige una nota.
*/
create or replace function public.cerrar_caja(p_turno uuid, p_contado numeric, p_arqueo jsonb, p_notas text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_turno public.cajas_turnos;
  v_resumen jsonb;
  v_esperado numeric;
  v_contado numeric := round(coalesce(p_contado, -1), 2);
  v_diferencia numeric;
  v_notas text := nullif(btrim(coalesce(p_notas, '')), '');
begin
  select * into v_turno from public.cajas_turnos where id = p_turno for update;
  if not found or not public.es_miembro(v_turno.id_empresa) then
    raise exception 'El turno no existe.';
  end if;
  if v_turno.estado <> 'abierta' then
    raise exception 'La caja ya se cerró.';
  end if;
  if v_turno.abierta_por is distinct from auth.uid()
     and not public.tiene_rol(v_turno.id_empresa, array['dueno', 'admin']) then
    raise exception 'Solo quien abrió la caja, el dueño o un administrador la pueden cerrar.';
  end if;
  if v_contado < 0 then
    raise exception 'Escribí cuánto efectivo contaste.';
  end if;

  v_resumen := public.resumen_turno(p_turno);
  v_esperado := (v_resumen ->> 'esperado_efectivo')::numeric;
  v_diferencia := v_contado - v_esperado;
  if v_diferencia <> 0 and v_notas is null then
    raise exception 'La caja no cuadra por L %: escribí una nota que lo explique.',
      to_char(abs(v_diferencia), 'FM999,999,990.00');
  end if;

  update public.cajas_turnos
     set estado = 'cerrada', cerrada_por = auth.uid(), cerrada_en = now(),
         efectivo_esperado = v_esperado, efectivo_contado = v_contado, diferencia = v_diferencia,
         arqueo = case when jsonb_typeof(p_arqueo) = 'object' then p_arqueo end,
         resumen = v_resumen, notas = left(v_notas, 500)
   where id = p_turno;

  return v_resumen || jsonb_build_object('contado', v_contado, 'diferencia', v_diferencia);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Emisión y abonos dentro del turno (0017 / 0016 + caja)
-- -----------------------------------------------------------------------------

create or replace function public.emitir_documento(p_carrito uuid, p_tipo text, p_vence date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_carrito public.carritos;
  v_empresa public.empresas;
  v_punto public.puntos_emision;
  v_cai public.cai;
  v_hoy date := (now() at time zone 'America/Tegucigalpa')::date;
  v_correlativo integer;
  v_numero text;
  v_doc uuid;
  v_linea record;
  v_subtotal numeric := 0;
  v_descuento numeric := 0;
  v_exento numeric := 0;
  v_gravado numeric := 0;
  v_exonerado numeric := 0;
  v_isv numeric;
  v_orden integer := 0;
  v_exoneracion jsonb;
  v_cliente public.clientes;
  v_credito boolean;
  v_pendiente numeric;
  v_total numeric;
  v_turno uuid;
begin
  if p_tipo not in ('cotizacion', 'factura') then
    raise exception 'Tipo de documento no válido.';
  end if;

  select * into v_carrito from public.carritos where id = p_carrito for update;
  if not found or not public.es_miembro(v_carrito.id_empresa) then
    raise exception 'El carrito no existe.';
  end if;
  if v_carrito.estado <> 'abierto' then
    raise exception 'Este carrito ya se cerró.';
  end if;
  if not exists (select 1 from public.carritos_lineas where id_carrito = p_carrito) then
    raise exception 'El carrito está vacío.';
  end if;

  select * into v_empresa from public.empresas where id = v_carrito.id_empresa;
  v_punto := public.punto_emision_actual(v_carrito.id_empresa);
  v_turno := public.turno_abierto(v_punto.id);

  if v_carrito.exonerado then
    v_exoneracion := jsonb_strip_nulls(jsonb_build_object(
      'orden_compra', v_carrito.exo_orden_compra, 'constancia', v_carrito.exo_constancia,
      'registro_sag', v_carrito.exo_registro_sag));
  end if;

  if p_tipo = 'factura' then
    if v_empresa.rtn is null or v_empresa.razon_social is null then
      raise exception 'Para facturar, completá la razón social y el RTN del taller (módulo Taller).';
    end if;
    if v_carrito.exonerado then
      if v_carrito.cliente_rtn is null then
        raise exception 'Una factura exonerada lleva el RTN del cliente.';
      end if;
      if v_carrito.exo_orden_compra is null and v_carrito.exo_constancia is null then
        raise exception 'Escribí la orden de compra exenta o la constancia de registro de exonerado.';
      end if;
    end if;
    -- Venta al crédito: cliente registrado con crédito habilitado (0017).
    v_credito := v_carrito.condicion = 'credito';
    if v_credito then
      if v_carrito.id_cliente is null then
        raise exception 'Para vender al crédito elegí un cliente registrado.';
      end if;
      select * into v_cliente from public.clientes
       where id = v_carrito.id_cliente and id_empresa = v_carrito.id_empresa;
      if not found or not v_cliente.credito_habilitado then
        raise exception 'Este cliente no tiene crédito. Habilitalo en Ventas › Clientes.';
      end if;
      if not public.tiene_rol(v_carrito.id_empresa, array['dueno', 'admin'])
         and exists (select 1 from public.v_cuentas_cobrar c
                      where c.id_cliente = v_cliente.id and c.estado = 'vencida') then
        raise exception 'El cliente tiene facturas vencidas: solo el dueño o un administrador pueden darle más crédito.';
      end if;
    end if;
    -- Caja (0018): si la empresa lo exige, una venta de contado necesita la caja abierta.
    if not coalesce(v_credito, false) and v_empresa.caja_obligatoria and v_turno is null then
      raise exception 'Abrí la caja (módulo Caja) antes de facturar de contado.';
    end if;
    v_cai := public.tomar_numero_cai(v_punto, 'factura');
    v_correlativo := v_cai.siguiente;
    v_numero := public.numero_cai(v_cai, v_correlativo);
  else
    insert into public.correlativos (id_empresa, tipo) values (v_carrito.id_empresa, p_tipo)
    on conflict (id_empresa, tipo) do nothing;
    update public.correlativos set siguiente = siguiente + 1
     where id_empresa = v_carrito.id_empresa and tipo = p_tipo
    returning siguiente - 1 into v_correlativo;
    v_numero := 'COT-' || lpad(v_correlativo::text, 6, '0');
  end if;

  insert into public.documentos (
    id_empresa, tipo, numero, correlativo, vence,
    id_cai, cai, cai_rango, cai_fecha_limite, emisor,
    id_punto_emision, establecimiento, punto_emision,
    id_cliente, cliente_nombre, cliente_rtn, cliente_telefono, vehiculo,
    subtotal, descuento, importe_exento, importe_gravado, importe_exonerado, isv, total,
    exoneracion, notas, id_carrito, condicion, dias_credito,
    forma_pago, referencia_pago, id_turno
  ) values (
    v_carrito.id_empresa, p_tipo, v_numero, v_correlativo,
    case when p_tipo = 'cotizacion' then coalesce(p_vence, v_hoy + 15)
         when v_credito then v_hoy + v_cliente.dias_credito end,
    v_cai.id, v_cai.cai,
    case when v_cai.id is not null then
      public.numero_cai(v_cai, v_cai.rango_inicial) || ' al ' || public.numero_cai(v_cai, v_cai.rango_final)
    end,
    v_cai.fecha_limite,
    public.emisor_documento(v_empresa, v_punto),
    v_punto.id, v_punto.establecimiento, v_punto.punto_emision,
    v_carrito.id_cliente,
    coalesce(v_carrito.cliente_nombre, 'CONSUMIDOR FINAL'),
    v_carrito.cliente_rtn, v_carrito.cliente_telefono, v_carrito.vehiculo,
    0, 0, 0, 0, 0, 0, 0,
    v_exoneracion, v_carrito.notas, v_carrito.id,
    case when v_credito then 'credito' else 'contado' end,
    case when v_credito then v_cliente.dias_credito end,
    case when p_tipo = 'factura' and not coalesce(v_credito, false) then v_carrito.forma_pago end,
    case when p_tipo = 'factura' and not coalesce(v_credito, false) then v_carrito.referencia_pago end,
    case when p_tipo = 'factura' then v_turno end
  )
  returning id into v_doc;

  -- Líneas: el descuento general se combina con el de cada línea.
  for v_linea in
    select l.*, p.costo as costo_producto, coalesce(p.controla_inventario, false) as inventariable
      from public.carritos_lineas l
      left join public.productos p on p.id = l.id_producto
     where l.id_carrito = p_carrito
     order by l.orden, l.id
  loop
    declare
      v_bruto numeric := round(v_linea.cantidad * v_linea.precio, 2);
      v_neto numeric := round(v_bruto * (1 - v_linea.descuento_pct / 100) * (1 - v_carrito.descuento_pct / 100), 2);
    begin
      v_orden := v_orden + 1;
      insert into public.documentos_lineas (
        id_documento, id_empresa, id_producto, codigo, descripcion, cantidad, precio,
        descuento_pct, descuento, exento, total, costo, controla_inventario, orden
      ) values (
        v_doc, v_carrito.id_empresa, v_linea.id_producto, v_linea.codigo, v_linea.descripcion,
        v_linea.cantidad, v_linea.precio,
        round((1 - (1 - v_linea.descuento_pct / 100) * (1 - v_carrito.descuento_pct / 100)) * 100, 3),
        v_bruto - v_neto, v_linea.exento, v_neto, v_linea.costo_producto, v_linea.inventariable, v_orden
      );
      v_subtotal := v_subtotal + v_bruto;
      v_descuento := v_descuento + (v_bruto - v_neto);
      if v_linea.exento then
        v_exento := v_exento + v_neto;
      elsif v_carrito.exonerado then
        v_exonerado := v_exonerado + v_neto;
      else
        v_gravado := v_gravado + v_neto;
      end if;
    end;
  end loop;

  v_isv := round(v_gravado * 0.15, 2);
  update public.documentos
     set subtotal = v_subtotal, descuento = v_descuento, importe_exento = v_exento,
         importe_gravado = v_gravado, importe_exonerado = v_exonerado, isv = v_isv,
         total = v_exento + v_exonerado + v_gravado + v_isv
   where id = v_doc;

  -- Límite de crédito: lo pendiente del cliente más esta factura (dueño/admin pueden pasarlo).
  if v_credito and v_cliente.limite_credito is not null
     and not public.tiene_rol(v_carrito.id_empresa, array['dueno', 'admin']) then
    v_total := v_exento + v_exonerado + v_gravado + v_isv;
    select coalesce(sum(c.pendiente), 0) into v_pendiente
      from public.v_cuentas_cobrar c where c.id_cliente = v_cliente.id and c.id <> v_doc;
    if v_pendiente + v_total > v_cliente.limite_credito then
      raise exception 'Supera el límite de crédito del cliente: le quedan L % disponibles.',
        to_char(greatest(v_cliente.limite_credito - v_pendiente, 0), 'FM999,999,990.00');
    end if;
  end if;

  -- Factura: descuenta existencias (queda en el kardex como venta).
  if p_tipo = 'factura' then
    perform set_config('wp.movimiento_tipo', 'venta', true);
    perform set_config('wp.movimiento_ref', v_numero, true);
    update public.productos p
       set existencia = p.existencia - x.cantidad
      from (select id_producto, sum(cantidad) as cantidad
              from public.documentos_lineas
             where id_documento = v_doc and id_producto is not null and controla_inventario
             group by id_producto) x
     where p.id = x.id_producto;
    perform set_config('wp.movimiento_tipo', '', true);
    perform set_config('wp.movimiento_ref', '', true);
  end if;

  update public.carritos set estado = 'cerrado', actualizado_en = now() where id = p_carrito;
  return v_doc;
end;
$$;

create or replace function public.emitir_nota(
  p_factura uuid,
  p_tipo text,
  p_motivo_tipo text,
  p_motivo text,
  p_lineas jsonb,
  p_reintegrar boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_factura public.documentos;
  v_empresa public.empresas;
  v_punto public.puntos_emision;
  v_cai public.cai;
  v_numero text;
  v_doc uuid;
  v_item jsonb;
  v_origen public.documentos_lineas;
  v_devuelto numeric;
  v_acreditado numeric;
  v_cantidad numeric;
  v_monto numeric;
  v_neto numeric;
  v_bruto numeric;
  v_exento_linea boolean;
  v_descripcion text;
  v_subtotal numeric := 0;
  v_descuento numeric := 0;
  v_exento numeric := 0;
  v_gravado numeric := 0;
  v_exonerado numeric := 0;
  v_isv numeric;
  v_total numeric;
  v_saldo numeric;
  v_orden integer := 0;
  v_devolucion boolean := p_motivo_tipo = 'devolucion';
  v_motivo text := nullif(regexp_replace(btrim(coalesce(p_motivo, '')), '\s+', ' ', 'g'), '');
  v_turno uuid;
begin
  if p_tipo not in ('nota_credito', 'nota_debito') then
    raise exception 'Tipo de nota no válido.';
  end if;
  if (p_tipo = 'nota_credito' and p_motivo_tipo not in ('devolucion', 'descuento', 'correccion', 'otro'))
     or (p_tipo = 'nota_debito' and p_motivo_tipo not in ('intereses', 'gastos', 'correccion', 'otro')) then
    raise exception 'Motivo no válido.';
  end if;
  if v_motivo is null then
    raise exception 'Escribí el motivo de la nota.';
  end if;
  if char_length(v_motivo) > 300 then
    raise exception 'El motivo es muy largo (máximo 300 caracteres).';
  end if;
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La nota no tiene líneas.';
  end if;
  if jsonb_array_length(p_lineas) > 100 then
    raise exception 'Máximo 100 líneas por nota.';
  end if;

  select * into v_factura from public.documentos where id = p_factura for update;
  if not found or not public.es_miembro(v_factura.id_empresa) then
    raise exception 'La factura no existe.';
  end if;
  if not public.tiene_rol(v_factura.id_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden emitir notas de crédito o débito.';
  end if;
  if v_factura.tipo <> 'factura' then
    raise exception 'Las notas se emiten sobre una factura.';
  end if;
  if v_factura.estado <> 'emitido' then
    raise exception 'La factura está anulada.';
  end if;

  select * into v_empresa from public.empresas where id = v_factura.id_empresa;
  v_punto := public.punto_emision_actual(v_factura.id_empresa);
  v_turno := public.turno_abierto(v_punto.id);
  v_cai := public.tomar_numero_cai(v_punto, p_tipo);
  v_numero := public.numero_cai(v_cai, v_cai.siguiente);

  insert into public.documentos (
    id_empresa, tipo, numero, correlativo,
    id_cai, cai, cai_rango, cai_fecha_limite, emisor,
    id_punto_emision, establecimiento, punto_emision,
    id_cliente, cliente_nombre, cliente_rtn, cliente_telefono, vehiculo,
    subtotal, descuento, importe_exento, importe_gravado, importe_exonerado, isv, total,
    exoneracion, id_factura, factura_numero, factura_fecha, factura_cai,
    motivo_tipo, motivo, reintegra_inventario, id_turno
  ) values (
    v_factura.id_empresa, p_tipo, v_numero, v_cai.siguiente,
    v_cai.id, v_cai.cai,
    public.numero_cai(v_cai, v_cai.rango_inicial) || ' al ' || public.numero_cai(v_cai, v_cai.rango_final),
    v_cai.fecha_limite,
    public.emisor_documento(v_empresa, v_punto),
    v_punto.id, v_punto.establecimiento, v_punto.punto_emision,
    v_factura.id_cliente, v_factura.cliente_nombre, v_factura.cliente_rtn, v_factura.cliente_telefono,
    v_factura.vehiculo,
    0, 0, 0, 0, 0, 0, 0,
    v_factura.exoneracion, v_factura.id, v_factura.numero, v_factura.fecha, v_factura.cai,
    p_motivo_tipo, v_motivo, v_devolucion and coalesce(p_reintegrar, false), v_turno
  )
  returning id into v_doc;

  for v_item in select * from jsonb_array_elements(p_lineas)
  loop
    v_orden := v_orden + 1;
    if v_devolucion then
      -- Devolución: una línea de la factura y cuántas unidades vuelven.
      if p_tipo <> 'nota_credito' or jsonb_typeof(v_item -> 'id_linea') is distinct from 'number' then
        raise exception 'Línea %: elegí qué producto de la factura se devuelve.', v_orden;
      end if;
      select * into v_origen from public.documentos_lineas
       where id = (v_item ->> 'id_linea')::bigint and id_documento = p_factura;
      if not found then
        raise exception 'Línea %: no es de esta factura.', v_orden;
      end if;
      v_cantidad := round((v_item ->> 'cantidad')::numeric, 2);
      if v_cantidad is null or v_cantidad <= 0 then
        raise exception 'Línea %: la cantidad debe ser mayor que cero.', v_orden;
      end if;
      select coalesce(sum(l.cantidad), 0), coalesce(sum(l.total), 0) into v_devuelto, v_acreditado
        from public.documentos_lineas l
        join public.documentos n on n.id = l.id_documento
       where l.id_linea_origen = v_origen.id and n.tipo = 'nota_credito' and n.estado = 'emitido';
      if v_cantidad > v_origen.cantidad - v_devuelto then
        raise exception '«%»: solo quedan % por devolver.', v_origen.descripcion,
          rtrim(rtrim(to_char(v_origen.cantidad - v_devuelto, 'FM999990.99'), '0'), '.');
      end if;
      -- Lo que queda de la línea si vuelve todo; si no, la parte proporcional.
      v_neto := case when v_cantidad = v_origen.cantidad - v_devuelto then v_origen.total - v_acreditado
                     else round(v_origen.total * v_cantidad / v_origen.cantidad, 2) end;
      v_bruto := round(v_cantidad * v_origen.precio, 2);
      if v_neto > v_bruto then
        v_bruto := v_neto;
      end if;
      v_exento_linea := v_origen.exento;
      insert into public.documentos_lineas (
        id_documento, id_empresa, id_producto, codigo, descripcion, cantidad, precio,
        descuento_pct, descuento, exento, total, costo, controla_inventario, orden, id_linea_origen
      ) values (
        v_doc, v_factura.id_empresa, v_origen.id_producto, v_origen.codigo, v_origen.descripcion,
        v_cantidad, v_origen.precio, v_origen.descuento_pct, v_bruto - v_neto, v_exento_linea, v_neto,
        v_origen.costo, v_origen.controla_inventario, v_orden, v_origen.id
      );
    else
      -- Rebaja, corrección o cargo: un monto sin ISV con su descripción.
      if v_item ? 'id_linea' then
        raise exception 'Línea %: solo una devolución usa productos de la factura.', v_orden;
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
      v_neto := v_monto;
      v_bruto := v_monto;
      insert into public.documentos_lineas (
        id_documento, id_empresa, descripcion, cantidad, precio, descuento_pct, descuento,
        exento, total, controla_inventario, orden
      ) values (
        v_doc, v_factura.id_empresa, v_descripcion, 1, v_monto, 0, 0, v_exento_linea, v_monto, false, v_orden
      );
    end if;

    v_subtotal := v_subtotal + v_bruto;
    v_descuento := v_descuento + (v_bruto - v_neto);
    if v_exento_linea then
      v_exento := v_exento + v_neto;
    elsif v_factura.exoneracion is not null then
      v_exonerado := v_exonerado + v_neto;
    else
      v_gravado := v_gravado + v_neto;
    end if;
  end loop;

  v_isv := round(v_gravado * 0.15, 2);
  v_total := v_exento + v_exonerado + v_gravado + v_isv;

  if p_tipo = 'nota_credito' then
    -- saldo_factura ya no cuenta esta nota (sus totales siguen en cero).
    v_saldo := public.saldo_factura(p_factura);
    -- Diferencias de redondeo del ISV al devolver todo (un par de centavos).
    if v_total > v_saldo and v_total - v_saldo <= 0.02 and v_isv >= v_total - v_saldo then
      v_isv := v_isv - (v_total - v_saldo);
      v_total := v_saldo;
    end if;
    if v_total > v_saldo then
      raise exception 'La nota (L %) supera lo que queda de la factura (L %).',
        to_char(v_total, 'FM999,999,990.00'), to_char(greatest(v_saldo, 0), 'FM999,999,990.00');
    end if;
  end if;

  update public.documentos
     set subtotal = v_subtotal, descuento = v_descuento, importe_exento = v_exento,
         importe_gravado = v_gravado, importe_exonerado = v_exonerado, isv = v_isv, total = v_total
   where id = v_doc;

  -- Devolución con reintegro: las piezas vuelven al inventario.
  if v_devolucion and coalesce(p_reintegrar, false) then
    perform set_config('wp.movimiento_tipo', 'devolucion', true);
    perform set_config('wp.movimiento_ref', v_numero, true);
    update public.productos p
       set existencia = p.existencia + x.cantidad
      from (select id_producto, sum(cantidad) as cantidad
              from public.documentos_lineas
             where id_documento = v_doc and id_producto is not null and controla_inventario
             group by id_producto) x
     where p.id = x.id_producto;
    perform set_config('wp.movimiento_tipo', '', true);
    perform set_config('wp.movimiento_ref', '', true);
  end if;

  return v_doc;
end;
$$;

create or replace function public.registrar_pago(
  p_cliente bigint,
  p_monto numeric,
  p_forma_pago text,
  p_referencia text default null,
  p_notas text default null,
  p_aplicaciones jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente public.clientes;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_resto numeric;
  v_total_pendiente numeric;
  v_pago uuid;
  v_correlativo integer;
  v_factura record;
  v_item jsonb;
  v_aplicar numeric;
  v_suma numeric := 0;
  v_turno uuid;
begin
  select * into v_cliente from public.clientes where id = p_cliente;
  if not found or not public.es_miembro(v_cliente.id_empresa) then
    raise exception 'El cliente no existe.';
  end if;
  if v_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero.';
  end if;
  if p_forma_pago not in ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque', 'otro') then
    raise exception 'Forma de pago no válida.';
  end if;

  -- Caja (0018): el abono entra al turno abierto del punto de quien cobra.
  v_turno := public.turno_abierto((public.punto_emision_actual(v_cliente.id_empresa)).id);
  if v_turno is null and exists (select 1 from public.empresas e where e.id = v_cliente.id_empresa and e.caja_obligatoria) then
    raise exception 'Abrí la caja (módulo Caja) antes de registrar un abono.';
  end if;

  -- Bloquea las facturas del cliente: dos cobros a la vez no pagan lo mismo.
  perform 1 from public.documentos d
   where d.id_cliente = v_cliente.id and d.tipo = 'factura' and d.condicion = 'credito' and d.estado = 'emitido'
   for update;

  select coalesce(sum(c.pendiente), 0) into v_total_pendiente
    from public.v_cuentas_cobrar c where c.id_cliente = v_cliente.id and c.pendiente > 0;
  if v_monto > v_total_pendiente then
    raise exception 'El abono supera lo pendiente del cliente (L %).', to_char(v_total_pendiente, 'FM999,999,990.00');
  end if;

  insert into public.correlativos (id_empresa, tipo) values (v_cliente.id_empresa, 'recibo')
  on conflict (id_empresa, tipo) do nothing;
  update public.correlativos set siguiente = siguiente + 1
   where id_empresa = v_cliente.id_empresa and tipo = 'recibo'
  returning siguiente - 1 into v_correlativo;

  insert into public.pagos (id_empresa, numero, correlativo, id_cliente, cliente_nombre, cliente_rtn,
                            monto, forma_pago, referencia, notas, id_turno)
  values (v_cliente.id_empresa, 'REC-' || lpad(v_correlativo::text, 6, '0'), v_correlativo,
          v_cliente.id, v_cliente.nombre, v_cliente.rtn, v_monto, p_forma_pago,
          nullif(btrim(p_referencia), ''), nullif(btrim(p_notas), ''), v_turno)
  returning id into v_pago;

  if p_aplicaciones is not null and jsonb_typeof(p_aplicaciones) = 'array' and jsonb_array_length(p_aplicaciones) > 0 then
    for v_item in select * from jsonb_array_elements(p_aplicaciones)
    loop
      v_aplicar := round((v_item ->> 'monto')::numeric, 2);
      select c.* into v_factura from public.v_cuentas_cobrar c
       where c.id = (v_item ->> 'id_documento')::uuid and c.id_cliente = v_cliente.id;
      if not found then
        raise exception 'Una de las facturas no es de este cliente o no es al crédito.';
      end if;
      if v_aplicar is null or v_aplicar <= 0 then
        continue;
      end if;
      if v_aplicar > v_factura.pendiente then
        raise exception 'A la factura % le quedan L % por cobrar.', v_factura.numero,
          to_char(greatest(v_factura.pendiente, 0), 'FM999,999,990.00');
      end if;
      insert into public.pagos_aplicaciones (id_pago, id_empresa, id_documento, monto)
      values (v_pago, v_cliente.id_empresa, v_factura.id, v_aplicar);
      v_suma := v_suma + v_aplicar;
    end loop;
    if v_suma <> v_monto then
      raise exception 'El reparto (L %) no suma el monto del abono (L %).',
        to_char(v_suma, 'FM999,999,990.00'), to_char(v_monto, 'FM999,999,990.00');
    end if;
  else
    v_resto := v_monto;
    for v_factura in
      select c.* from public.v_cuentas_cobrar c
       where c.id_cliente = v_cliente.id and c.pendiente > 0
       order by c.vence nulls last, c.fecha, c.numero
    loop
      exit when v_resto <= 0;
      v_aplicar := least(v_resto, v_factura.pendiente);
      insert into public.pagos_aplicaciones (id_pago, id_empresa, id_documento, monto)
      values (v_pago, v_cliente.id_empresa, v_factura.id, v_aplicar);
      v_resto := v_resto - v_aplicar;
    end loop;
  end if;

  return v_pago;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Reporte de ventas con notas (0009 + notas de crédito y débito)
-- -----------------------------------------------------------------------------

-- Las facturas suman; las notas de crédito restan y las de débito suman
-- (ventas, ISV, utilidad, serie y rankings). «facturas» sigue contando facturas.
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

  with base as (
    select d.*, (d.fecha at time zone 'America/Tegucigalpa')::date as dia,
           case when d.tipo = 'nota_credito' then -1 else 1 end as signo
      from public.documentos d
     where d.id_empresa = p_empresa
       and (d.fecha at time zone 'America/Tegucigalpa')::date between v_prev_desde and p_hasta
  ),
  vendido as (
    select * from base b where b.tipo in ('factura', 'nota_credito', 'nota_debito') and b.estado = 'emitido'
  ),
  lineas as (
    select v.dia, v.signo * l.total as total, v.signo * coalesce(l.costo, 0) * l.cantidad as costo
      from vendido v
      join public.documentos_lineas l on l.id_documento = v.id
  ),
  periodos as (
    select 'actual' as periodo, p_desde as desde, p_hasta as hasta
    union all
    select 'previo', v_prev_desde, v_prev_hasta
  )
  select
    jsonb_object_agg(p.periodo, jsonb_build_object(
      'ventas', coalesce((select sum(v.signo * v.total) from vendido v where v.dia between p.desde and p.hasta), 0),
      'neto', coalesce((select sum(v.signo * (v.importe_gravado + v.importe_exento + v.importe_exonerado)) from vendido v
                         where v.dia between p.desde and p.hasta), 0),
      'isv', coalesce((select sum(v.signo * v.isv) from vendido v where v.dia between p.desde and p.hasta), 0),
      'descuentos', coalesce((select sum(v.descuento) from vendido v
                               where v.tipo = 'factura' and v.dia between p.desde and p.hasta), 0),
      'devoluciones', coalesce((select sum(v.total) from vendido v
                                 where v.tipo = 'nota_credito' and v.dia between p.desde and p.hasta), 0),
      'facturas', (select count(*) from vendido v where v.tipo = 'factura' and v.dia between p.desde and p.hasta),
      'cotizaciones', (select count(*) from base b where b.tipo = 'cotizacion' and b.dia between p.desde and p.hasta),
      'cotizado', coalesce((select sum(b.total) from base b where b.tipo = 'cotizacion' and b.dia between p.desde and p.hasta), 0),
      'anuladas', (select count(*) from base b where b.tipo = 'factura' and b.estado = 'anulado' and b.dia between p.desde and p.hasta),
      'utilidad', case when v_ve_costo then
        coalesce((select sum(l.total - l.costo) from lineas l where l.dia between p.desde and p.hasta), 0) end
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
      'devoluciones', jsonb_build_object('valor', v_actual -> 'devoluciones', 'anterior', v_previo -> 'devoluciones'),
      'cotizaciones', jsonb_build_object('valor', v_actual -> 'cotizaciones', 'anterior', v_previo -> 'cotizaciones'),
      'cotizado', jsonb_build_object('valor', v_actual -> 'cotizado', 'anterior', v_previo -> 'cotizado'),
      'anuladas', jsonb_build_object('valor', v_actual -> 'anuladas', 'anterior', v_previo -> 'anuladas')
    ),
    'serie', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'fecha', g.dia::date,
               'ventas', coalesce(v.ventas, 0),
               'facturas', coalesce(v.facturas, 0)) order by g.dia), '[]'::jsonb)
        from generate_series(p_desde, p_hasta, interval '1 day') as g (dia)
        left join (
          select (d.fecha at time zone 'America/Tegucigalpa')::date as dia,
                 sum(case when d.tipo = 'nota_credito' then -d.total else d.total end) as ventas,
                 count(*) filter (where d.tipo = 'factura') as facturas
            from public.documentos d
           where d.id_empresa = p_empresa and d.tipo in ('factura', 'nota_credito', 'nota_debito') and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
        ) v on v.dia = g.dia::date
    ),
    'rankings', jsonb_build_object(
      'productos', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select coalesce(max(l.codigo), '—') as codigo,
                 max(l.descripcion) as descripcion,
                 sum(case when d.tipo = 'nota_credito' then -l.cantidad else l.cantidad end) as cantidad,
                 sum(case when d.tipo = 'nota_credito' then -l.total else l.total end) as total,
                 case when v_ve_costo then
                   sum(case when d.tipo = 'nota_credito' then -1 else 1 end * (l.total - coalesce(l.costo, 0) * l.cantidad)) end as utilidad
            from public.documentos d
            join public.documentos_lineas l on l.id_documento = d.id
           where d.id_empresa = p_empresa and d.tipo in ('factura', 'nota_credito') and d.estado = 'emitido'
             and (d.tipo = 'factura' or l.id_producto is not null)
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by coalesce(l.id_producto::text, l.descripcion)
          having sum(case when d.tipo = 'nota_credito' then -l.total else l.total end) > 0
           order by 4 desc
           limit 10
        ) x
      ),
      'categorias', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select coalesce(c.nombre, 'Sin registrar') as nombre,
                 sum(case when d.tipo = 'nota_credito' then -l.total else l.total end) as total,
                 sum(case when d.tipo = 'nota_credito' then -l.cantidad else l.cantidad end) as cantidad
            from public.documentos d
            join public.documentos_lineas l on l.id_documento = d.id
            left join public.productos p on p.id = l.id_producto
            left join public.categorias c on c.id = p.id_categoria
           where d.id_empresa = p_empresa and d.tipo in ('factura', 'nota_credito') and d.estado = 'emitido'
             and (d.tipo = 'factura' or l.id_producto is not null)
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
          having sum(case when d.tipo = 'nota_credito' then -l.total else l.total end) > 0
           order by 2 desc
           limit 8
        ) x
      ),
      'vendedores', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select coalesce(u.nombre, 'Sin usuario') as nombre,
                 count(*) filter (where d.tipo = 'factura') as facturas,
                 sum(case when d.tipo = 'nota_credito' then -d.total else d.total end) as total
            from public.documentos d
            left join public.usuarios u on u.id = d.creado_por
           where d.id_empresa = p_empresa and d.tipo in ('factura', 'nota_credito', 'nota_debito') and d.estado = 'emitido'
             and (d.fecha at time zone 'America/Tegucigalpa')::date between p_desde and p_hasta
           group by 1
           order by 3 desc
           limit 10
        ) x
      ),
      'clientes', (
        select coalesce(jsonb_agg(x order by x.total desc), '[]'::jsonb) from (
          select d.cliente_nombre as nombre,
                 count(*) filter (where d.tipo = 'factura') as facturas,
                 sum(case when d.tipo = 'nota_credito' then -d.total else d.total end) as total
            from public.documentos d
           where d.id_empresa = p_empresa and d.tipo in ('factura', 'nota_credito', 'nota_debito') and d.estado = 'emitido'
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

-- -----------------------------------------------------------------------------
-- 6. Permisos y RLS
-- -----------------------------------------------------------------------------

revoke all on public.cajas_turnos, public.cajas_movimientos from anon, authenticated;
grant select on public.cajas_turnos, public.cajas_movimientos to authenticated;

alter table public.cajas_turnos enable row level security;
alter table public.cajas_movimientos enable row level security;

-- Solo lectura: se escriben con abrir_caja(), movimiento_caja() y cerrar_caja().
drop policy if exists empresa_lectura on public.cajas_turnos;
create policy empresa_lectura on public.cajas_turnos
  for select to authenticated using (public.es_miembro(id_empresa));
drop policy if exists empresa_lectura on public.cajas_movimientos;
create policy empresa_lectura on public.cajas_movimientos
  for select to authenticated using (public.es_miembro(id_empresa));

revoke all on function public.abrir_caja(uuid, numeric) from public, anon;
revoke all on function public.movimiento_caja(uuid, text, numeric, text) from public, anon;
revoke all on function public.cerrar_caja(uuid, numeric, jsonb, text) from public, anon;
revoke all on function public.resumen_turno(uuid) from public, anon;
grant execute on function public.abrir_caja(uuid, numeric) to authenticated;
grant execute on function public.movimiento_caja(uuid, text, numeric, text) to authenticated;
grant execute on function public.cerrar_caja(uuid, numeric, jsonb, text) to authenticated;
grant execute on function public.resumen_turno(uuid) to authenticated;

-- Auditoría (0011).
do $$
begin
  if to_regprocedure('public.registrar_cambio()') is not null then
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.cajas_turnos '
            'for each row execute function public.registrar_cambio()';
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.cajas_movimientos '
            'for each row execute function public.registrar_cambio()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Vistas
-- -----------------------------------------------------------------------------

create or replace view public.v_cajas_turnos with (security_invoker = true) as
select t.id,
       t.id_empresa,
       t.numero,
       t.id_punto_emision,
       p.establecimiento || '-' || p.punto_emision || ' · ' || p.nombre as punto,
       t.estado,
       t.abierta_en,
       ua.nombre as abierta_por,
       t.cerrada_en,
       uc.nombre as cerrada_por,
       t.fondo_inicial,
       coalesce(t.efectivo_esperado, (r.resumen ->> 'esperado_efectivo')::numeric) as efectivo_esperado,
       t.efectivo_contado,
       t.diferencia,
       (r.resumen ->> 'total_cobrado')::numeric as total_cobrado,
       (r.resumen ->> 'facturas')::integer as facturas,
       t.notas,
       t.abierta_por = auth.uid() as propio,
       coalesce(t.diferencia, 0) <> 0 as descuadre
  from public.cajas_turnos t
  join public.puntos_emision p on p.id = t.id_punto_emision
  left join public.usuarios ua on ua.id = t.abierta_por
  left join public.usuarios uc on uc.id = t.cerrada_por
  cross join lateral (select coalesce(t.resumen, public.resumen_turno(t.id)) as resumen) r;

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
         or (d.tipo in ('nota_credito', 'nota_debito') and f.condicion = 'contado') as en_caja,
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

create or replace view public.v_carritos with (security_invoker = true) as
select c.id,
       c.id_empresa,
       c.nombre,
       c.id_cliente,
       c.cliente_nombre,
       c.cliente_rtn,
       c.cliente_telefono,
       c.id_marca,
       c.id_modelo,
       c.id_modelo_anio,
       c.id_especificacion,
       c.vehiculo,
       c.descuento_pct,
       c.notas,
       c.estado,
       coalesce(t.lineas, 0)::integer as lineas,
       coalesce(t.unidades, 0) as unidades,
       u.nombre as creado_por_nombre,
       c.creado_en,
       c.actualizado_en,
       c.exonerado,
       c.exo_orden_compra,
       c.exo_constancia,
       c.exo_registro_sag,
       c.condicion,
       c.forma_pago,
       c.referencia_pago
  from public.carritos c
  left join public.usuarios u on u.id = c.creado_por
  left join (
    select id_carrito, count(*) as lineas, sum(cantidad) as unidades
      from public.carritos_lineas group by id_carrito
  ) t on t.id_carrito = c.id;

revoke all on public.v_cajas_turnos, public.v_caja_movimientos from anon;
grant select on public.v_cajas_turnos, public.v_caja_movimientos to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Documentación en la base
-- -----------------------------------------------------------------------------

comment on table public.cajas_turnos is
  'Turnos de caja por punto de emisión: apertura con fondo, cierre con arqueo. Uno abierto por punto.';
comment on table public.cajas_movimientos is 'Entradas y salidas de efectivo de un turno (gastos, retiros, cambio).';
comment on column public.empresas.caja_obligatoria is 'Si es true, no se factura de contado ni se registran abonos sin la caja abierta.';
comment on column public.documentos.forma_pago is 'Factura de contado: cómo se pagó. Las notas usan la de su factura.';
comment on function public.resumen_turno(uuid) is 'Resumen de un turno por forma de pago y efectivo esperado.';
comment on function public.cerrar_caja(uuid, numeric, jsonb, text) is
  'Cierra un turno con el efectivo contado; congela el resumen. Diferencia exige nota.';

commit;
