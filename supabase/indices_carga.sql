-- Índices para aguantar carga concurrente. Correr una sola vez en el
-- SQL Editor de Supabase (es seguro repetirlos: "if not exists").
-- Postgres NO crea índices automáticos para foreign keys — sin esto,
-- cada conteo de asistentes recorre la tabla completa de boletos.

-- Conteo de asistentes por evento (home, explorar, página de evento)
create index if not exists boletos_evento_estado_idx
  on public.boletos (evento_id, estado);

-- Boletos de un usuario (Mis Boletos, límite por persona en Evento)
create index if not exists boletos_usuario_evento_idx
  on public.boletos (usuario_id, evento_id);

-- Búsqueda por pago en reembolsos (cancelar-evento, gestionar-solicitud)
create index if not exists boletos_mp_payment_idx
  on public.boletos (mp_payment_id)
  where mp_payment_id is not null;

-- Home/Explorar filtran y ordenan por fecha
create index if not exists eventos_fecha_idx
  on public.eventos (fecha);

-- Panel de Anfitrión lista eventos por dueño
create index if not exists eventos_anfitrion_idx
  on public.eventos (anfitrion_id);

-- Rate limiting: cada Edge Function cuenta filas por usuario+endpoint+hora
create index if not exists rate_limits_lookup_idx
  on public.rate_limits (identifier, endpoint, window_start);
