-- ============================================================
-- SUSCRIPCIÓN STRIPE — Cobro de la cuota de XANDER Gestión
-- (distinto de stripe_connect.sql, que es para que CADA SUSCRIPTOR
--  cobre a SUS clientes). Esto es para cobrar la cuota Pro a los
--  suscriptores de la propia plataforma.
-- Ejecutar en Supabase → SQL Editor.
-- Reutiliza las columnas plan / stripe_customer_id / plan_expires_at /
-- trial_ends_at ya creadas en monetizacion_plan.sql.
-- ============================================================

alter table public.profiles
  add column if not exists stripe_subscription_id text;

comment on column public.profiles.stripe_subscription_id is
  'ID de la suscripción activa en Stripe (sub_xxx) a la cuota Pro de XANDER Gestión';

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id);
