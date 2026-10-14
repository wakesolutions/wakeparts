-- 0029 · Pleno: el dominio propio es bajo petición a soporte
--
-- Qué hace: cambia el renglón «Catálogo web con dominio propio» del plan Pleno
-- por «Catálogo web con dominio propio, bajo petición a soporte».
--
-- Por qué: decisión del usuario (2026-10-14). El dominio propio por taller no
-- es automático: se configura a pedido para negocios grandes que contratan
-- Pleno (y, si hace falta, con una copia dedicada del proyecto; la política
-- de esa copia está pendiente).
--
-- Datos: solo reemplaza ese renglón y conserva el orden y el resto. Si el texto
-- nuevo ya está, no hace nada (idempotente). La portada lo muestra en ≤ 10 min
-- (caché `planes`).
--
-- ESTADO: PENDIENTE (entregada 2026-10-14)

begin;

update public.planes p
   set caracteristicas = (
         select array_agg(case when x = 'Catálogo web con dominio propio'
                               then 'Catálogo web con dominio propio, bajo petición a soporte' else x end
                          order by o)
           from unnest(p.caracteristicas) with ordinality as t(x, o)
       )
 where p.codigo = 'pleno'
   and 'Catálogo web con dominio propio' = any (p.caracteristicas);

commit;
