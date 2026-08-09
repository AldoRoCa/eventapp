-- ============================================================================
-- Conexión con Mercado Pago en dos pasos
-- ============================================================================
-- Conectar la cuenta de MP (OAuth) ya no basta para poder cobrar: el anfitrión
-- debe además configurar sus plazos de liberación en 14 días (Checkout), que es
-- de lo que dependen los reembolsos (ver _shared/liberacion.ts).
--
-- La API de MP NO expone la configuración de plazos de una cuenta — no hay
-- forma de verificarla antes de la primera venta. Por eso el paso 2 es una
-- DECLARACIÓN del anfitrión (abrió el link y confirma que lo dejó bien), no una
-- verificación: sirve contra el olvido, que es el caso común. La verificación
-- real sigue siendo automática y ocurre en su primera venta, cuando el detector
-- compara money_release_date contra la API de MP y, si mintió, le pausa las
-- ventas y reembolsa ese boleto.
--
-- mp_config_confirmada_en   → cuándo declaró haber configurado sus plazos
-- mp_liberacion_verificada_en → cuándo una venta real confirmó que sí (lo
--                               escribe el detector con service_role; null
--                               significa "todavía sin verificar")
-- ============================================================================

alter table public.profiles
  add column if not exists mp_config_confirmada_en timestamptz,
  add column if not exists mp_liberacion_verificada_en timestamptz;

-- Anfitriones que YA tenían su cuenta conectada antes de este cambio: se dan
-- por buenos para no romperles el flujo (decisión explícita del admin —
-- hoy es un solo anfitrión conocido). Los nuevos sí pasan por los dos pasos.
update public.profiles
   set mp_config_confirmada_en = now()
 where mp_user_id is not null
   and mp_config_confirmada_en is null;
