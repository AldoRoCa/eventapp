-- ============================================================================
-- Comisión escalonada de VELA + descuento por paquete
-- ============================================================================
-- Dos cambios que tocan dinero, más el prerrequisito del que dependen los dos.
--
-- 1) PRERREQUISITO — boletos.monto_pagado
--    Hasta hoy, gestionar-solicitud reembolsaba `precio × 1.10` calculado a
--    mano. Eso funcionaba mientras la comisión fuera 10% fijo y no existieran
--    descuentos; con escalones (0/5/8/10%) o con descuento por paquete, la
--    fórmula devolvería un monto DISTINTO al que se cobró, y la diferencia
--    saldría del bolsillo del anfitrión.
--
--    Ahora cada boleto guarda lo que realmente se pagó por él. El valor NO lo
--    escribe el navegador: lo escriben confirmar-pago-mp y mp-webhook con el
--    transaction_amount REAL del pago consultado a la API de Mercado Pago,
--    dividido entre los boletos que cubre ese pago (una compra de N boletos es
--    un solo pago). Es el mismo principio que ya usa _shared/montos.ts: lo que
--    hay que devolver es lo que se cobró, no lo que el precio diga hoy.
--
--    Sin backfill a propósito: un boleto viejo se queda en NULL y
--    gestionar-solicitud cae al respaldo `precio × 1.10`, que es exactamente
--    lo que sí se le cobró. Rellenarlo sería adivinar.
--
-- 2) COMISIÓN ESCALONADA — no necesita columnas.
--    Vive en el código (src/comisionUtils.js y supabase/functions/_shared/
--    comision.ts). Se documenta aquí porque explica el punto 1.
--
-- 3) DESCUENTO POR PAQUETE — eventos.descuento_porcentaje / descuento_min_boletos
--    "x% de descuento al comprar y boletos en la misma compra". Al anfitrión le
--    sale barato porque el cargo fijo de MP ($4 + IVA = $4.64) se cobra UNA vez
--    por compra, no por boleto: cada boleto extra en el mismo pago le ahorra
--    $4.64. Quien decide si el descuento aplica y por cuánto es crear-pago-mp,
--    leyendo ESTAS columnas — nunca lo que mande el navegador.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. boletos.monto_pagado
-- ----------------------------------------------------------------------------
alter table public.boletos
  add column if not exists monto_pagado numeric;

comment on column public.boletos.monto_pagado is
  'Lo que realmente se pagó por ESTE boleto (transaction_amount del pago de MP ÷ boletos del pago). Lo escriben confirmar-pago-mp y mp-webhook con service_role. NULL = boleto anterior a este cambio (o gratis sin pago); gestionar-solicitud cae al respaldo precio × 1.10.';

-- Defensa en profundidad: el navegador NUNCA debe poder sembrar el monto que
-- después se reembolsa. Hoy no puede hacer daño (el valor se sobrescribe al
-- confirmar el pago, y solo se reembolsan boletos con mp_payment_id, que
-- también lo pone el servidor), pero eso es una cadena de suerte, no un
-- candado. Aquí se vuelve candado.
--
-- El resto de la política es idéntica a la de 20260708130000: mismo dueño,
-- mismos estados permitidos por tipo de evento, misma ventana de tiempo.
drop policy if exists "Usuario compra boleto" on public.boletos;

create policy "Usuario compra boleto"
  on public.boletos
  for insert
  to public
  with check (
    auth.uid() = usuario_id
    and checkin_en is null
    and monto_pagado is null
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

-- ----------------------------------------------------------------------------
-- 2. eventos.descuento_porcentaje / eventos.descuento_min_boletos
-- ----------------------------------------------------------------------------
alter table public.eventos
  add column if not exists descuento_porcentaje smallint,
  add column if not exists descuento_min_boletos smallint;

comment on column public.eventos.descuento_porcentaje is
  'Descuento por paquete: % que se le baja al precio del boleto cuando la compra alcanza descuento_min_boletos. NULL = sin descuento. 100 = boletos gratis a partir de ese umbral.';
comment on column public.eventos.descuento_min_boletos is
  'Cuántos boletos hay que llevar EN LA MISMA COMPRA para que aplique descuento_porcentaje. Mínimo 2 (con 1 no sería un paquete, sería un precio más bajo).';

-- Los rangos se validan también en los dos formularios y, sobre todo, en
-- crear-pago-mp (que es donde vive el candado real de lo que se cobra). Estos
-- CHECK son la última red: impiden que una fila absurda entre a la base aunque
-- alguien escriba directo por la API.
alter table public.eventos drop constraint if exists eventos_descuento_porcentaje_valido;
alter table public.eventos add constraint eventos_descuento_porcentaje_valido
  check (descuento_porcentaje is null or (descuento_porcentaje >= 1 and descuento_porcentaje <= 100));

alter table public.eventos drop constraint if exists eventos_descuento_min_boletos_valido;
alter table public.eventos add constraint eventos_descuento_min_boletos_valido
  check (descuento_min_boletos is null or (descuento_min_boletos >= 2 and descuento_min_boletos <= 20));

-- Las dos columnas van juntas o no van: un porcentaje sin umbral (o al revés)
-- es una configuración a medias que el código tendría que adivinar.
alter table public.eventos drop constraint if exists eventos_descuento_completo;
alter table public.eventos add constraint eventos_descuento_completo
  check ((descuento_porcentaje is null) = (descuento_min_boletos is null));
