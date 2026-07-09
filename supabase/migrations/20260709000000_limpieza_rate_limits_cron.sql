-- ============================================================================
-- Limpieza periódica de rate_limits
-- ============================================================================
-- Cada llamada a una Edge Function inserta una fila en rate_limits y nunca se
-- borra, así que la tabla crece sin límite y los conteos de rate limiting se
-- vuelven más lentos con el tiempo. Ninguna función consulta una ventana mayor
-- a 1 hora (todas usan `window_start >= now() - interval '1 hour'`), así que
-- las filas más viejas que eso ya no sirven para nada.
--
-- Este job borra esas filas cada hora (al minuto 0).
-- ============================================================================

-- pg_cron ya debería estar habilitado (se usó para limpiar-pendiente-pago).
-- 'if not exists' lo hace seguro de repetir. Si diera error de permisos,
-- habilitarlo desde el dashboard: Database → Extensions → pg_cron.
create extension if not exists pg_cron;

create or replace function public.limpiar_rate_limits_viejos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrados integer;
begin
  delete from public.rate_limits
  where window_start < now() - interval '1 hour';
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;

-- Programar cada hora (minuto 0). Volver a correr este select es seguro: si
-- el job ya existe con ese nombre, cron.schedule lo actualiza en vez de
-- duplicarlo.
select cron.schedule(
  'limpiar-rate-limits',
  '0 * * * *',
  $$ select public.limpiar_rate_limits_viejos() $$
);
