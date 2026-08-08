-- ============================================================================
-- handle_new_user: soportar registro con Google (OAuth) además de correo
-- ============================================================================
-- El disparador `on_auth_user_created` sobre auth.users crea la fila de
-- public.profiles cuando alguien se registra. Hasta ahora leía SOLO las
-- etiquetas que manda nuestro formulario de registro por correo:
--
--     raw_user_meta_data->>'nombre'
--     raw_user_meta_data->>'nombre_real'
--
-- Google manda las suyas, con otros nombres: `full_name`, `name` y `picture`
-- (algunas versiones también mandan `avatar_url`). Resultado: un usuario que
-- entrara con Google quedaba con `nombre` y `nombre_real` en NULL aunque
-- Google sí nos hubiera dado el dato.
--
-- Esta versión lee ambos orígenes por orden de preferencia (coalesce):
--   1. lo que manda nuestro formulario (si existe, gana — es lo que el
--      usuario escribió a propósito),
--   2. lo que manda Google,
--   3. para `nombre`, la parte del correo antes de la @ como último recurso,
--      para que nadie quede literalmente sin nombre visible.
--
-- `nullif(..., '')` es importante: si el campo llega presente pero vacío,
-- coalesce lo tomaría como válido y se comería las opciones siguientes.
--
-- Cambios menores adicionales:
--   * Se rellena `avatar_url` con la foto de Google. La foto del registro por
--     correo NO pasa por aquí (la sube la Edge Function guardar-avatar-registro
--     después), así que no hay conflicto: en ese flujo estas etiquetas no
--     existen y la columna queda NULL como siempre.
--   * `on conflict (id) do nothing` para que el disparador sea idempotente y
--     nunca pueda tumbar un alta por un choque de llave primaria.
--   * `set search_path = public`: endurecimiento estándar para funciones
--     SECURITY DEFINER (evita que un search_path manipulado redirija las
--     tablas a las que apunta la función). Las referencias ya venían
--     calificadas con el esquema, así que no cambia el comportamiento.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.profiles (id, nombre, email, nombre_real, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data->>'nombre_real', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', '')
    ),
    coalesce(
      nullif(new.raw_user_meta_data->>'avatar_url', ''),
      nullif(new.raw_user_meta_data->>'picture', '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

comment on function public.handle_new_user() is
  'Crea public.profiles al registrarse un usuario. Lee los datos del formulario de correo (nombre/nombre_real) y, si no vienen, los de Google OAuth (full_name/name/picture).';
