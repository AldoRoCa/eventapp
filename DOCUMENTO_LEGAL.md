# Documento legal — VELA

**Fecha:** 3 de julio de 2026
**Preparado por:** Claude Code, a partir de una revisión del código y el contenido legal actual de la app (`Terminos.jsx`, `Privacidad.jsx`, `PoliticasSeguridad.jsx`).

> **Esto no es asesoría legal.** Es un resumen de lo que la app dice hacer, lo que realmente hace, y una lista de puntos que vale la pena confirmar con un abogado (idealmente uno con experiencia en comercio electrónico, protección de datos y medios de pago en México) antes de operar a mayor escala. Nada de esto sustituye esa revisión.

---

## 1. Qué es VELA, en términos legales

VELA es una plataforma digital (marketplace) que conecta organizadores de eventos ("anfitriones") con asistentes. Facilita:
- La publicación y descubrimiento de eventos.
- La venta de boletos, cobrando una comisión de servicio del 10% sobre el precio del boleto.
- El procesamiento de pagos a través de Mercado Pago (VELA nunca almacena datos de tarjetas).
- Herramientas operativas para el anfitrión: check-in de asistentes, gestión de solicitudes, reembolsos, y ahora, invitación de "cooperadores" sin cuenta para ayudar con el check-in.

El modelo de negocio (comisión sobre transacciones de terceros) la coloca como **intermediario de pagos y facilitador de comercio electrónico**, no como vendedora directa de los boletos — esa distinción es relevante para varias de las leyes mexicanas que le aplican.

---

## 2. Datos personales que se recopilan (y su base legal)

Conforme a la **Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)**, VELA recopila:

| Dato | De quién | Para qué |
|---|---|---|
| Nombre, correo, contraseña | Todo usuario registrado | Cuenta y autenticación |
| Foto de perfil (opcional) | Todo usuario registrado | Identidad visual dentro de la app |
| Teléfono, fecha de nacimiento, bio | Anfitriones | Verificación de mayoría de edad y contacto |
| Identificación oficial (INE/pasaporte) | Anfitriones | Verificación de identidad antes de aprobar la cuenta como anfitrión |
| Nombre de registro del boleto | Asistentes (puede ser distinto de quien compra) | Check-in en la entrada |
| Registro de check-in (hora de entrada) | Asistentes | Control de acceso al evento |
| Nombre de cooperadores de check-in | Personas invitadas sin cuenta | Trazabilidad de quién marcó cada entrada |
| Reseñas, calificaciones, comentarios | Asistentes que dejan reseña | Contenido público del evento/anfitrión |
| Reportes de eventos | Asistentes que reportan un problema | Resolución de disputas |

La política de privacidad ya declara los **derechos ARCO** (Acceso, Rectificación, Cancelación, Oposición) y un plazo de respuesta de 20 días hábiles, que es el estándar de la LFPDPPP.

---

## 3. Terceros con quienes se comparten datos

- **Mercado Pago** — procesa los pagos y transfiere fondos al anfitrión (menos la comisión de VELA).
- **Supabase Inc.** — proveedor de infraestructura (base de datos, almacenamiento de archivos, funciones backend). Al ser una empresa extranjera, esto implica una **transferencia internacional de datos**, que la LFPDPPP permite pero que idealmente debería mencionarse explícitamente en el aviso de privacidad (actualmente solo se nombra como proveedor de infraestructura, sin aclarar que los datos pueden procesarse fuera de México).

---

## 4. Seguridad de la información (medidas ya implementadas)

Esta sesión se dedicó en buena parte a cerrar huecos de seguridad concretos:
- El token privado de Mercado Pago del anfitrión ya no es legible por otros usuarios (antes lo era, por una política de base de datos demasiado permisiva).
- El bucket de identificaciones oficiales (`ine-docs`) era **público** — cualquiera con el link podía ver la identificación de un anfitrión sin autenticarse. Ya se corrigió: es privado, con acceso solo para el dueño del archivo o un administrador.
- Se cerraron huecos que permitían crear eventos suplantando a otro anfitrión, o borrar un evento evadiendo el proceso de reembolso.
- Las contraseñas y pagos ya estaban manejados correctamente (Supabase Auth y Mercado Pago, VELA nunca ve ni guarda datos de tarjeta).

---

## 5. Cooperadores de check-in (funcionalidad nueva — atención especial)

Esta es la parte más nueva y la que amerita más cuidado legal, porque introduce una figura sin precedente en el resto de la app: **una persona que ve datos de otros usuarios (nombres de asistentes) sin tener cuenta, sin verificación de identidad, y sin haber aceptado los Términos de Uso directamente.**

Ya se reflejó en Términos, Privacidad y Políticas de Seguridad que:
- El anfitrión es responsable de a quién le comparte el link.
- El cooperador solo ve lo mínimo necesario (nombre/código de boletos de ESE evento, nada de pagos).
- VELA no verifica la identidad del cooperador.

Esto es una compensación razonable dado el bajo riesgo de la función, pero vale la pena que un abogado confirme si, al mostrarle datos personales de un tercero (el asistente) a una persona sin cuenta y sin verificación, se necesita algo adicional — por ejemplo, que el anfitrión acepte explícitamente una cláusula de responsabilidad al generar el link (hoy no existe ese paso, solo el botón "Generar link").

