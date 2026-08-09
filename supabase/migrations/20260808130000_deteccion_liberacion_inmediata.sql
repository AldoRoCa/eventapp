-- ============================================================================
-- Detección de "liberación inmediata" del dinero en Mercado Pago (Fases A+B)
-- ============================================================================
-- Contexto: los reembolsos (cancelar-evento, gestionar-solicitud,
-- resolver-reporte, eliminar-cuenta) salen del SALDO de la cuenta de MP del
-- anfitrión. El plazo de liberación lo elige él en su propia cuenta de MP
-- (al instante / 7 días / 30 días) y NO se puede forzar desde la API. Si está
-- en "al instante", puede retirar el dinero en cuanto vende y un reembolso
-- posterior falla por falta de saldo.
--
-- Estrategia (acordada 2026-08-08): en cada pago verificado contra la API de
-- MP se compara money_release_date vs date_approved y se registra lo
-- detectado.
--   FASE B (esta migración + confirmar-pago-mp + mp-webhook): solo OBSERVAR —
--   registrar y ver los datos reales, sin bloquear nada todavía.
--   FASE C (después de validar los datos): bloquear ventas de anfitriones con
--   liberación inmediata, pausar sus eventos y reembolsar al instante el
--   boleto que disparó la detección (ese dinero recién cobrado sigue ahí).
-- ============================================================================

-- Lo último detectado por anfitrión. Cada venta re-verifica: si el anfitrión
-- cambia su configuración de MP, la siguiente venta lo refleja sola.
-- (null = todavía no hay ninguna venta verificada de este anfitrión)
alter table public.mp_credenciales
  add column if not exists liberacion_inmediata boolean,
  add column if not exists liberacion_dias numeric,
  add column if not exists liberacion_verificada_en timestamptz;

-- Pausa de ventas por evento (la usará la Fase C; con default false esta
-- columna no cambia ningún comportamiento hoy). Ojo de diseño: la RLS de
-- UPDATE de eventos deja al anfitrión editar sus propias filas, así que
-- podría despausarse a sí mismo vía consola — por eso la fuente de verdad
-- del bloqueo en Fase C será mp_credenciales.liberacion_inmediata (tabla sin
-- políticas de cliente) y esta columna queda como informativa/de UI.
alter table public.eventos
  add column if not exists ventas_pausadas boolean not null default false,
  add column if not exists pausa_motivo text;

-- Motivo legible para el comprador cuando su boleto se rechaza/reembolsa
-- (la usará la Fase C al reembolsar el boleto que disparó una detección).
alter table public.boletos
  add column if not exists motivo_rechazo text;

-- Registro de incidentes de liberación (mismo patrón que fallos_reembolso:
-- las Edge Functions escriben con service_role, solo el admin lee/resuelve).
create table if not exists public.incidentes_liberacion (
  id                 uuid primary key default gen_random_uuid(),
  anfitrion_id       uuid not null,   -- anfitrión detectado
  evento_id          uuid,            -- evento de la venta que disparó la detección
  mp_payment_id      text,            -- pago de MP que la disparó
  tipo               text not null,   -- 'liberacion_inmediata' | 'dato_ilegible'
  liberacion_dias    numeric,         -- días entre aprobación y liberación del pago
  money_release_date text,            -- valores CRUDOS de la API de MP, para
  date_approved      text,            --   auditar su formato real en observación
  origen             text,            -- 'confirmar-pago-mp' | 'mp-webhook'
  detalle            text,
  resuelto           boolean not null default false,
  created_at         timestamptz not null default now()
);

-- Un incidente por pago y tipo: confirmar-pago-mp y mp-webhook pueden ver el
-- mismo pago (las dos rutas corren la detección); el upsert contra este
-- índice único evita duplicados.
create unique index if not exists incidentes_liberacion_pago_tipo_uniq
  on public.incidentes_liberacion (mp_payment_id, tipo);

create index if not exists incidentes_liberacion_pendientes_idx
  on public.incidentes_liberacion (resuelto, created_at desc);

alter table public.incidentes_liberacion enable row level security;

-- Solo el admin puede ver los incidentes.
drop policy if exists "Admin ve incidentes de liberacion" on public.incidentes_liberacion;
create policy "Admin ve incidentes de liberacion"
  on public.incidentes_liberacion
  for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true));

-- Solo el admin puede marcarlos como resueltos.
drop policy if exists "Admin resuelve incidentes de liberacion" on public.incidentes_liberacion;
create policy "Admin resuelve incidentes de liberacion"
  on public.incidentes_liberacion
  for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true));

-- Nota: las Edge Functions insertan con service_role, que ignora la RLS —
-- no hace falta política de INSERT.
