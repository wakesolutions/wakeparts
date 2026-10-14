-- 0025 · Estado «procesando» en los intentos de pago (suscripciones_checkout)
--
-- Qué hace: recrea la restricción suscripciones_checkout_check con todos los
-- estados que usa la app: iniciado, autenticacion, procesando, exitoso, fallido.
--
-- Por qué: la base quedó con una versión vieja de la restricción, sin
-- «procesando» (0024 la crea solo «si no existe», así que una corrección del
-- archivo nunca llegó a la base). El candado que toma el intento antes de
-- cobrar tras el 3D Secure falla siempre con 23514 y ningún cobro con
-- verificación del banco llega a n1co.
--
-- Datos: ninguna fila usa hoy «procesando» (justamente no se podía); los
-- estados existentes siguen siendo válidos.
--
-- ESTADO: PENDIENTE

begin;

alter table public.suscripciones_checkout drop constraint if exists suscripciones_checkout_check;
alter table public.suscripciones_checkout add constraint suscripciones_checkout_check
  check (ciclo in ('mensual', 'anual') and estado in ('iniciado', 'autenticacion', 'procesando', 'exitoso', 'fallido'));

commit;
