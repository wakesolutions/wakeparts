-- =============================================================================
-- 0020 · Dock personalizable por usuario
-- -----------------------------------------------------------------------------
-- ESTADO: PENDIENTE
-- Idempotente y atómica. Requiere 0008.
--
-- Qué crea o cambia:
--   · usuarios.dock   jsonb { ocultos: [id de módulo…], tonos: { id: tono } }:
--                     qué módulos no van fijos en el dock y el esmalte de cada
--                     ícono. Lo cambia cada usuario sobre su propia fila.
--
-- No toca datos existentes (la columna nace vacía: dock de fábrica).
-- =============================================================================

begin;

alter table public.usuarios add column if not exists dock jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.usuarios'::regclass and conname = 'usuarios_dock_check') then
    alter table public.usuarios add constraint usuarios_dock_check
      check (jsonb_typeof(dock) = 'object' and pg_column_size(dock) <= 4096);
  end if;
end $$;

grant update (dock) on public.usuarios to authenticated;

comment on column public.usuarios.dock is
  'Dock personalizado: { ocultos: [módulos fuera del dock], tonos: { módulo: metal|rojo|ambar|verde|azul|marfil } }.';

commit;
