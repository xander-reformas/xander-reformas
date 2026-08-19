-- ============================================================
-- FIRMA DIGITAL — presupuestos y partes de trabajo
-- Ejecutar en el SQL Editor de Supabase.
--
-- Qué hace este script:
--   Añade a "presupuestos" y "partes_trabajo" las columnas donde
--   se guarda la firma manuscrita capturada en pantalla (imagen
--   PNG en base64, dibujada con el dedo o el ratón), el nombre de
--   quien firma y la fecha/hora de la firma.
--
--   No es una firma electrónica cualificada (eIDAS) con validez
--   jurídica plena — es una firma manuscrita digitalizada, igual
--   que la que se usa habitualmente en reparto de paquetería o
--   TPVs. Sirve como evidencia de conformidad del cliente (o del
--   empleado) con lo firmado, con fecha y trazabilidad.
-- ============================================================

alter table public.presupuestos
  add column if not exists firma_png     text,
  add column if not exists firma_nombre  text,
  add column if not exists firma_fecha   timestamptz;

comment on column public.presupuestos.firma_png is
  'Firma manuscrita del cliente capturada en pantalla, PNG en base64 (sin el prefijo data:image/...).';

alter table public.partes_trabajo
  add column if not exists firma_png     text,
  add column if not exists firma_nombre  text,
  add column if not exists firma_fecha   timestamptz;

comment on column public.partes_trabajo.firma_png is
  'Firma manuscrita de conformidad (cliente o empleado) sobre las horas/trabajo de este parte, PNG en base64.';
