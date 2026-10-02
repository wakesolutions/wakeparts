-- =============================================================================
-- 0017 · Ventas al crédito y cuentas por cobrar
-- -----------------------------------------------------------------------------
-- ESTADO: YA APLICADA (el usuario corre cada migración al recibirla)
-- Idempotente y atómica. Requiere 0016.
--
-- Qué crea o cambia:
--   · clientes.credito_habilitado, limite_credito (null = sin límite), dias_credito
--   · carritos.condicion          contado | credito
--   · documentos.condicion, dias_credito   La factura al crédito vence en
--                                 documentos.vence (hoy + días del cliente).
--   · pagos, pagos_aplicaciones   Recibos de abono (REC-000001) repartidos entre
--                                 las facturas al crédito del cliente.
--   · registrar_pago()            Abono a un cliente: a las facturas elegidas o
--                                 a las más antiguas primero.
--   · anular_pago()               Dueño/admin; la deuda vuelve.
--   · emitir_documento()          Factura al crédito: cliente con crédito, sin
--                                 vencidas y dentro del límite (dueño/admin pueden
--                                 pasarse).
--   · anular_documento()          No anula una factura con abonos vigentes.
--   · Vistas v_cuentas_cobrar (por factura), v_cuentas_clientes (por cliente),
--     v_pagos, v_pagos_aplicaciones; columnas nuevas al final de v_clientes,
--     v_carritos y v_documentos.
--
-- Reglas (docs/negocio.md §3.8):
--   · Pendiente de una factura al crédito = total + notas de débito − notas de
--     crédito − abonos (vigentes). Negativo = saldo a favor del cliente.
--   · Las facturas de contado se consideran pagadas al emitirse (la caja llega
--     en su propio módulo).
-- =============================================================================

begin;

create or replace function pg_temp.restriccion_0017(tabla regclass, nombre text, definicion text)
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
-- 1. Crédito del cliente y condición de la venta
-- -----------------------------------------------------------------------------

alter table public.clientes add column if not exists credito_habilitado boolean not null default false;
alter table public.clientes add column if not exists limite_credito numeric(14, 2);
alter table public.clientes add column if not exists dias_credito integer not null default 30;

select pg_temp.restriccion_0017('public.clientes', 'clientes_credito_check',
  $$check ((limite_credito is null or limite_credito >= 0) and dias_credito between 0 and 365)$$);

grant update (credito_habilitado, limite_credito, dias_credito) on public.clientes to authenticated;

-- El crédito de un cliente lo dan dueño/admin (los vendedores editan lo demás).
create or replace function public.tg_credito_cliente()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.tiene_rol(new.id_empresa, array['dueno', 'admin'])
     and (tg_op = 'INSERT' and (new.credito_habilitado or new.limite_credito is not null or new.dias_credito <> 30)
          or tg_op = 'UPDATE' and (new.credito_habilitado, new.limite_credito, new.dias_credito)
                                  is distinct from (old.credito_habilitado, old.limite_credito, old.dias_credito)) then
    raise exception 'Solo el dueño o un administrador pueden dar o cambiar el crédito de un cliente.';
  end if;
  return new;
end;
$$;

create or replace trigger b_credito
  before insert or update on public.clientes
  for each row execute function public.tg_credito_cliente();

alter table public.carritos add column if not exists condicion text not null default 'contado';
select pg_temp.restriccion_0017('public.carritos', 'carritos_condicion_check',
  $$check (condicion in ('contado', 'credito'))$$);
grant update (condicion) on public.carritos to authenticated;

alter table public.documentos add column if not exists condicion text not null default 'contado';
alter table public.documentos add column if not exists dias_credito integer;
select pg_temp.restriccion_0017('public.documentos', 'documentos_condicion_check',
  $$check (condicion in ('contado', 'credito'))$$);
create index if not exists documentos_credito_idx
  on public.documentos (id_empresa, id_cliente) where condicion = 'credito' and tipo = 'factura';

