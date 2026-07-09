-- ============================================================================
-- Registro de reembolsos fallidos (observabilidad)
-- ============================================================================
-- Cuando un reembolso a Mercado Pago falla (p. ej. saldo insuficiente en la
-- cuenta del anfitrión), las Edge Functions lo rechazaban con un error al
-- usuario y un console.log que nadie ve. Esta tabla persiste esos fallos para
-- que el admin los vea en su panel y pueda darles seguimiento (contactar al
-- anfitrión, reintentar, etc.) en vez de que se pierdan en los logs.
--
-- Escriben aquí (con service_role): cancelar-evento, gestionar-solicitud,
-- resolver-reporte, eliminar-cuenta. Lee/actualiza: solo el admin.
-- ============================================================================

create table if not exists public.fallos_reembolso (
  id          uuid primary key default gen_random_uuid(),
  contexto    text not null,          -- que operación falló (cancelar-evento, etc.)
  usuario_id  uuid,                   -- quién disparó la acción (anfitrión/admin)
  evento_id   uuid,                   -- evento afectado, si aplica
  payment_ids text[],                 -- pagos de MP que no se pudieron reembolsar
  detalle     text,                   -- mensaje legible del fallo
  resuelto    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists fallos_reembolso_pendientes_idx
  on public.fallos_reembolso (resuelto, created_at desc);

alter table public.fallos_reembolso enable row level security;

-- Solo el admin puede leer los fallos.
drop policy if exists "Admin ve fallos de reembolso" on public.fallos_reembolso;
create policy "Admin ve fallos de reembolso"
  on public.fallos_reembolso
  for select
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true));

-- Solo el admin puede marcarlos como resueltos.
drop policy if exists "Admin resuelve fallos de reembolso" on public.fallos_reembolso;
create policy "Admin resuelve fallos de reembolso"
  on public.fallos_reembolso
  for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true));

-- Nota: las Edge Functions insertan con service_role, que ignora la RLS —
-- por eso no hace falta una política de INSERT.
