-- ============================================================
-- COBRO CON TARJETA (Stripe) — facturas
-- Ejecutar en el SQL Editor de Supabase.
--
-- Qué hace este script:
--   Añade a "facturas" las columnas necesarias para generar un
--   enlace de pago con tarjeta (Stripe Checkout) por factura y
--   registrar cuándo se ha cobrado.
--
--   No crea una tabla nueva: se apoya en la columna "estado" que
--   ya existe en facturas (borrador/enviada/vista/pagada/vencida).
--   Cuando Stripe confirma el pago, el webhook pone estado='pagada'.
-- ============================================================

alter table public.facturas
  add column if not exists stripe_checkout_id  text,
  add column if not exists stripe_payment_url  text,
  add column if not exists stripe_pagado_at    timestamptz;

comment on column public.facturas.stripe_checkout_id is
  'ID de la Checkout Session de Stripe generada para cobrar esta factura.';
comment on column public.facturas.stripe_payment_url is
  'Enlace de pago con tarjeta (Stripe Checkout) para compartir con el cliente.';
comment on column public.facturas.stripe_pagado_at is
  'Fecha/hora en que Stripe confirmó el cobro de esta factura (vía webhook).';
