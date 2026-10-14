# Guía de operación · Wake Parts

Qué hacer para que el servicio siga funcionando y qué hacer cuando algo falla. Está escrita para que **otra persona de confianza** pueda atender una emergencia si el responsable no está. No contiene secretos: los valores están en el gestor de contraseñas y en Vercel.

## 1. Lo que corre solo

| Qué | Dónde | Cada cuánto | Si falla |
|---|---|---|---|
| `GET /api/cron/suscripciones` | cron-job.org, header `Authorization: Bearer <CRON_SECRET>` | **1 vez al día** (06:00 hora de Honduras) | Correos de prueba y de cobro sin enviar; las suscripciones vencidas no se sincronizan con n1co. El plan efectivo **no** depende de esto (`plan_de_empresa()` lo calcula al vuelo). |
| `GET /api/cron/limpieza` | cron-job.org, mismo header | **1 vez al día** (04:00) | El registro crece y se incumple el plazo que promete `/privacidad` (visitas 6 meses, el resto 2 años). |
| `GET /api/cron/alertas` | cron-job.org, mismo header | **Cada 15 minutos** | No llegan los correos de errores. |
| `GET /api/salud` | Monitor de disponibilidad (UptimeRobot, Better Stack o el mismo cron-job.org), **sin** header | **Cada 5 minutos** | No te enterás de una caída. |
| Respaldo diario de la base | Supabase (plan pago) | Diario, automático | Ver §4. |

En cron-job.org, en **cada** tarea: activá «Notify me when the job fails» (avisar si falla) y poné un tiempo de espera de 60 s. Si `/api/cron/alertas` empieza a fallar, la causa casi siempre es que la base o el correo no responden: eso mismo ya es la alarma.

Variables que tienen que estar en Vercel (Production): todas las de `docs/arquitectura.md` › Variables de entorno, en especial `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `N1CO_*`, `SMTP_*` y, si querés otro destinatario para las alertas, `ALERTAS_CORREO`. Después de cambiar una variable, **redeploy** (las variables no se aplican solas a lo que ya está desplegado).

Prueba rápida (desde la terminal, cambiando el secreto):

```bash
curl -s https://wakeparts.vercel.app/api/salud
```

```bash
curl -s -H "Authorization: Bearer TU_CRON_SECRET" https://wakeparts.vercel.app/api/cron/alertas
```

`{"ok":true,"nuevos":0}` = funciona y no hubo errores nuevos.

## 2. Primeros 5 minutos ante cualquier problema

1. **¿Está caído para todos?** Abrí `/api/salud`. `503` = la base no responde; nada o error de Vercel = el sitio está caído.
2. **Mirá las páginas de estado**: status.supabase.com, vercel-status.com y el estado de n1co (si es un cobro).
3. **¿Fue un despliegue?** En Vercel › Deployments, si el problema empezó con el último, usá **Instant Rollback** al anterior. Es inmediato y no toca la base.
4. **Revisá el módulo Actividad** (admin de plataforma ve todo): filtrá por nivel «error» y por la hora en que empezó.
5. **Avisá a los talleres afectados** por WhatsApp si dura más de 15 minutos: qué pasa, que sus datos están bien y cuándo volvés a escribir. Es mejor avisar de más.

## 3. Situaciones conocidas

### El sitio no carga
- Vercel caído → no hay nada que hacer más que esperar y avisar.
- Error después de un deploy → Instant Rollback (§2.3) y después buscá el error en Vercel › Logs o en Actividad.
- Falta una variable (las rutas de cron responden 503) → agregala en Vercel y hacé redeploy.

### La base está lenta o caída
- Supabase › Reports: CPU, memoria y conexiones. Si está al tope, subí el tamaño de cómputo (Settings › Compute) mientras se investiga.
- Una migración que quedó a medias no deja cambios: todas van dentro de `begin; … commit;` y son idempotentes, así que se pueden volver a correr enteras.

### Cobros (n1co)
- **Un dueño pagó y su plan no se activó**:
  1. Pedile que entre a Suscripción y toque **«Verificar estado»** (sincroniza con el estado real).
  2. Si no se resuelve: Actividad, buscá `suscripcion.` con su correo. Fijate en el último `suscripcion.n1co` (qué respondió n1co) y si hay `continuacion_rechazada`.
  3. En el portal de n1co, buscá la suscripción por su correo. Si está activa y cobrada, el webhook la activa al reintentar; si tarda, el cron de suscripciones la sincroniza al día siguiente.
  4. Como último recurso, asigná el plan a mano desde el módulo **Planes** y anotá el porqué.
- **Cobro doble o cambio de plan sin cancelar el anterior**: Actividad muestra `cancelar_anterior_fallo` con el id. Cancelá esa suscripción en el portal de n1co y gestioná la devolución con n1co.
- **El banco pide verificar dos veces (3D Secure)**: el sistema no abre otra verificación a propósito. Revisalo con soporte de n1co antes de que el cliente pruebe de nuevo.
- **El webhook no llega**: confirmá en n1co que la URL sea `https://<dominio>/api/n1co/webhook?clave=<N1CO_WEBHOOK_SECRET>`. Un `401` en sus registros = la clave no coincide.