-- -----------------------------------------------------------------------------
-- 2. Recibos de abono
-- -----------------------------------------------------------------------------

create table if not exists public.pagos (
  id uuid primary key default gen_random_uuid(),
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  numero text not null,
  correlativo integer not null,
  id_cliente bigint not null references public.clientes (id),
  cliente_nombre text not null,
  cliente_rtn text,
  fecha timestamptz not null default now(),
  monto numeric(14, 2) not null,
  forma_pago text not null,
  referencia text,
  notas text,
  estado text not null default 'emitido',
  anulado_en timestamptz,
  anulado_por uuid references public.usuarios (id) on delete set null,
  motivo_anulacion text,
  creado_por uuid references public.usuarios (id) on delete set null default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint pagos_numero_key unique (id_empresa, numero)
);

create index if not exists pagos_empresa_fecha_idx on public.pagos (id_empresa, fecha desc);
create index if not exists pagos_id_cliente_idx on public.pagos (id_cliente);
create index if not exists pagos_creado_por_idx on public.pagos (creado_por);
create index if not exists pagos_anulado_por_idx on public.pagos (anulado_por);

select pg_temp.restriccion_0017('public.pagos', 'pagos_monto_check', $$check (monto > 0)$$);
select pg_temp.restriccion_0017('public.pagos', 'pagos_forma_check',
  $$check (forma_pago in ('efectivo', 'tarjeta', 'transferencia', 'deposito', 'cheque', 'otro'))$$);
select pg_temp.restriccion_0017('public.pagos', 'pagos_estado_check', $$check (estado in ('emitido', 'anulado'))$$);
select pg_temp.restriccion_0017('public.pagos', 'pagos_textos_check',
  $$check ((referencia is null or char_length(referencia) <= 80) and (notas is null or char_length(notas) <= 300))$$);

create table if not exists public.pagos_aplicaciones (
  id bigint generated by default as identity primary key,
  id_pago uuid not null references public.pagos (id) on delete cascade,
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  id_documento uuid not null references public.documentos (id),
  monto numeric(14, 2) not null
);

create index if not exists pagos_aplicaciones_id_pago_idx on public.pagos_aplicaciones (id_pago);
create index if not exists pagos_aplicaciones_id_documento_idx on public.pagos_aplicaciones (id_documento);
create index if not exists pagos_aplicaciones_id_empresa_idx on public.pagos_aplicaciones (id_empresa);

select pg_temp.restriccion_0017('public.pagos_aplicaciones', 'pagos_aplicaciones_monto_check', $$check (monto > 0)$$);

-- -----------------------------------------------------------------------------
-- 3. Cuentas por cobrar
-- -----------------------------------------------------------------------------

-- Una fila por factura al crédito vigente, con lo que queda por cobrar.
create or replace view public.v_cuentas_cobrar with (security_invoker = true) as
with base as (
  select f.id,
         f.id_empresa,
         f.numero,
         f.fecha,
         f.vence,
         f.id_cliente,
         f.cliente_nombre,
         f.cliente_rtn,
         f.total,
         coalesce((select sum(n.total) from public.documentos n
                    where n.id_factura = f.id and n.tipo = 'nota_debito' and n.estado = 'emitido'), 0) as debitos,
         coalesce((select sum(n.total) from public.documentos n
                    where n.id_factura = f.id and n.tipo = 'nota_credito' and n.estado = 'emitido'), 0) as creditos,
         coalesce((select sum(a.monto) from public.pagos_aplicaciones a
                     join public.pagos p on p.id = a.id_pago
                    where a.id_documento = f.id and p.estado = 'emitido'), 0) as abonado,
         (now() at time zone 'America/Tegucigalpa')::date as hoy
    from public.documentos f
   where f.tipo = 'factura' and f.condicion = 'credito' and f.estado = 'emitido'
)
select b.id,
       b.id_empresa,
       b.numero,
       b.fecha,
       b.vence,
       b.id_cliente,
       b.cliente_nombre,
       b.cliente_rtn,
       b.total,
       b.debitos,
       b.creditos,
       b.abonado,
       b.total + b.debitos - b.creditos - b.abonado as pendiente,
       greatest(b.hoy - b.vence, 0) as dias_vencida,
       case when b.total + b.debitos - b.creditos - b.abonado <= 0 then 'pagada'
            when b.hoy > b.vence then 'vencida'
            when b.vence - b.hoy <= 7 then 'por_vencer'
            else 'al_dia' end as estado
  from base b;

