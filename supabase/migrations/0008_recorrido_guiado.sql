-- =============================================================================
-- 0008 · Recorrido guiado del escritorio
-- -----------------------------------------------------------------------------
-- `usuarios.recorrido_visto_en`: cuándo terminó (o saltó) el usuario el
-- recorrido de bienvenida. Null = se le muestra al entrar. Lo pone el propio
-- usuario (política `usuarios_edicion_propia`); «Repetir recorrido» en
-- Mi usuario lo vuelve a null.
-- Idempotente y transaccional: se puede ejecutar más de una vez.
-- =============================================================================

begin;

alter table public.usuarios add column if not exists recorrido_visto_en timestamptz;

comment on column public.usuarios.recorrido_visto_en is
  'Cuándo terminó o saltó el recorrido guiado del escritorio. Null = pendiente.';

grant update (recorrido_visto_en) on public.usuarios to authenticated;

commit;
