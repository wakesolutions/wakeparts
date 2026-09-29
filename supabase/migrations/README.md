# Migraciones · Wake Parts

Cada cambio de base de datos vive aquí como un `.sql` numerado. Se ejecutan **a mano, en orden**, desde el SQL Editor de Supabase.

## Reglas

1. **Nombre**: `NNNN_descripcion_corta.sql` (`0002_empresas.sql`).
2. **Encabezado**: qué hace, por qué, y `ESTADO: PENDIENTE` / `YA APLICADA`.
3. **Idempotente**: ejecutarla dos veces deja la base igual que ejecutarla una. Sin excepciones.
4. **Atómica**: todo entre `begin;` y `commit;`.
5. **Inmutable una vez aplicada**: los cambios van en una migración nueva.
6. **Datos antes que esquema**: si toca datos existentes, primero analizá los datos reales. Si elimina filas, respaldalas en el esquema `respaldo` (tabla `<tabla>_<NNNN>`).
7. **Probada**: en PGlite con una copia de los datos, ejecutada dos veces (ver «Cómo probar»).
8. Al terminar: actualizar `docs/database.md`, esta tabla de registro y `docs/bitacora.md` si hubo decisiones.

## Plantillas idempotentes

```sql
-- Tablas, columnas, índices
create table if not exists public.x (...);
alter table public.x add column if not exists y text;
alter table public.x drop column if exists y;
create index if not exists x_y_idx on public.x (y);
create unique index if not exists x_y_key on public.x (y);

-- Funciones, triggers, vistas
create or replace function public.f() ... set search_path = '' ...;
create or replace trigger t before insert on public.x for each row execute function public.f();
create or replace view public.v as ...;

-- Restricciones (no tienen "if not exists")
do $$ begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.x'::regclass and conname = 'x_y_check') then
    alter table public.x add constraint x_y_check check (y <> '');
  end if;
end $$;

-- Políticas RLS
alter table public.x enable row level security;  -- ya es idempotente
drop policy if exists x_lectura on public.x;
create policy x_lectura on public.x for select to authenticated using (...);

-- Tipos enum
do $$ begin
  create type public.estado_x as enum ('a', 'b');
exception when duplicate_object then null;
end $$;
alter type public.estado_x add value if not exists 'c';

-- Datos semilla
insert into public.x (codigo, nombre) values ('A', 'Uno')
on conflict (codigo) do nothing;

-- Correcciones de datos: condicionadas al valor erróneo
update public.x set y = 'bueno' where id = 10 and y = 'malo';
```

## Cómo probar

Con Node y [PGlite](https://pglite.dev) (Postgres en WASM), en una carpeta temporal:

1. Crear los roles `anon`, `authenticated`, `service_role`. Desde `0004`: esquema `extensions` (con `grant usage` a `anon` y `authenticated`, como en Supabase), extensiones `pg_trgm` y `unaccent` de PGlite (`@electric-sql/pglite/contrib/*`) y un esquema `storage` mínimo (`buckets`, `objects` con RLS).
2. Ejecutar todas las migraciones anteriores.
3. Cargar una copia de los datos reales (REST con `SUPABASE_SECRET_KEY`, paginando de 1 000 en 1 000) y ajustar las secuencias con `setval`.
4. Ejecutar la migración nueva **dos veces** y comparar conteos: la segunda vez no debe cambiar nada.

## Registro

| # | Archivo | Qué hace | Estado |
|---|---------|----------|--------|
| 0000 | `0000_baseline_catalogo_vehiculos.sql` | Catálogo de vehículos existente (marcas, modelos, años, carrocerías, especificaciones) | Ya aplicada |
| 0001 | `0001_integridad_catalogo_vehiculos.sql` | Limpia y consolida duplicados, `motor_cc`, unique/checks, triggers de normalización, RLS de lectura pública | Ya aplicada |
| 0002 | `0002_empresas_usuarios_roles.sql` | Empresas, usuarios (sincronizados con auth), roles, membresías, preferencias de tablas, `crear_empresa()`, helpers de RLS, vistas `v_*` del catálogo, escritura del catálogo para admin de plataforma | Ya aplicada |
| 0003 | `0003_usuarios_invitaciones_perfil.sql` | Invitaciones por correo + `aceptar_invitaciones()`, edición de roles con reglas (trigger), perfil editable (nombre, teléfono), normalización de empresas, vistas `v_miembros` y `v_invitaciones` | Ya aplicada |
| 0004 | `0004_productos_categorias_compatibilidad.sql` | `pg_trgm` + `unaccent`; árbol de categorías (semilla de 186) con sinónimos y categorías relacionadas; marcas de repuestos (globales + propias); productos con utilidad/margen calculados; kardex automático; fotos en Storage (bucket `productos`); compatibilidad producto ↔ vehículo; `buscar_productos()` y `buscar_vehiculos()` | Ya aplicada |
| 0005 | `0005_ventas_carritos_cotizaciones_facturas.sql` | Clientes, CAI, carritos y líneas, documentos (cotizaciones y facturas), `emitir_documento()`, `anular_documento()`, `carrito_desde_documento()`, tope de descuento de vendedores | Ya aplicada |
| 0006 | `0006_busqueda_complementos.sql` | `buscar_productos()`: complementos solo de las categorías de los 4 primeros resultados y de subcategorías nombradas en el texto; máximo 6 | **Pendiente** |
| 0007 | `0007_datos_demo.sql` | `cargar_datos_demo(empresa)`: 45 productos, compatibilidades y 3 clientes de ejemplo (botón en Taller; dueño/admin; idempotente; sin CAI) | **Pendiente** |
