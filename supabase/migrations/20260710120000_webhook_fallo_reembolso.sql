-- ============================================================================
-- Database Webhook: avisar por correo cuando falla un reembolso
-- ============================================================================
-- Dispara la Edge Function avisar-fallo-reembolso en cada INSERT a
-- fallos_reembolso, para mandar un correo de alerta en el momento (en vez de
-- depender de que alguien revise el panel de Admin).
--
-- Se hace con un trigger que llama a supabase_functions.http_request (el mismo
-- mecanismo de los "Database Webhooks" del dashboard, basado en pg_net). Así
-- NO hay que tocar ninguna de las 4 funciones de reembolso que manejan dinero.
--
-- ANTES DE CORRER: reemplaza REEMPLAZA_CON_TU_SECRETO por el mismo valor que
-- vas a poner en el secret ALERTA_WEBHOOK_SECRET de Supabase (la función lo
-- compara con el header x-alerta-secret y rechaza cualquier llamada sin él).
-- La URL ya apunta a tu proyecto (jvjngaxpqdeababfxecp).
-- ============================================================================

drop trigger if exists avisar_fallo_reembolso_webhook on public.fallos_reembolso;

create trigger avisar_fallo_reembolso_webhook
  after insert on public.fallos_reembolso
  for each row
  execute function supabase_functions.http_request(
    'https://jvjngaxpqdeababfxecp.supabase.co/functions/v1/avisar-fallo-reembolso',
    'POST',
    '{"Content-Type":"application/json","x-alerta-secret":"REEMPLAZA_CON_TU_SECRETO"}',
    '{}',
    '5000'
  );
