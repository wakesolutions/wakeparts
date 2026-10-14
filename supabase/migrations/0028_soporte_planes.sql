-- 0028 · Soporte: «respondemos en menos de 1 día» en los planes
--
-- Qué hace: cambia el renglón de soporte de las características de Arranque,
-- Avance y Pleno (las que muestran la portada y el módulo Suscripción):
-- - Arranque: «Soporte por WhatsApp y correo: respondemos en menos de 1 día».
-- - Avance y Pleno: «Soporte prioritario: respondemos en menos de 1 día».
--
-- Por qué: decisión del usuario y su socio, con visto bueno del abogado
-- (2026-10-14): el soporte lo dan dos personas; no se promete horario
-- extendido ni 24/7.
--
-- Datos: solo reemplaza el renglón que empieza con «Soporte» y conserva el
-- orden y el resto (también si el admin los editó en el módulo Planes). Si el
-- texto nuevo ya está, no hace nada (idempotente). La portada lo muestra en
-- ≤ 10 min (caché `planes`).
--
-- ESTADO: YA APLICADA (confirmado 2026-10-14)

begin;

update public.planes p
   set caracteristicas = (
         select array_agg(case when x ilike 'soporte%' then n.texto else x end order by o)
           from unnest(p.caracteristicas) with ordinality as t(x, o)
       )
  from (values
    ('arranque', 'Soporte por WhatsApp y correo: respondemos en menos de 1 día'),
    ('avance', 'Soporte prioritario: respondemos en menos de 1 día'),
    ('pleno', 'Soporte prioritario: respondemos en menos de 1 día')
  ) as n (codigo, texto)
 where p.codigo = n.codigo
   and exists (select 1 from unnest(p.caracteristicas) x where x ilike 'soporte%')
   and not (n.texto = any (p.caracteristicas));

commit;
