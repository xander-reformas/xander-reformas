-- ============================================================
-- Captación de leads (landing / WhatsApp) para XANDER Gestión
-- Personas interesadas que dejan sus datos en la landing pero todavía no
-- se registran. Solo el admin puede leerlos; cualquier visitante (sin
-- sesión) puede dejar el suyo.
-- ============================================================

create table if not exists public.leads_saas (
  id         uuid default gen_random_uuid() primary key,
  nombre     text not null,
  email      text,
  telefono   text,
  mensaje    text,
  origen     text default 'landing',
  atendido   boolean default false,
  created_at timestamptz default now()
);

alter table public.leads_saas enable row level security;

drop policy if exists "leads_saas: cualquiera inserta" on public.leads_saas;
create policy "leads_saas: cualquiera inserta"
  on public.leads_saas
  for insert
  with check (true);

drop policy if exists "leads_saas: solo admin lee" on public.leads_saas;
create policy "leads_saas: solo admin lee"
  on public.leads_saas
  for select
  using (auth.jwt() ->> 'email' = 'reformasxander@gmail.com');

drop policy if exists "leads_saas: solo admin actualiza" on public.leads_saas;
create policy "leads_saas: solo admin actualiza"
  on public.leads_saas
  for update
  using (auth.jwt() ->> 'email' = 'reformasxander@gmail.com');

-- Notificar al admin (reutiliza el mismo sistema de campana que ya existe)
create or replace function public.notify_admin_new_lead()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.admin_notificaciones (tipo, titulo, mensaje)
  values (
    'nuevo_lead',
    'Nuevo lead desde la landing',
    trim(
      coalesce(new.nombre, 'Sin nombre') ||
      coalesce(' · ' || new.telefono, '') ||
      coalesce(' · ' || new.email, '')
    )
  );
  return new;
end;
$$;

drop trigger if exists on_new_lead_saas on public.leads_saas;
create trigger on_new_lead_saas
  after insert on public.leads_saas
  for each row execute procedure public.notify_admin_new_lead();
