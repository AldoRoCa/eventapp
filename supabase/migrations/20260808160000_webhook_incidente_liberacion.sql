-- ============================================================================
-- Alerta Telegram + correo cuando el detector registra un incidente
-- ============================================================================
-- Llama a la Edge Function avisar-incidente-liberacion en cada INSERT a
-- incidentes_liberacion (liberación inmediata detectada o dato ilegible),
-- para avisar al admin al celular en el momento y que pueda contactar al
-- anfitrión por WhatsApp sin depender de revisar el panel.
--
-- Mismo patrón que 20260710120000 (fallos_reembolso): pg_net directo
-- (net.http_post), fire-and-forget, sin tocar el detector.
--
-- ANTES DE CORRER: reemplaza REEMPLAZA_CON_TU_SECRETO por el MISMO valor del
-- secret ALERTA_WEBHOOK_SECRET de Supabase (el que ya usa el trigger de
-- fallos_reembolso — es el mismo secreto compartido para las dos alertas).
-- ============================================================================

create extension if not exists pg_net;

create or replace function public.notificar_incidente_liberacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://jvjngaxpqdeababfxecp.supabase.co/functions/v1/avisar-incidente-liberacion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alerta-secret', 'REEMPLAZA_CON_TU_SECRETO'
    ),
    body := jsonb_build_object('type', 'INSERT', 'record', row_to_json(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists avisar_incidente_liberacion_webhook on public.incidentes_liberacion;

create trigger avisar_incidente_liberacion_webhook
  after insert on public.incidentes_liberacion
  for each row
  execute function public.notificar_incidente_liberacion();
