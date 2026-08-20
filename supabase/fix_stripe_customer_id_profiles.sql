-- Fix: profiles.stripe_customer_id no existía en la base de datos aunque el
-- código de stripe-crear-checkout-suscripcion y stripe-crear-cobro ya la
-- usaban. Causaba el error "column profiles.stripe_customer_id does not
-- exist" (Postgres 42703) al intentar suscribirse a XANDER Gestión Pro.
--
-- Ejecutado en producción el 2026-08-20. Se deja aquí para que el esquema
-- local quede sincronizado con lo que realmente hay en Supabase.

alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists plan text default 'free';
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists trial_ends_at timestamptz;

create index if not exists profiles_stripe_customer_id_idx on public.profiles (stripe_customer_id);
create index if not exists profiles_stripe_subscription_id_idx on public.profiles (stripe_subscription_id);