-- Una fila por cliente con crédito o con algo pendiente.
create or replace view public.v_cuentas_clientes with (security_invoker = true) as
select c.id,
       c.id_empresa,
       c.nombre,
       c.rtn,
       c.telefono,
       c.credito_habilitado,
       c.limite_credito,
       c.dias_credito,
       coalesce(t.pendiente, 0) as pendiente,
       coalesce(t.vencido, 0) as vencido,
       case when c.limite_credito is not null then c.limite_credito - coalesce(t.pendiente, 0) end as disponible,
       coalesce(t.facturas, 0)::integer as facturas,
       coalesce(t.dias_mora, 0)::integer as dias_mora,
       t.proximo_vence,
       (select max(p.fecha) from public.pagos p where p.id_cliente = c.id and p.estado = 'emitido') as ultimo_abono,
       case when coalesce(t.vencido, 0) > 0 then 'vencida'
            when coalesce(t.pendiente, 0) > 0 then 'al_dia'
            when coalesce(t.pendiente, 0) < 0 then 'a_favor'
            else 'sin_saldo' end as estado,
       coalesce(t.vencido, 0) > 0 as en_mora
  from public.clientes c
  left join (
    select cc.id_cliente,
           sum(cc.pendiente) as pendiente,
           sum(cc.pendiente) filter (where cc.estado = 'vencida') as vencido,
           count(*) filter (where cc.pendiente > 0) as facturas,
           max(cc.dias_vencida) filter (where cc.pendiente > 0) as dias_mora,
           min(cc.vence) filter (where cc.pendiente > 0) as proximo_vence
      from public.v_cuentas_cobrar cc
     group by cc.id_cliente
  ) t on t.id_cliente = c.id
 where c.credito_habilitado or t.id_cliente is not null;

-- Pendiente de una factura al crédito (0 si es de contado o está anulada).
create or replace function public.pendiente_factura(p_factura uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce((select c.pendiente from public.v_cuentas_cobrar c where c.id = p_factura), 0);
$$;

-- -----------------------------------------------------------------------------
-- 4. Abonos
-- -----------------------------------------------------------------------------

/*
  Registra un abono de un cliente. Cualquier miembro (el que cobra).
  p_aplicaciones  null = a las facturas más antiguas primero (por vencimiento);
                  [{ "id_documento": "…", "monto": 500 }] = reparto elegido
                  (la suma debe ser igual al monto).
  No acepta más de lo pendiente. Devuelve el id del recibo.
*/
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
                            monto, forma_pago, referencia, notas)
  values (v_cliente.id_empresa, 'REC-' || lpad(v_correlativo::text, 6, '0'), v_correlativo,
          v_cliente.id, v_cliente.nombre, v_cliente.rtn, v_monto, p_forma_pago,
          nullif(btrim(p_referencia), ''), nullif(btrim(p_notas), ''))
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

