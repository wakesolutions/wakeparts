-- =============================================================================
-- 0015 · Seguimiento de talleres (solo admin de plataforma)
-- -----------------------------------------------------------------------------
-- Para el dueño de Wake Parts: qué talleres se registraron y qué tanto lo
-- usan, para escribirles a mano (WhatsApp o correo) a los que se quedaron a
-- medio camino. No manda nada solo.
--
--   · seguimiento_empresas()      Una fila por empresa: dueño y su contacto,
--                                 productos, cotizaciones, facturas, último
--                                 acceso, sitio, pedidos web y «etapa».
--                                 Vacío para cualquiera que no sea admin de
--                                 plataforma.
--   · v_seguimiento_empresas      Vista sobre la función (para TablaMaestra).
--   · seguimiento_contactos       Notas del admin: cuándo le escribió y qué.
--                                 Solo admin de plataforma.
--
-- ESTADO: YA APLICADA (confirmado 2026-10-02)
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Notas de contacto
-- -----------------------------------------------------------------------------

create table if not exists public.seguimiento_contactos (
  id_empresa uuid primary key references public.empresas (id) on delete cascade,
  contactado_en timestamptz,
  nota text,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.usuarios (id) on delete set null default auth.uid()
);

create index if not exists seguimiento_contactos_actualizado_por_idx on public.seguimiento_contactos (actualizado_por);

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.seguimiento_contactos'::regclass
                  and conname = 'seguimiento_contactos_nota_check') then
    alter table public.seguimiento_contactos
      add constraint seguimiento_contactos_nota_check check (nota is null or char_length(nota) <= 1000);
  end if;
end $$;

alter table public.seguimiento_contactos enable row level security;
revoke all on public.seguimiento_contactos from anon, authenticated;
grant select, insert, update on public.seguimiento_contactos to authenticated;

drop policy if exists admin_plataforma on public.seguimiento_contactos;
create policy admin_plataforma on public.seguimiento_contactos
  for all to authenticated
  using (public.es_admin_plataforma())
  with check (public.es_admin_plataforma());

-- -----------------------------------------------------------------------------
-- 2. Resumen por empresa
-- -----------------------------------------------------------------------------

create or replace function public.seguimiento_empresas()
returns table (
  id_empresa uuid,
  empresa text,
  registrada_en timestamptz,
  dias_registrada integer,
  dueno text,
  correo text,
  telefono text,
  telefono_empresa text,
  miembros integer,
  productos integer,
  cotizaciones integer,
  facturas integer,
  ultimo_documento timestamptz,
  ultimo_acceso timestamptz,
  dias_sin_entrar integer,
  sitio_publicado boolean,
  pedidos_web integer,
  etapa text,
  contactado_en timestamptz,
  nota text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.es_admin_plataforma() then
    return;
  end if;

  return query
  with base as (
    select e.id,
           e.nombre,
           e.creado_en,
           e.telefono as tel_empresa,
           (select u.id from public.empresas_usuarios m join public.usuarios u on u.id = m.id_usuario
             where m.id_empresa = e.id and m.rol = 'dueno' and m.activo order by m.creado_en limit 1) as id_dueno,
           (select count(*) from public.empresas_usuarios m where m.id_empresa = e.id and m.activo)::integer as n_miembros,
           (select count(*) from public.productos p where p.id_empresa = e.id and p.activo)::integer as n_productos,
           (select count(*) from public.documentos d where d.id_empresa = e.id and d.tipo = 'cotizacion')::integer as n_cot,
           (select count(*) from public.documentos d where d.id_empresa = e.id and d.tipo = 'factura')::integer as n_fac,
           (select max(d.fecha) from public.documentos d where d.id_empresa = e.id) as ult_doc,
           (select max(a.last_sign_in_at) from public.empresas_usuarios m join auth.users a on a.id = m.id_usuario
             where m.id_empresa = e.id) as ult_acceso,
           e.sitio_publicado as publicado
      from public.empresas e
     where e.activo
  )
  select b.id,
         b.nombre,
         b.creado_en,
         (current_date - b.creado_en::date)::integer,
         u.nombre,
         u.correo,
         u.telefono,
         b.tel_empresa,
         b.n_miembros,
         b.n_productos,
         b.n_cot,
         b.n_fac,
         b.ult_doc,
         b.ult_acceso,
         case when b.ult_acceso is not null then (current_date - b.ult_acceso::date)::integer end,
         coalesce(b.publicado, false),
         (select count(*) from public.pedidos_web pw where pw.id_empresa = b.id)::integer,
         case
           when b.n_productos = 0 then 'sin_productos'
           when b.n_cot + b.n_fac = 0 then 'sin_cotizar'
           when b.n_fac = 0 then 'cotizando'
           else 'facturando'
         end,
         s.contactado_en,
         s.nota
    from base b
    left join public.usuarios u on u.id = b.id_dueno
    left join public.seguimiento_contactos s on s.id_empresa = b.id;
end;
$$;

revoke all on function public.seguimiento_empresas() from public, anon;
grant execute on function public.seguimiento_empresas() to authenticated;

create or replace view public.v_seguimiento_empresas with (security_invoker = true) as
select * from public.seguimiento_empresas();

revoke all on public.v_seguimiento_empresas from anon, authenticated;
grant select on public.v_seguimiento_empresas to authenticated;

commit;
