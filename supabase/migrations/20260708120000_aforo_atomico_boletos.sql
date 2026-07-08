-- ============================================================================
-- FIX 2 — Aforo atómico del lado del servidor (anti-sobreventa)
-- ============================================================================
-- Antes, el aforo y el límite de boletos por persona se validaban SOLO en el
-- cliente (Evento.jsx). Como los boletos se insertan directo desde el
-- navegador, dos (o doscientos) compradores concurrentes podían leer el mismo
-- "aforo disponible" antes de que ninguno confirmara, y todos pasar la
-- validación → se vendía de más.
--
-- Este trigger BEFORE INSERT mueve la autoridad a la base de datos. Se dispara
-- en TODA inserción de boleto (evento gratis, pago pendiente, solicitud), sin
-- depender de que el cliente coopere, y usa un bloqueo de fila (FOR UPDATE)
-- sobre el evento para serializar las compras concurrentes del MISMO evento —
-- eso es lo que hace imposible la sobreventa.
--
-- Estados que "ocupan lugar" (decisión del proyecto, 2026-07-08):
--   activo         → boleto confirmado.
--   pendiente      → solicitud por aprobar (ya reservó su lugar).
--   pendiente_pago → pago en proceso (reserva su lugar para que varias compras
--                    de pago "en vuelo" no revienten el aforo al activarse).
-- 'rechazado' NO ocupa lugar (libera el espacio).
--
-- Nota: los pendiente_pago abandonados retienen un lugar hasta limpiarse. Ver
-- la función de limpieza al final de este archivo (pensada para pg_cron).
-- ============================================================================

create or replace function public.verificar_aforo_boleto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacidad       integer;
  v_limite_persona  integer;
  v_ocupados        integer;
  v_del_usuario     integer;
  estados_ocupa     text[] := array['activo', 'pendiente', 'pendiente_pago'];
begin
  -- Bloquear la fila del evento para serializar compras concurrentes del
  -- mismo evento. Sin este FOR UPDATE, dos transacciones simultáneas pueden
  -- contar el mismo aforo y ambas insertar (la causa raíz de la sobreventa).
  -- El default del límite por persona (5) es el mismo que usa el cliente.
  select capacidad, coalesce(nullif(max_boletos_por_persona, 0), 5)
    into v_capacidad, v_limite_persona
  from public.eventos
  where id = new.evento_id
  for update;

  if not found then
    raise exception 'EVENTO_INEXISTENTE: el evento no existe';
  end if;

  -- Conteo de aforo. Las filas ya insertadas en este mismo statement (compra
  -- de varios boletos de un jalón) ya son visibles aquí, así que el conteo es
  -- correcto boleto por boleto dentro de la misma transacción.
  select count(*) into v_ocupados
  from public.boletos
  where evento_id = new.evento_id
    and estado = any(estados_ocupa);

  if v_ocupados >= v_capacidad then
    raise exception 'AFORO_LLENO: el evento ya no tiene lugares disponibles';
  end if;

  -- Límite de boletos por persona.
  select count(*) into v_del_usuario
  from public.boletos
  where evento_id = new.evento_id
    and usuario_id = new.usuario_id
    and estado = any(estados_ocupa);

  if v_del_usuario >= v_limite_persona then
    raise exception 'LIMITE_PERSONA: alcanzaste el maximo de boletos por persona para este evento';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_verificar_aforo on public.boletos;
create trigger trg_verificar_aforo
  before insert on public.boletos
  for each row
  execute function public.verificar_aforo_boleto();

-- ============================================================================
-- Limpieza de reservas de pago abandonadas.
-- ============================================================================
-- Un pendiente_pago se crea justo antes de mandar al comprador a Mercado Pago.
-- Si nunca completa el pago (cierra la pestaña, etc.), esa fila retiene un
-- lugar del aforo indefinidamente. Esta función borra los pendiente_pago con
-- más de 1 hora — tiempo de sobra para cualquier checkout real de MP.
--
-- Programarla con pg_cron (en el SQL Editor, una sola vez):
--   select cron.schedule('limpiar-pendiente-pago', '*/15 * * * *',
--                        $$ select public.limpiar_pendiente_pago_viejos() $$);
create or replace function public.limpiar_pendiente_pago_viejos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_borrados integer;
begin
  delete from public.boletos
  where estado = 'pendiente_pago'
    and created_at < now() - interval '1 hour';
  get diagnostics v_borrados = row_count;
  return v_borrados;
end;
$$;
