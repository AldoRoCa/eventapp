-- ============================================================================
-- FIX 3 — Cerrar el bypass de pago en el INSERT de boletos (RLS)
-- ============================================================================
-- La política anterior ("Usuario compra boleto") solo exigía que el boleto
-- fuera del propio usuario y que el evento no hubiera terminado — NO restringía
-- el 'estado'. Un usuario logueado podía, desde la consola del navegador,
-- insertar un boleto con estado='activo' para un evento DE PAGO y obtener un
-- boleto válido sin pagar (bypass de pago confirmado el 2026-07-08).
--
-- Regla nueva del WITH CHECK (el cliente solo puede crear estados que no
-- otorgan acceso pagado sin pago):
--   • Evento gratis  (precio = 0): puede crear 'activo' o 'pendiente'.
--   • Evento de pago (precio > 0): SOLO puede crear 'pendiente_pago' (la
--     reserva previa al pago). El paso a 'activo'/'pendiente' lo hacen
--     exclusivamente las Edge Functions con service_role (confirmar-pago-mp,
--     mp-webhook, gestionar-solicitud) tras verificar el pago real contra la
--     API de Mercado Pago. service_role ignora la RLS, así que esas funciones
--     no se ven afectadas por esta política.
--   • Además: no se puede insertar un boleto ya "checkeado" (checkin_en null).
--
-- Se conserva el guard de tiempo original (evento no terminado, ventana de 5h)
-- tal cual estaba, para no cambiar comportamiento ajeno a este fix.
-- ============================================================================

drop policy if exists "Usuario compra boleto" on public.boletos;

create policy "Usuario compra boleto"
  on public.boletos
  for insert
  to public
  with check (
    auth.uid() = usuario_id
    and checkin_en is null
    and exists (
      select 1
      from public.eventos e
      where e.id = boletos.evento_id
        and e.fecha > (now() - interval '5 hours')
        and (
          (coalesce(e.precio, 0) = 0 and boletos.estado in ('activo', 'pendiente'))
          or
          (coalesce(e.precio, 0) > 0 and boletos.estado = 'pendiente_pago')
        )
    )
  );
