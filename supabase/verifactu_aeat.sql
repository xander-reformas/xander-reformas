-- ============================================================
-- VERIFACTU — Conexión con la AEAT vía Verifacti (proveedor certificado)
-- Ejecutar en el SQL Editor de Supabase, DESPUÉS de verifactu.sql
--
-- Qué hace este script:
--   Añade a registro_facturacion las columnas donde se guarda la
--   respuesta de Verifacti/AEAT para cada factura: identificador del
--   envío, estado (pendiente/aceptado/rechazado/error), el código QR
--   en base64 y el mensaje de error si lo hay.
--
--   El envío en sí lo hace la Edge Function "verifactu-enviar", que
--   llama a la API de Verifacti con la clave del NIF de prueba
--   guardada como secreto (nunca en este archivo ni en el código).
-- ============================================================

alter table public.registro_facturacion
  add column if not exists verifacti_uuid          text,
  add column if not exists verifacti_estado         text default 'no_enviado',
  -- no_enviado | pendiente | aceptado | aceptado_con_errores | rechazado | error
  add column if not exists verifacti_qr             text,
  add column if not exists verifacti_error           text,
  add column if not exists verifacti_enviado_en      timestamptz,
  add column if not exists verifacti_actualizado_en  timestamptz;

comment on column public.registro_facturacion.verifacti_estado is
  'Estado del envío a la AEAT vía Verifacti. no_enviado hasta que se llama a la Edge Function verifactu-enviar.';

-- Los usuarios ya pueden leer estas columnas: la política de solo-lectura
-- de registro_facturacion (creada en verifactu.sql) cubre toda la fila.
