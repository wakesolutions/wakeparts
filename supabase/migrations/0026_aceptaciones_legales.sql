-- 0026 · Aceptación expresa de los términos y la política de privacidad
--
-- Qué hace: crea `aceptaciones_legales`, la constancia de que una persona marcó
-- «Acepto los Términos de uso y la Política de privacidad» (con la versión
-- vigente, la fecha, la IP y el dispositivo), y la función
-- `registrar_aceptacion_legal()` que la guarda. Se registra al crear la empresa
-- (contexto «registro») y al pagar un plan (contexto «suscripcion», con el plan,
-- el ciclo y el precio en `detalle`).
--
-- Por qué: los términos decían «al registrar tu empresa aceptás», pero no había
-- casilla ni constancia. Revisión para producción (2026-10-14).
--
-- Reglas: solo se inserta por la función (toma el usuario de la sesión, nunca
-- del navegador); nadie puede editar ni borrar una constancia por la API. Cada
-- uno ve las suyas; dueño/admin ven las de su empresa; el admin de plataforma,
-- todas.
--
-- Datos: tabla nueva, no toca filas existentes.
--
-- ESTADO: YA APLICADA (confirmado 2026-10-14)

begin;

create table if not exists public.aceptaciones_legales (
  id bigint generated always as identity primary key,
  id_usuario uuid not null references public.usuarios (id) on delete cascade,
  id_empresa uuid references public.empresas (id) on delete set null,
  contexto text not null,
  version text not null,
  documentos text[] not null default array['terminos', 'privacidad'],
  detalle jsonb not null default '{}'::jsonb,
  ip inet,
  agente text,
  aceptado_en timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.aceptaciones_legales'::regclass
                   and conname = 'aceptaciones_legales_check') then
    alter table public.aceptaciones_legales add constraint aceptaciones_legales_check
      check (contexto in ('registro', 'suscripcion')
             and version ~ '^\d{4}-\d{2}-\d{2}$'
             and jsonb_typeof(detalle) = 'object'
             and pg_column_size(detalle) <= 2048);
  end if;
end $$;

create index if not exists aceptaciones_legales_usuario_idx on public.aceptaciones_legales (id_usuario, aceptado_en desc);
create index if not exists aceptaciones_legales_empresa_idx on public.aceptaciones_legales (id_empresa, aceptado_en desc);

alter table public.aceptaciones_legales enable row level security;

drop policy if exists aceptaciones_legales_lectura on public.aceptaciones_legales;
create policy aceptaciones_legales_lectura on public.aceptaciones_legales
  for select to authenticated
  using (
    id_usuario = (select auth.uid())
    or (id_empresa is not null and public.tiene_rol(id_empresa, array['dueno', 'admin']))
    or public.es_admin_plataforma()
  );

-- Sin políticas de insert/update/delete: solo la función escribe.
revoke all on public.aceptaciones_legales from anon;
revoke insert, update, delete, truncate on public.aceptaciones_legales from authenticated;
grant select on public.aceptaciones_legales to authenticated;

create or replace function public.registrar_aceptacion_legal(
  p_contexto text,
  p_version text,
  p_empresa uuid default null,
  p_detalle jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_headers jsonb;
  v_id bigint;
begin
  if v_usuario is null then
    raise exception 'Tu sesión expiró. Volvé a entrar.' using errcode = '28000';
  end if;
  if p_empresa is not null and not public.es_miembro(p_empresa) then
    raise exception 'No pertenecés a esa empresa.' using errcode = '42501';
  end if;

  v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;

  insert into public.aceptaciones_legales (id_usuario, id_empresa, contexto, version, detalle, ip, agente)
  values (
    v_usuario,
    p_empresa,
    p_contexto,
    p_version,
    coalesce(p_detalle, '{}'::jsonb),
    public.ip_segura(v_headers ->> 'x-cliente-ip'),
    left(v_headers ->> 'x-cliente-agente', 500)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_aceptacion_legal(text, text, uuid, jsonb) from public, anon;
grant execute on function public.registrar_aceptacion_legal(text, text, uuid, jsonb) to authenticated;

-- Auditoría (0011).
do $$
begin
  if to_regprocedure('public.registrar_cambio()') is not null then
    execute 'create or replace trigger zz_registrar_cambio after insert or update or delete on public.aceptaciones_legales '
            'for each row execute function public.registrar_cambio()';
  end if;
end $$;

commit;
