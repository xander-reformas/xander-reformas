-- ============================================================
-- MONETIZACIÓN — Infraestructura de planes y Stripe
-- Ejecutar en Supabase → SQL Editor cuando se active la monetización
-- ============================================================

-- 1. COLUMNAS en tabla profiles
-- ============================================================

alter table public.profiles
  add column if not exists plan              text        not null default 'free'
    check (plan in ('free', 'pro', 'pro_annual')),
  add column if not exists stripe_customer_id text        unique,
  add column if not exists plan_expires_at   timestamptz,
  add column if not exists trial_ends_at     timestamptz;

-- Índice para buscar por customer de Stripe
create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id);

comment on column public.profiles.plan is
  'Plan activo: free | pro | pro_annual';
comment on column public.profiles.stripe_customer_id is
  'ID de cliente en Stripe (cus_xxx)';
comment on column public.profiles.plan_expires_at is
  'Cuando expira el plan de pago (null = activo indefinidamente)';
comment on column public.profiles.trial_ends_at is
  'Fin del período de prueba gratuito (null = sin trial)';


-- 2. FUNCIÓN RPC: activar plan pro (llamada desde webhook de Stripe)
-- ============================================================
create or replace function public.activar_plan_pro(
  p_stripe_customer_id text,
  p_plan               text default 'pro',
  p_expires_at         timestamptz default null
)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  -- Solo callable desde service_role (webhook de Stripe)
  if current_setting('role') != 'service_role' then
    raise exception 'Acceso denegado: solo uso interno';
  end if;

  update public.profiles
  set
    plan             = p_plan,
    plan_expires_at  = p_expires_at,
    stripe_customer_id = p_stripe_customer_id
  where stripe_customer_id = p_stripe_customer_id;
end;
$$;


-- 3. FUNCIÓN RPC: cancelar plan (vuelta a free)
-- ============================================================
create or replace function public.cancelar_plan(
  p_stripe_customer_id text
)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if current_setting('role') != 'service_role' then
    raise exception 'Acceso denegado: solo uso interno';
  end if;

  update public.profiles
  set
    plan            = 'free',
    plan_expires_at = null
  where stripe_customer_id = p_stripe_customer_id;
end;
$$;


-- 4. FUNCIÓN RPC: iniciar trial (llamada en el primer login)
-- ============================================================
create or replace function public.iniciar_trial_si_nuevo()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  -- Trial de 30 días solo si no tiene plan de pago
  if new.plan = 'free' and new.trial_ends_at is null then
    update public.profiles
    set trial_ends_at = now() + interval '30 days'
    where id = new.id;
  end if;
  return new;
end;
$$;

-- Trigger: al crear perfil nuevo, arranca el trial
drop trigger if exists on_new_profile_start_trial on public.profiles;
create trigger on_new_profile_start_trial
  after insert on public.profiles
  for each row
  execute procedure public.iniciar_trial_si_nuevo();


-- 5. VISTA: estado del plan de cada usuario (útil para el admin)
-- ============================================================
create or replace view public.v_plan_usuarios as
select
  p.id,
  p.nombre,
  p.apellidos,
  u.email,
  p.plan,
  p.trial_ends_at,
  p.plan_expires_at,
  p.stripe_customer_id,
  case
    when p.plan in ('pro', 'pro_annual')           then 'pro'
    when p.trial_ends_at is not null
         and p.trial_ends_at > now()               then 'trial'
    else                                                 'free'
  end as estado_efectivo
from public.profiles p
join auth.users u on u.id = p.id;
