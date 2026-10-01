-- =============================================================================
-- 0012 · Identidad visual de cada empresa
-- -----------------------------------------------------------------------------
-- Para que cada taller sienta el sistema como propio:
--   · empresas.logo_ruta           Logo (Storage: bucket «empresas»). Se ve en
--                                  la barra, el escritorio y los documentos.
--   · empresas.fondo_ruta          Fondo de pantalla del escritorio. Null = el
--                                  de Wake Parts («Restablecer»).
--   · empresas.fondo_atenuar       0–85 %: cuánto se oscurece/aclara el fondo
--                                  para que el texto se lea.
--   · empresas.acento              Color de marca (#rrggbb). Null = el de la
--                                  paleta. Reemplaza el rojo en toda la app.
--   · empresas.formato_documento   Diseño de facturas y cotizaciones (jsonb):
--                                  estilo, logo, color, qué mostrar, mensaje.
--                                  Los datos fiscales no se pueden ocultar (lo
--                                  impone la app; el jsonb solo guarda opciones).
-- Archivos: <id_empresa>/logo/<uuid>.webp y <id_empresa>/fondo/<uuid>.webp.
-- Los editan dueño y administradores (RLS por columna + Storage por carpeta).
--
-- ESTADO: PENDIENTE
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

create or replace function pg_temp.agregar_restriccion(p_tabla regclass, p_nombre text, p_def text)
returns void
language plpgsql
as $$
begin
  if not exists (select 1 from pg_constraint where conrelid = p_tabla and conname = p_nombre) then
    execute format('alter table %s add constraint %I %s', p_tabla, p_nombre, p_def);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Columnas
-- -----------------------------------------------------------------------------

alter table public.empresas add column if not exists logo_ruta text;
alter table public.empresas add column if not exists fondo_ruta text;
alter table public.empresas add column if not exists fondo_atenuar smallint not null default 40;
alter table public.empresas add column if not exists acento text;
alter table public.empresas add column if not exists formato_documento jsonb not null default '{}'::jsonb;

select pg_temp.agregar_restriccion('public.empresas', 'empresas_fondo_atenuar_check',
  $$check (fondo_atenuar between 0 and 85)$$);
select pg_temp.agregar_restriccion('public.empresas', 'empresas_acento_check',
  $$check (acento is null or acento ~ '^#[0-9a-f]{6}$')$$);
select pg_temp.agregar_restriccion('public.empresas', 'empresas_formato_documento_check',
  $$check (jsonb_typeof(formato_documento) = 'object' and pg_column_size(formato_documento) < 8192)$$);
-- Los archivos tienen que estar en la carpeta de la propia empresa.
select pg_temp.agregar_restriccion('public.empresas', 'empresas_logo_ruta_check',
  $$check (logo_ruta is null or logo_ruta like id::text || '/logo/%')$$);
select pg_temp.agregar_restriccion('public.empresas', 'empresas_fondo_ruta_check',
  $$check (fondo_ruta is null or fondo_ruta like id::text || '/fondo/%')$$);

grant update (logo_ruta, fondo_ruta, fondo_atenuar, acento, formato_documento) on public.empresas to authenticated;

comment on column public.empresas.logo_ruta is 'Logo en Storage (bucket empresas): <empresa>/logo/<archivo>.';
comment on column public.empresas.fondo_ruta is 'Fondo del escritorio en Storage (bucket empresas). Null = fondo de Wake Parts.';
comment on column public.empresas.fondo_atenuar is 'Atenuación del fondo del escritorio, 0–85 %.';
comment on column public.empresas.acento is 'Color de marca #rrggbb. Null = el acento de la paleta.';
comment on column public.empresas.formato_documento is 'Diseño de facturas y cotizaciones (opciones; los datos fiscales siempre se imprimen).';

-- -----------------------------------------------------------------------------
-- 2. Storage: bucket público «empresas» (logo y fondo)
--    Público para que el logo salga en documentos impresos sin firmar URLs;
--    las rutas llevan un uuid, no se pueden adivinar.
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('empresas', 'empresas', true, 8388608,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists wp_empresas_lectura on storage.objects;
create policy wp_empresas_lectura on storage.objects
  for select to authenticated
  using (bucket_id = 'empresas' and public.es_miembro(public.empresa_de_ruta(name)));

drop policy if exists wp_empresas_subir on storage.objects;
create policy wp_empresas_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empresas'
              and public.tiene_rol(public.empresa_de_ruta(name), array['dueno', 'admin']));

drop policy if exists wp_empresas_cambiar on storage.objects;
create policy wp_empresas_cambiar on storage.objects
  for update to authenticated
  using (bucket_id = 'empresas' and public.tiene_rol(public.empresa_de_ruta(name), array['dueno', 'admin']))
  with check (bucket_id = 'empresas' and public.tiene_rol(public.empresa_de_ruta(name), array['dueno', 'admin']));

drop policy if exists wp_empresas_borrar on storage.objects;
create policy wp_empresas_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'empresas' and public.tiene_rol(public.empresa_de_ruta(name), array['dueno', 'admin']));

commit;
