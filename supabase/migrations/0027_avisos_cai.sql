-- 0027 · Avisos de CAI por vencer o por agotarse
--
-- Qué hace: avisa ANTES de que un taller se quede sin poder facturar.
-- - `cai_avisos`: cada aviso dado a un CAI (una vez por umbral), con su texto y
--   cuándo se mandó el correo.
-- - `avisos_de_cai()`: qué umbrales cruzó un CAI hoy. Por fecha: 30, 15 y 5
--   días antes de la fecha límite y vencido. Por rango: 80 % y 95 % usado y
--   agotado.
-- - `revisar_cai(empresa)`: por cada punto de emisión activo y tipo de
--   documento mira el CAI que se usará último (el de fecha límite más lejana).
--   Si cruzó un umbral nuevo, guarda el aviso y crea una tarea en la campanita
--   (Ventas › CAI). Las tareas se resuelven solas cuando ya no aplican: se
--   registró el CAI siguiente, se desactivó el CAI o el punto.
-- - Triggers en `cai`: al registrar/activar/desactivar un CAI o cambiar su
--   rango o fecha, y cuando el correlativo cruza 80 %, 95 % o se agota. Nunca
--   bloquean la factura (si fallan, solo avisan en el log de la base).
-- - El correo al dueño/admin lo manda `/api/cron/alertas` (cada 15 min), que
--   también llama `revisar_cai()` para los avisos por fecha.
--
-- Por qué: hoy el sistema bloquea bien un CAI vencido o agotado, pero el taller
-- se entera con el cliente enfrente. Pendiente 6 de la revisión para producción.
--
-- Datos: no cambia filas existentes. Al final corre `revisar_cai()` una vez:
-- los CAI que ya estén en un umbral reciben su tarea en la campanita, pero se
-- marcan como «correo ya enviado» para no mandar correos por estados viejos.
--
-- ESTADO: YA APLICADA (confirmado 2026-10-14)

begin;

create table if not exists public.cai_avisos (
  id bigint generated always as identity primary key,
  id_cai bigint not null references public.cai (id) on delete cascade,
  id_empresa uuid not null references public.empresas (id) on delete cascade,
  aviso text not null,
  titulo text not null,
  cuerpo text,
  creado_en timestamptz not null default now(),
  correo_enviado_en timestamptz,
  constraint cai_avisos_unico unique (id_cai, aviso)
);

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.cai_avisos'::regclass and conname = 'cai_avisos_check') then
    alter table public.cai_avisos add constraint cai_avisos_check
      check (aviso in ('dias_30', 'dias_15', 'dias_5', 'vencido', 'rango_80', 'rango_95', 'agotado'));
  end if;
end $$;

create index if not exists cai_avisos_empresa_idx on public.cai_avisos (id_empresa, creado_en desc);
create index if not exists cai_avisos_sin_correo_idx on public.cai_avisos (creado_en) where correo_enviado_en is null;

-- Solo el servidor (llave secreta) y las funciones: los talleres ven las tareas en `notificaciones`.
alter table public.cai_avisos enable row level security;
revoke all on public.cai_avisos from anon, authenticated;

