-- ============================================================================
-- Solicitudes que el anfitrión nunca respondió: cancelación y reembolso automático
-- ============================================================================
-- Hasta hoy, un boleto en estado "pendiente" (una solicitud esperando respuesta)
-- no lo tocaba NADIE. El único cron que limpiaba boletos era el de
-- "pendiente_pago" (pagos abandonados), y gestionar-solicitud no tiene ninguna
-- verificación de fecha.
--
-- Consecuencia real: si alguien pagaba una solicitud y el anfitrión no respondía,
-- el evento pasaba, el dinero se quedaba con el anfitrión y el comprador nunca
-- entró (hacer-checkin exige estado "activo", así que en la puerta lo habrían
-- rechazado). La solicitud quedaba viva indefinidamente, y a los 180 días MP ya
-- no permite reembolsarla ni a mano.
--
-- Decisión explícita del usuario (2026-08-10), sabiendo que esto mueve dinero de
-- la cuenta del anfitrión sin preguntarle primero: es dinero de alguien que no
-- entró al evento, así que se devuelve solo. "Por respeto."
--
-- La Edge Function reembolsar-solicitudes-vencidas hace el trabajo; esta
-- migración solo la programa. Si un reembolso falla, la función NO marca el
-- boleto y deja el caso en fallos_reembolso, que ya dispara la alerta de
-- Telegram/correo y entra al reintento automático cada 8 horas.
--
-- ANTES DE CORRER: reemplaza REEMPLAZA_CON_TU_SECRETO por el MISMO valor del
-- secret ALERTA_WEBHOOK_SECRET (el que ya usan los otros triggers y crons). Si
-- se perdió, se recupera con:
--   select prosrc from pg_proc where proname = 'notificar_fallo_reembolso';
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.disparar_solicitudes_vencidas()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo molestar a la función si hay al menos una solicitud pendiente cuyo
  -- evento ya terminó (misma regla que eventoUtils.eventoFinalizado, más 2
  -- horas de gracia). El filtro fino lo repite la función; este es para no
  -- gastar invocaciones cuando no hay nada que hacer.
  if not exists (
    select 1
    from public.boletos b
    join public.eventos e on e.id = b.evento_id
    where b.estado = 'pendiente'
      and e.fecha + (coalesce(e.duracion_horas, 5) || ' hours')::interval + interval '2 hours' <= now()
  ) then
    return;
  end if;

  perform net.http_post(
    url := 'https://jvjngaxpqdeababfxecp.supabase.co/functions/v1/reembolsar-solicitudes-vencidas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alerta-secret', 'REEMPLAZA_CON_TU_SECRETO'
    ),
    body := '{}'::jsonb
  );
end;
$$;

-- Cada hora. Repetir este select es seguro: cron.schedule actualiza el job si
-- ya existe con ese nombre.
select cron.schedule(
  'reembolsar-solicitudes-vencidas',
  '7 * * * *',
  $$ select public.disparar_solicitudes_vencidas() $$
);

-- Índice de apoyo: la consulta de arriba corre cada hora y filtra boletos por
-- estado. Los boletos pendientes son pocos, pero el índice parcial la hace
-- gratis sin costar nada en las escrituras de los demás estados.
create index if not exists boletos_pendientes_idx
  on public.boletos (evento_id)
  where estado = 'pendiente';
