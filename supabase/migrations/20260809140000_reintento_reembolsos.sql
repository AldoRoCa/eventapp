-- ============================================================================
-- Reintento automático de reembolsos fallidos
-- ============================================================================
-- Mercado Pago NO reintenta un reembolso que falló: la llamada devuelve error
-- (p. ej. saldo insuficiente en la cuenta del anfitrión) y ahí muere — no
-- queda encolado ni hay estado "pendiente". Si el dinero vuelve a entrar a esa
-- cuenta al día siguiente, nada intenta cobrarlo solo. De ahí este reintento.
--
-- OJO — límite duro de MP: un pago solo se puede reembolsar dentro de los
-- **180 días** de su aprobación. Pasado eso es imposible por API, aunque haya
-- saldo. Por eso el reintento avisa antes de que se venza y se rinde después.
--
-- Columnas nuevas en fallos_reembolso (la tabla ya existía):
--   intentos              → cuántas veces se reintentó
--   ultimo_intento_en     → cuándo fue el último
--   ultimo_error          → el error TEXTUAL de MP. Hasta ahora el `detalle`
--                           solo tenía una suposición ("¿saldo insuficiente?");
--                           el error real se perdía en los logs.
--   payment_ids_recuperados → los pagos de esa fila que ya se reembolsaron
--                           (una fila puede cubrir varios pagos y recuperarse
--                           de a poco)
--   incobrable            → se agotaron los 180 días, ya no se puede
--   ultimo_aviso_en       → para el resumen diario, y no mandar un Telegram
--                           en cada ciclo de reintento
-- ============================================================================

alter table public.fallos_reembolso
  add column if not exists intentos integer not null default 0,
  add column if not exists ultimo_intento_en timestamptz,
  add column if not exists ultimo_error text,
  add column if not exists payment_ids_recuperados text[] not null default '{}',
  add column if not exists incobrable boolean not null default false,
  add column if not exists ultimo_aviso_en timestamptz;

-- ============================================================================
-- Cron: llama a la Edge Function reintentar-reembolsos cada 8 horas
-- ============================================================================
-- Mismo patrón pg_net que las alertas (no usa el esquema supabase_functions,
-- que solo existe si se activan Database Webhooks desde el Dashboard).
--
-- ANTES DE CORRER: reemplaza REEMPLAZA_CON_TU_SECRETO por el MISMO valor del
-- secret ALERTA_WEBHOOK_SECRET (el que ya usan los otros dos triggers). Si se
-- perdió, se recupera con:
--   select prosrc from pg_proc where proname = 'notificar_fallo_reembolso';
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.disparar_reintento_reembolsos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo molestar a la función si hay algo que reintentar.
  if not exists (
    select 1 from public.fallos_reembolso
    where resuelto = false and incobrable = false
  ) then
    return;
  end if;

  perform net.http_post(
    url := 'https://jvjngaxpqdeababfxecp.supabase.co/functions/v1/reintentar-reembolsos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alerta-secret', 'REEMPLAZA_CON_TU_SECRETO'
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Cada 8 horas (00:00, 08:00 y 16:00 UTC). Repetir este select es seguro:
-- cron.schedule actualiza el job si ya existe con ese nombre.
select cron.schedule(
  'reintentar-reembolsos',
  '0 */8 * * *',
  $$ select public.disparar_reintento_reembolsos() $$
);