---

## 6. Términos comerciales

- Comisión de servicio: 10% sobre el precio del boleto, mostrado de forma clara al comprador antes de pagar (cumple con el principio de transparencia de precios de la Ley Federal de Protección al Consumidor).
- Reembolsos garantizados si el anfitrión cancela el evento, o si un reporte de un asistente es resuelto a su favor.
- Boletos no transferibles fuera de la plataforma.

---

## Áreas de oportunidad, riesgos y cosas que vale la pena revisar

Esto es lo que me pediste al final — puntos concretos, en orden aproximado de importancia:

### 🔴 Formalización del negocio
No encontré ningún indicio en el código o los documentos de que VELA opere bajo una **persona moral constituida en México** (S.A.S., S. de R.L., etc.). Si vas a cobrar comisiones de forma continua, esto normalmente implica: dar de alta la empresa ante el SAT, emitir CFDI (facturas electrónicas) por la comisión del 10%, y declarar IVA/ISR correspondientes. Esto es probablemente lo más urgente de todo el documento — es una decisión de negocio antes que técnica, pero tiene consecuencias legales serias si se sigue operando sin esto y el volumen crece.

### 🔴 Relación formal con Mercado Pago como "marketplace"
El hecho de que la cuenta de prueba nunca haya podido procesar un pago con tarjeta (solo billetera) podría estar relacionado con que la cuenta no esté dada de alta formalmente como **marketplace/aggregator** ante Mercado Pago — este tipo de integración (con `marketplace_fee`, es decir, split de pagos) normalmente requiere documentación adicional de la empresa que la opera. Vale la pena preguntarle esto directo a soporte de Mercado Pago junto con el tema de "no acepta este medio de pago" que ya está pendiente.

### 🟡 Retención de identificaciones oficiales al eliminar una cuenta
Encontré algo concreto: cuando un usuario borra su cuenta (`eliminar-cuenta`), el campo `ine_url` del perfil se limpia, **pero el archivo de la identificación en sí nunca se borra del almacenamiento** — se queda ahí indefinidamente. Esto contradice el derecho de Cancelación (la "C" de ARCO) que la propia Política de Privacidad promete. Es un arreglo técnico sencillo (borrar también el archivo del bucket al eliminar la cuenta) que vale la pena hacer pronto.

### 🟡 Verificación de edad para eventos, no solo para anfitriones
Hoy solo se verifica que el **anfitrión** sea mayor de 18 años. Si algún evento involucra venta/consumo de alcohol u otro contenido restringido por edad, no hay ningún mecanismo que verifique la edad del **asistente** — la app solo "recomienda" al anfitrión pedir identificación en la entrada (un texto informativo en el Panel de Anfitrión), pero no lo exige ni lo registra. Dependiendo del tipo de eventos que se promuevan en la plataforma, esto podría ser relevante para la responsabilidad de VELA ante la ley.

### 🟡 Aviso de privacidad simplificado
La LFPDPPP recomienda (y en ciertos flujos de recolección de datos sensibles, como identificaciones oficiales, prácticamente exige) un **aviso de privacidad corto**, visible en el momento exacto en que se pide el dato (ej. justo antes de subir la INE en "Ser Anfitrión"), además del aviso completo que ya existe en `/privacidad`. Hoy no hay ningún aviso puntual en el formulario de "Ser Anfitrión" más allá del link genérico a la política completa.

### 🟢 Rol jurídico exacto de VELA (intermediario vs. proveedor)
Los Términos ya dicen que VELA "actúa como intermediario" — pero como también cobra comisión y facilita el pago directamente (no solo publica anuncios), PROFECO podría interpretar el rol de forma distinta según el caso. Vale la pena que un abogado confirme que la calificación de "intermediario" usada en los Términos es la correcta y sostenible, porque cambia qué tan responsable es VELA ante reclamos de consumidores.

### 🟢 Transferencia internacional de datos
Ya mencionado arriba (sección 3) — Supabase procesa datos fuera de México. Es común y permitido, pero normalmente se declara explícitamente en el aviso de privacidad, y hoy no se menciona.

### 🟢 Términos de servicio de terceros incrustados
Vale la pena revisar que los Términos de Uso de VELA no entren en conflicto con los Términos de Desarrolladores de Mercado Pago ni con los de Supabase, especialmente en la parte de responsabilidad y manejo de datos de menores (fecha de nacimiento se pide para verificar edad de anfitriones).

---

## Resumen de prioridad

1. Formalizar el negocio (persona moral, facturación) — antes de escalar en cobros.
2. Aclarar con Mercado Pago el estatus de marketplace de la cuenta.
3. Borrar el archivo de INE al eliminar una cuenta (arreglo técnico rápido).
4. Decidir si se necesita verificación de edad para asistentes en eventos restringidos.
5. Todo lo demás (aviso corto, transferencia internacional, rol jurídico) — revisar con un abogado cuando haya oportunidad, no es urgente para seguir operando en pruebas.