create or replace function public.anular_pago(p_pago uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pago public.pagos;
begin
  select * into v_pago from public.pagos where id = p_pago for update;
  if not found or not public.es_miembro(v_pago.id_empresa) then
    raise exception 'El recibo no existe.';
  end if;
  if not public.tiene_rol(v_pago.id_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden anular recibos.';
  end if;
  if v_pago.estado = 'anulado' then
    raise exception 'El recibo ya está anulado.';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Escribí el motivo de la anulación.';
  end if;
  update public.pagos
     set estado = 'anulado', anulado_en = now(), anulado_por = auth.uid(), motivo_anulacion = btrim(p_motivo)
   where id = p_pago;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Emisión y anulación de facturas (0016 + crédito)
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
    exoneracion, notas, id_carrito, condicion, dias_credito
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
    case when v_credito then v_cliente.dias_credito end
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

create or replace function public.anular_documento(p_documento uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.documentos;
  v_signo integer;
begin
  select * into v_doc from public.documentos where id = p_documento for update;
  if not found or not public.es_miembro(v_doc.id_empresa) then
    raise exception 'El documento no existe.';
  end if;
  if not public.tiene_rol(v_doc.id_empresa, array['dueno', 'admin']) then
    raise exception 'Solo el dueño o un administrador pueden anular documentos.';
  end if;
  if v_doc.estado = 'anulado' then
    raise exception 'El documento ya está anulado.';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Escribí el motivo de la anulación.';
  end if;
  if v_doc.tipo = 'factura' and exists (
       select 1 from public.documentos n where n.id_factura = v_doc.id and n.estado = 'emitido') then
    raise exception 'Esta factura tiene notas de crédito o débito vigentes: anulalas primero.';
  end if;
  if v_doc.tipo = 'factura' and exists (
       select 1 from public.pagos_aplicaciones a join public.pagos p on p.id = a.id_pago
        where a.id_documento = v_doc.id and p.estado = 'emitido') then
    raise exception 'Esta factura tiene abonos: anulá primero sus recibos.';
  end if;

  update public.documentos
     set estado = 'anulado', anulado_en = now(), anulado_por = auth.uid(), motivo_anulacion = btrim(p_motivo)
   where id = p_documento;

  -- Factura: las piezas vuelven. Devolución reintegrada: vuelven a salir.
  v_signo := case when v_doc.tipo = 'factura' then 1
                  when v_doc.tipo = 'nota_credito' and v_doc.reintegra_inventario then -1 end;
  if v_signo is not null then
    perform set_config('wp.movimiento_tipo', 'anulacion', true);
    perform set_config('wp.movimiento_ref', v_doc.numero, true);
    update public.productos p
       set existencia = p.existencia + v_signo * x.cantidad
      from (select id_producto, sum(cantidad) as cantidad
              from public.documentos_lineas
             where id_documento = p_documento and id_producto is not null and controla_inventario
             group by id_producto) x
     where p.id = x.id_producto;
    perform set_config('wp.movimiento_tipo', '', true);
    perform set_config('wp.movimiento_ref', '', true);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Permisos y RLS
-- -----------------------------------------------------------------------------

revoke all on public.pagos, public.pagos_aplicaciones from anon, authenticated;
grant select on public.pagos, public.pagos_aplicaciones to authenticated;

alter table public.pagos enable row level security;
alter table public.pagos_aplicaciones enable row level security;

-- Solo lectura: se escriben con registrar_pago() / anular_pago().
drop policy if exists empresa_lectura on public.pagos;
create policy empresa_lectura on public.pagos
  for select to authenticated using (public.es_miembro(id_empresa));
drop policy if exists empresa_lectura on public.pagos_aplicaciones;
create policy empresa_lectura on public.pagos_aplicaciones
  for select to authenticated using (public.es_miembro(id_empresa));

revoke all on function public.registrar_pago(bigint, numeric, text, text, text, jsonb) from public, anon;
revoke all on function public.anular_pago(uuid, text) from public, anon;
revoke all on function public.pendiente_factura(uuid) from public, anon;
grant execute on function public.registrar_pago(bigint, numeric, text, text, text, jsonb) to authenticated;
grant execute on function public.anular_pago(uuid, text) to authenticated;
grant execute on function public.pendiente_factura(uuid) to authenticated;

-- Auditoría (0011).
do $$
begin
  if to_regprocedure('public.registrar_cambio()') is not null then
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.pagos '
            'for each row execute function public.registrar_cambio()';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Vistas
-- -----------------------------------------------------------------------------

create or replace view public.v_pagos with (security_invoker = true) as
select p.id,
       p.id_empresa,
       p.numero,
       p.fecha,
       p.id_cliente,
       p.cliente_nombre,
       p.cliente_rtn,
       p.monto,
       p.forma_pago,
       p.referencia,
       p.notas,
       p.estado,
       p.motivo_anulacion,
       (select string_agg(d.numero, ', ' order by d.numero)
          from public.pagos_aplicaciones a join public.documentos d on d.id = a.id_documento
         where a.id_pago = p.id) as facturas,
       u.nombre as cobro,
       p.creado_en
  from public.pagos p
  left join public.usuarios u on u.id = p.creado_por;

create or replace view public.v_pagos_aplicaciones with (security_invoker = true) as
select a.id, a.id_pago, a.id_empresa, a.id_documento, d.numero, d.fecha as fecha_factura, d.total, a.monto
  from public.pagos_aplicaciones a
  join public.documentos d on d.id = a.id_documento;

create or replace view public.v_clientes with (security_invoker = true) as
select c.id,
       c.id_empresa,
       c.nombre,
       c.rtn,
       c.telefono,
       c.correo,
       c.direccion,
       c.notas,
       c.activo,
       (select count(*) from public.documentos d where d.id_cliente = c.id and d.tipo = 'factura' and d.estado = 'emitido')::integer as facturas,
       (select max(d.fecha) from public.documentos d where d.id_cliente = c.id) as ultima_compra,
       c.creado_en,
       c.exonerado,
       c.exo_constancia,
       c.exo_registro_sag,
       c.credito_habilitado,
       c.limite_credito,
       c.dias_credito,
       coalesce((select sum(cc.pendiente) from public.v_cuentas_cobrar cc where cc.id_cliente = c.id), 0) as saldo
  from public.clientes c;

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
       c.condicion
  from public.carritos c
  left join public.usuarios u on u.id = c.creado_por
  left join (
    select id_carrito, count(*) as lineas, sum(cantidad) as unidades
      from public.carritos_lineas group by id_carrito
  ) t on t.id_carrito = c.id;

create or replace view public.v_documentos with (security_invoker = true) as
select d.id,
       d.id_empresa,
       d.tipo,
       d.numero,
       d.fecha,
       d.vence,
       d.cliente_nombre,
       d.cliente_rtn,
       d.vehiculo,
       d.subtotal,
       d.descuento,
       d.isv,
       d.total,
       d.estado,
       d.cai,
       u.nombre as vendedor,
       d.creado_en,
       d.importe_exonerado,
       d.id_factura,
       d.factura_numero,
       d.motivo_tipo,
       d.establecimiento || '-' || d.punto_emision as punto,
       d.exoneracion is not null as exonerada,
       d.condicion,
       cc.pendiente
  from public.documentos d
  left join public.usuarios u on u.id = d.creado_por
  left join public.v_cuentas_cobrar cc on cc.id = d.id;

revoke all on public.v_cuentas_cobrar, public.v_cuentas_clientes, public.v_pagos, public.v_pagos_aplicaciones from anon;
grant select on public.v_cuentas_cobrar, public.v_cuentas_clientes, public.v_pagos, public.v_pagos_aplicaciones
  to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Documentación en la base
-- -----------------------------------------------------------------------------

comment on column public.clientes.limite_credito is 'Tope de lo pendiente al crédito (null = sin límite). Dueño/admin pueden pasarlo.';
comment on column public.documentos.condicion is 'contado | credito. Al crédito, vence = fecha + dias_credito.';
comment on table public.pagos is 'Recibos de abono (REC-000001). Inmutables: se anulan. Se reparten en pagos_aplicaciones.';
comment on view public.v_cuentas_cobrar is 'Facturas al crédito vigentes: pendiente = total + débitos − créditos − abonos.';
comment on function public.registrar_pago(bigint, numeric, text, text, text, jsonb) is
  'Abono de un cliente: a las facturas elegidas o a las más antiguas primero. No acepta más de lo pendiente.';

commit;
