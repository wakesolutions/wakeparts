-- =============================================================================
-- 0000 · Línea base: catálogo de vehículos
-- -----------------------------------------------------------------------------
-- ESTADO: YA APLICADA (las tablas se crearon a mano antes de este repo).
-- Idempotente: si se vuelve a ejecutar no hace nada.
--
-- Jerarquía:  marcas → modelos → modelos_anios → especificaciones ← tipos_carrocerias
-- =============================================================================

create table if not exists public.marcas (
  id serial not null,
  marca character varying not null,
  constraint marcas_pkey primary key (id)
);

create table if not exists public.modelos (
  id serial not null,
  id_marca integer not null,
  modelo character varying not null,
  constraint modelos_pkey primary key (id),
  constraint modelos_id_marca_fkey foreign key (id_marca) references public.marcas (id)
);

create table if not exists public.modelos_anios (
  id serial not null,
  id_modelo integer not null,
  anio integer not null,
  constraint modelos_anios_pkey primary key (id),
  constraint modelos_anios_id_modelo_fkey foreign key (id_modelo) references public.modelos (id)
);

create table if not exists public.tipos_carrocerias (
  id serial not null,
  carroceria character varying not null,
  constraint tipos_carrocerias_pkey primary key (id),
  constraint tipos_carrocerias_carroceria_key unique (carroceria)
);

create table if not exists public.especificaciones (
  id serial not null,
  id_modelo_anio integer not null,
  id_tipo_carroceria integer not null,
  motor_tamanio_cc character varying not null,
  motor_numero_cilindros integer not null,
  motor_posicion_cilindros character varying not null,
  motor_numero character varying null,
  constraint especificaciones_pkey primary key (id),
  constraint especificaciones_id_modelo_anio_fkey foreign key (id_modelo_anio) references public.modelos_anios (id),
  constraint especificaciones_id_tipo_carroceria_fkey foreign key (id_tipo_carroceria) references public.tipos_carrocerias (id)
);
