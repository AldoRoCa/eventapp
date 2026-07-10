-- ============================================================================
-- Alerta por correo cuando falla un reembolso (trigger + pg_net)
-- ============================================================================
-- Llama a la Edge Function avisar-fallo-reembolso en cada INSERT a
-- fallos_reembolso, para mandar un correo de alerta en el momento (en vez de
-- depender de que alguien revise el panel de Admin).
--
-- Usa pg_net (net.http_post) directamente, NO el esquema supabase_functions
-- (ese solo existe si activas "Database Webhooks" desde el Dashboard; con
-- pg_net no hace falta). Así NO hay que tocar las 4 funciones de reembolso
-- que manejan dinero — el aviso vive por completo fuera de ellas.
--
-- La llamada es fire-and-forget: pg_net la encola y su worker la manda en
-- segundo plano, sin bloquear el INSERT del fallo.
--
-- ANTES DE CORRER: reemplaza REEMPLAZA_CON_TU_SECRETO por el mismo valor que
-- pusiste en el secret ALERTA_WEBHOOK_SECRET de Supabase (la función lo compara
-- con el header x-alerta-secret y rechaza cualquier llamada sin él). La URL ya
-- apunta a tu proyecto (jvjngaxpqdeababfxecp).
-- ============================================================================

create extension if not exists pg_net;

create or replace function public.notificar_fallo_reembolso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://jvjngaxpqdeababfxecp.supabase.co/functions/v1/avisar-fallo-reembolso',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alerta-secret', 'REEMPLAZA_CON_TU_SECRETO'
    ),
    -- La función espera { type: "INSERT", record: {...} } — mismo formato que
    -- mandaría un Database Webhook de Supabase.
    body := jsonb_build_object('type', 'INSERT', 'record', row_to_json(NEW))
  );
  return NEW;
end;
$$;

drop trigger if exists avisar_fallo_reembolso_webhook on public.fallos_reembolso;

create trigger avisar_fallo_reembolso_webhook
  after insert on public.fallos_reembolso
  for each row
  execute function public.notificar_fallo_reembolso();
