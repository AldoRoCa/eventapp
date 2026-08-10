-- ============================================================================
-- Interruptor de tres modos para el sistema de liberación de MP
-- ============================================================================
-- El sistema de liberación (detectar cuentas de MP en "al instante", pausar
-- ventas, reembolsar el pago detector y exigir el paso 2 de la conexión)
-- protege los reembolsos, pero le mete fricción real al anfitrión: tiene que
-- configurar sus plazos en 14 días, o sea esperar 14 días por su dinero.
--
-- Para un anfitrión estudiante con montos de cientos de pesos, esa fricción
-- puede costar más adopción de lo que protege. Este interruptor permite
-- graduarla sin desmontar nada:
--
--   estricto → detecta, avisa, PAUSA ventas, reembolsa el pago detector y
--              exige el paso 2 para poder cobrar. (Comportamiento actual.)
--   avisar   → detecta y avisa, pero NO pausa, NO reembolsa y NO exige el
--              paso 2. Cero fricción, pero se conserva la visibilidad: el
--              admin sigue viendo en su panel qué anfitriones están en riesgo.
--   apagado  → el sistema no hace nada.
--
-- Arranca en 'estricto' para no cambiar el comportamiento ya probado; el
-- cambio de modo es un clic en el panel de Admin.
--
-- Nota: cambiar de modo NO despausa a quien ya estaba pausado (eso sigue
-- siendo explícito, con el botón "Desbloquear anfitrión"), y `ventas_pausadas`
-- se respeta en todos los modos.
-- ============================================================================

create table if not exists public.ajustes_plataforma (
  clave           text primary key,
  valor           text not null,
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid
);

insert into public.ajustes_plataforma (clave, valor)
values ('modo_liberacion', 'estricto')
on conflict (clave) do nothing;

alter table public.ajustes_plataforma enable row level security;

-- Cualquier usuario autenticado puede LEER los ajustes: el Panel de Anfitrión
-- y Crear evento necesitan saber si el paso 2 es obligatorio. No hay nada
-- sensible aquí (es una bandera de política, no un secreto).
drop policy if exists "Usuarios leen ajustes" on public.ajustes_plataforma;
create policy "Usuarios leen ajustes"
  on public.ajustes_plataforma
  for select
  to authenticated
  using (true);

-- Solo el admin puede cambiarlos.
drop policy if exists "Admin cambia ajustes" on public.ajustes_plataforma;
create policy "Admin cambia ajustes"
  on public.ajustes_plataforma
  for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.es_admin = true));
