-- ============================================================
-- STRIPE CONNECT — cobro con tarjeta multi-suscriptor
-- Ejecutar en el SQL Editor de Supabase.
--
-- Qué hace este script:
--   Permite que CADA suscriptor de XANDER conecte su propia
--   cuenta de Stripe (tipo Express) para que el dinero de SUS
--   facturas entre en SU banco, no en el de la plataforma.
--
--   No se toca "stripe_customer_id" (esa columna es para el
--   cobro de la SUSCRIPCIÓN a XANDER, un concepto distinto).
-- ============================================================

alter table public.profiles
  add column if not exists stripe_account_id      text unique,
  add column if not exists stripe_charges_enabled  boolean not null default false,
  add column if not exists stripe_connected_at     timestamptz;

create index if not exists profiles_stripe_account_id_idx
  on public.profiles (stripe_account_id);

comment on column public.profiles.stripe_account_id is
  'ID de la cuenta Express de Stripe Connect del suscriptor (acct_xxx). Aquí entra el dinero de SUS facturas.';
comment on column public.profiles.stripe_charges_enabled is
  'true cuando Stripe ha verificado la cuenta del suscriptor y ya puede recibir cobros.';
comment on column public.profiles.stripe_connected_at is
  'Fecha en la que el suscriptor completó la conexión con Stripe.';
