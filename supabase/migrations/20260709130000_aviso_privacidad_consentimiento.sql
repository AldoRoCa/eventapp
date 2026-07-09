-- ============================================================================
-- Consentimiento del Aviso de Privacidad en el registro de anfitrión
-- ============================================================================
-- Mínimo higiénico LFPDPPP antes de empezar a recibir identificaciones
-- oficiales (INE) — dato personal sensible que exige consentimiento expreso.
--
-- El registro de anfitrión (src/pages/SerAnfitrion.jsx) ahora obliga a marcar
-- una casilla "He leído y acepto el Aviso de Privacidad..." antes de subir el
-- INE. Al enviar la solicitud, el cliente setea esta columna con la fecha/hora
-- del consentimiento, dejando constancia de CUÁNDO el anfitrión lo otorgó.
--
-- Nota: es un timestamp de auditoría, no un flag booleano — así queda registro
-- del momento exacto del consentimiento (útil ante una solicitud ARCO o una
-- revisión legal). NULL = nunca aceptó (perfiles previos a este cambio).
-- ============================================================================

alter table public.profiles
  add column if not exists aviso_privacidad_aceptado_en timestamptz;

comment on column public.profiles.aviso_privacidad_aceptado_en is
  'Fecha/hora en que el usuario aceptó el Aviso de Privacidad al registrarse como anfitrión (consentimiento expreso para el tratamiento del INE, dato sensible). NULL si nunca lo aceptó.';
