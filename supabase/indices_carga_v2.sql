-- ============================================================================
-- Índices de soporte v2 (2026-07-10) — correr UNA vez en el SQL Editor.
-- Complementan a indices_carga.sql (que ya corriste). Todos usan
-- "if not exists": es seguro repetirlos, no rompen nada si ya existieran.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) RECOMENDADO — reseñas por anfitrión.
-- Cada visita a la página de un evento (Evento.jsx) consulta las reseñas del
-- anfitrión filtrando por anfitrion_id. Sin índice, eso recorre toda la tabla
-- de reseñas en cada visita. Este es el hueco real detectado.
-- ----------------------------------------------------------------------------
create index if not exists resenas_anfitrion_idx
  on public.resenas (anfitrion_id);

-- ----------------------------------------------------------------------------
-- (2) OPCIONAL — reseñas por usuario.
-- "Mis Boletos" consulta las reseñas propias por usuario_id para saber qué
-- eventos ya calificó. Menos frecuente que la anterior, pero barato.
-- ----------------------------------------------------------------------------
create index if not exists resenas_usuario_idx
  on public.resenas (usuario_id);

-- ----------------------------------------------------------------------------
-- (3) OPCIONAL — limpieza de reservas de pago abandonadas.
-- El cron limpiar_pendiente_pago_viejos borra cada 15 min los pendiente_pago
-- con más de 1 hora. Índice parcial (solo indexa las filas pendiente_pago,
-- que son pocas) para que ese DELETE no haga seq scan de toda la tabla.
-- ----------------------------------------------------------------------------
create index if not exists boletos_pendiente_pago_limpieza_idx
  on public.boletos (created_at)
  where estado = 'pendiente_pago';

-- ----------------------------------------------------------------------------
-- (4) OPCIONAL — limpieza de rate_limits.
-- El cron limpiar_rate_limits_viejos borra cada hora las filas con
-- window_start > 1h. El índice existente (identifier, endpoint, window_start)
-- no sirve para filtrar solo por window_start (no es la primera columna).
-- ----------------------------------------------------------------------------
create index if not exists rate_limits_window_idx
  on public.rate_limits (window_start);

-- ============================================================================
-- LIMPIEZA DE ÍNDICES REDUNDANTES (2026-07-10)
-- ============================================================================
-- Al verificar los índices en producción aparecieron duplicados: unos índices
-- viejos "idx_*" (de una migración temprana o del dashboard) que apuntan a la
-- MISMA columna que los que agregó indices_carga.sql, o cuyo contenido ya está
-- cubierto por un índice compuesto (prefijo izquierdo). Un índice redundante no
-- acelera ninguna lectura extra, pero sí se actualiza en cada escritura — y
-- boletos es la tabla más caliente de inserción (una fila por boleto vendido).
-- Borrarlos baja el costo de escritura sin perder capacidad de consulta.
--
-- Reversible: sus definiciones originales quedaron registradas; si hicieran
-- falta se recrean. Borrar un índice es instantáneo y no bloquea la tabla.
--
--   idx_eventos_anfitrion_id   (anfitrion_id)          == eventos_anfitrion_idx
--   idx_eventos_fecha          (fecha)                 == eventos_fecha_idx
--   idx_boletos_evento_id      (evento_id)             ⊂ boletos_evento_estado_idx (evento_id, estado)
--   idx_boletos_usuario_id     (usuario_id)            ⊂ boletos_usuario_evento_idx (usuario_id, evento_id)
--   idx_rate_limits_identifier (identifier, endpoint)  ⊂ rate_limits_lookup_idx (identifier, endpoint, window_start)
--
-- Se CONSERVAN (no son duplicados): idx_boletos_codigo_grupo,
-- idx_boletos_nombre_normalizado (búsqueda de check-in por nombre, GIN trigram),
-- idx_eventos_categoria (filtro de categoría en Explorar).
-- ============================================================================
drop index if exists public.idx_eventos_anfitrion_id;
drop index if exists public.idx_eventos_fecha;
drop index if exists public.idx_boletos_evento_id;
drop index if exists public.idx_boletos_usuario_id;
drop index if exists public.idx_rate_limits_identifier;