-- Tramo de uso del rango: 0 normal, 1 ≥ 80 %, 2 ≥ 95 %, 3 agotado. Para el WHEN del trigger.
create or replace function public.cai_tramo(p_siguiente integer, p_inicial integer, p_final integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_siguiente > p_final then 3
    -- bigint: un rango de 8 dígitos × 100 no cabe en integer.
    when (p_siguiente - p_inicial)::bigint * 100 >= 95 * greatest(p_final - p_inicial + 1, 1)::bigint then 2
    when (p_siguiente - p_inicial)::bigint * 100 >= 80 * greatest(p_final - p_inicial + 1, 1)::bigint then 1
    else 0
  end;
$$;

-- Umbrales vigentes de un CAI hoy: a lo sumo uno por fecha y uno por rango.
create or replace function public.avisos_de_cai(p_cai public.cai, p_hoy date)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(array[
    case
      when p_cai.fecha_limite < p_hoy then 'vencido'
      when p_cai.fecha_limite - p_hoy <= 5 then 'dias_5'
      when p_cai.fecha_limite - p_hoy <= 15 then 'dias_15'
      when p_cai.fecha_limite - p_hoy <= 30 then 'dias_30'
    end,
    case public.cai_tramo(p_cai.siguiente, p_cai.rango_inicial, p_cai.rango_final)
      when 3 then 'agotado' when 2 then 'rango_95' when 1 then 'rango_80'
    end
  ], null);
$$;

create or replace function public.revisar_cai(p_empresa uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoy date := (now() at time zone 'America/Tegucigalpa')::date;
  r record;
  v_aviso text;
  v_familia text;
  v_origen text;
  v_vigentes text[] := '{}';
  v_doc text;
  v_lugar text;
  v_quedan integer;
  v_pct integer;
  v_dias integer;
  v_titulo text;
  v_cuerpo text;
  v_nuevos integer := 0;
  v_id bigint;
begin
  for r in
    select distinct on (c.id_empresa, c.id_punto_emision, c.tipo_documento)
           c as fila, p.nombre as punto, p.establecimiento, p.punto_emision
      from public.cai c
      join public.puntos_emision p on p.id = c.id_punto_emision and p.activo
     where c.activo and (p_empresa is null or c.id_empresa = p_empresa)
     order by c.id_empresa, c.id_punto_emision, c.tipo_documento, c.fecha_limite desc, c.id desc
  loop
    v_doc := case (r.fila).tipo_documento when '06' then 'notas de crédito' when '07' then 'notas de débito'
                                           else 'facturas' end;
    v_lugar := r.punto || ' (' || r.establecimiento || '-' || r.punto_emision || ')';

    foreach v_aviso in array public.avisos_de_cai(r.fila, v_hoy) loop
      v_familia := case when v_aviso in ('rango_80', 'rango_95', 'agotado') then 'rango' else 'fecha' end;
      v_origen := (r.fila).id || ':' || v_familia;
      v_vigentes := v_vigentes || v_origen;

      v_quedan := greatest((r.fila).rango_final - (r.fila).siguiente + 1, 0);
      v_pct := floor(((r.fila).siguiente - (r.fila).rango_inicial) * 100.0
                     / greatest((r.fila).rango_final - (r.fila).rango_inicial + 1, 1));
      v_dias := (r.fila).fecha_limite - v_hoy;

      v_titulo := case v_aviso
        when 'vencido' then 'Venció el CAI de ' || v_doc || ' · ' || v_lugar
        when 'agotado' then 'Se acabaron los números del CAI de ' || v_doc || ' · ' || v_lugar
        when 'rango_80' then 'CAI de ' || v_doc || ' al ' || v_pct || ' % · quedan ' || v_quedan || ' números · ' || v_lugar
        when 'rango_95' then 'CAI de ' || v_doc || ' al ' || v_pct || ' % · quedan ' || v_quedan || ' números · ' || v_lugar
        else 'El CAI de ' || v_doc || ' vence en ' || v_dias || case when v_dias = 1 then ' día' else ' días' end
             || ' · ' || v_lugar
      end;
      v_cuerpo := case
        when v_aviso in ('vencido', 'agotado') then
          'Sin un CAI vigente no se pueden emitir ' || v_doc || ' en este punto. Registrá el nuevo CAI del SAR en Ventas › CAI.'
        when v_familia = 'rango' then
          'Pedí al SAR el siguiente rango y registralo en Ventas › CAI antes de que se acabe.'
        else
          'Vence el ' || to_char((r.fila).fecha_limite, 'DD/MM/YYYY')
          || '. Pedí el nuevo CAI al SAR y registralo en Ventas › CAI para no quedarte sin facturar.'
      end;

      insert into public.cai_avisos (id_cai, id_empresa, aviso, titulo, cuerpo)
      values ((r.fila).id, (r.fila).id_empresa, v_aviso, left(v_titulo, 160), v_cuerpo)
      on conflict (id_cai, aviso) do nothing
      returning id into v_id;

      if v_id is not null then
        v_nuevos := v_nuevos + 1;
        -- Una sola tarea abierta por CAI y familia: la más reciente.
        update public.notificaciones set resuelta_en = now()
         where origen_tabla = 'cai' and origen_id = v_origen and resuelta_en is null;
        insert into public.notificaciones (id_empresa, tipo, titulo, cuerpo, enlace, es_tarea, origen_tabla, origen_id)
        values ((r.fila).id_empresa, 'cai', left(v_titulo, 160), v_cuerpo,
                jsonb_build_object('modulo', 'ventas', 'seccion', 'cai', 'recurso', 'cai', 'id', (r.fila).id),
                true, 'cai', v_origen);
      end if;
      v_id := null;
    end loop;
  end loop;

  -- Lo que ya no aplica (CAI siguiente registrado, CAI o punto desactivado): resuelto.
  update public.notificaciones set resuelta_en = now()
   where origen_tabla = 'cai' and resuelta_en is null
     and (p_empresa is null or id_empresa = p_empresa)
     and not (origen_id = any (v_vigentes));

  return v_nuevos;
end;
$$;

revoke all on function public.revisar_cai(uuid) from public, anon, authenticated;
grant execute on function public.revisar_cai(uuid) to service_role;

-- Trigger: revisa la empresa del CAI. Avisar es secundario: nunca bloquea la factura.
create or replace function public.tg_cai_revisar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.revisar_cai(coalesce(new.id_empresa, old.id_empresa));
  return null;
exception when others then
  raise warning 'tg_cai_revisar: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.tg_cai_revisar() from public, anon, authenticated;

create or replace trigger zy_cai_revisar
  after insert or delete or update of activo, fecha_limite, rango_inicial, rango_final, id_punto_emision
  on public.cai
  for each row execute function public.tg_cai_revisar();

-- Al facturar solo cambia `siguiente`: se revisa únicamente al cruzar 80 %, 95 % o agotarse.
create or replace trigger zy_cai_revisar_tramo
  after update of siguiente on public.cai
  for each row
  when (public.cai_tramo(new.siguiente, new.rango_inicial, new.rango_final)
        <> public.cai_tramo(old.siguiente, old.rango_inicial, old.rango_final))
  execute function public.tg_cai_revisar();

-- Estado actual: tareas para lo que ya cruzó un umbral, sin correo por estados viejos.
-- (now() es la hora de esta transacción: solo se marcan los avisos creados aquí.)
do $$
begin
  perform public.revisar_cai();
  update public.cai_avisos set correo_enviado_en = now()
   where correo_enviado_en is null and creado_en = now();
end $$;

commit;