### Facturación de un taller
- **«No hay CAI vigente»**: el CAI se agotó o venció. El taller registra el nuevo CAI del SAR en Ventas › CAI (el sistema no puede emitir facturas sin CAI vigente, a propósito).
- **Factura con un error**: no se edita ni se borra (está bloqueado en la base). Se corrige con **anulación** o **nota de crédito**, según lo que corresponda fiscalmente.
- **Un número de factura «saltado»**: no debería pasar (el número se toma con bloqueo dentro de la misma transacción). Si alguien lo reporta, revisá en Actividad los cambios de `cai` y `documentos` de esa empresa a esa hora antes de responder.

### Correo
- Las alertas o los recordatorios no salen → probá el inicio de sesión de Zoho con la cuenta de `SMTP_USER`. Si Zoho cambió la contraseña de aplicación, actualizá `SMTP_PASSWORD` en Vercel y redeploy.

## 4. Respaldos y restauración

- **Base de datos**: Supabase (plan pago) guarda respaldos diarios; con PITR, a cualquier minuto. Están en Database › Backups.
- **Restaurar pisa el proyecto entero** (todas las empresas). Si el problema es de **un solo taller** (borró algo), no restaures todo: restaurá el respaldo en un **proyecto nuevo** de Supabase y copiá solo las filas de esa empresa (`id_empresa`) al proyecto real. Hacelo con calma y anotá en la bitácora qué copiaste.
- **Fotos y logos (Storage) no van en el respaldo de la base.** Una vez al mes, descargá los buckets `productos` y `empresas` (Storage › S3 Connection permite usar `rclone` o `aws s3 sync`) y guardalos fuera de Supabase.
- **Probá una restauración** una vez cada tres meses en un proyecto nuevo. Un respaldo que nunca se probó no se sabe si sirve.
- Cada taller puede bajar sus propios datos desde Taller › Datos › Exportar (Excel por tema).

## 5. Si se filtra un secreto

Cambialo en el proveedor, después en Vercel (y en `.env.local`) y hacé redeploy. Orden de urgencia:

| Secreto | Dónde se cambia | Qué arriesga si se filtra |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Supabase › Settings › API keys | **Todo**: salta RLS y lee o escribe cualquier empresa. Rotala de inmediato. |
| `N1CO_CLIENT_SECRET` | Portal de n1co | Crear o cancelar suscripciones a nombre de Wake Parts. |
| `SMTP_PASSWORD` | Zoho › contraseñas de aplicación | Mandar correos como `ventas@wake.solutions`. |
| `N1CO_WEBHOOK_SECRET` | Vercel + URL del webhook en n1co (las dos a la vez) | Poco: el webhook verifica todo contra n1co. |
| `CRON_SECRET` | Vercel + las tres tareas de cron-job.org | Poco: los cron son idempotentes. |
| Secreto de Google OAuth | Google Cloud Console + Supabase › Auth › Google | Hacerse pasar por la app en la pantalla de Google. |

## 6. Despliegues

1. `npx tsc --noEmit`, `npx eslint .` y `npx next build` sin errores.
2. Si hay migración: **primero** correrla en el SQL Editor y **después** desplegar el código (el código tolera la migración aplicada antes; al revés puede fallar).
3. Desplegá fuera del horario de mostrador (antes de las 7:00 o después de las 18:00).
4. Después: `/api/salud`, entrar al escritorio y emitir una cotización de prueba.
5. Si algo sale mal: Instant Rollback (§2.3).

## 7. Si el responsable no está

Lo mínimo que necesita la persona de respaldo (los accesos van en el gestor de contraseñas compartido, nunca en este repo):

- [ ] Acceso de miembro a **Vercel** (proyecto wakeparts) para hacer rollback y ver logs.
- [ ] Acceso a **Supabase** (proyecto de producción) con rol de desarrollador.
- [ ] Acceso a **cron-job.org** y al **monitor de disponibilidad**.
- [ ] Acceso de lectura al **portal de n1co**.
- [ ] El WhatsApp comercial o la lista de dueños de taller para avisar.
- [ ] Esta guía y `docs/arquitectura.md`.

Contactos de soporte (completar):

| Proveedor | Canal | Cuenta o referencia |
|---|---|---|
| n1co | | |
| Supabase | supabase.com/support (plan pago) | |
| Vercel | vercel.com/help | |
| Zoho Mail | | |

## 8. Soporte a los talleres

- Primero preguntá **qué pantalla, qué hora y qué usuario**. Con eso lo encontrás en Actividad.
- Nunca pidas la contraseña de Google de nadie: no hace falta para nada.
- Si un taller pide sus datos o la baja, la exportación está en Taller › Datos. La eliminación de la empresa se hace a mano en la base, conservando lo que la ley obligue (documentos fiscales). Anotalo en la bitácora.
