-- ============================================================
-- ADMIN PANEL — Panel de control de usuarios registrados
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. TABLA: notificaciones de nuevos registros (solo visibles para el admin)
-- ============================================================
create table if not exists public.admin_notificaciones (
  id          uuid default gen_random_uuid() primary key,
  tipo        text not null default 'nuevo_registro',
  titulo      text not null,
  mensaje     text,
  leida       boolean default false,
  user_id     uuid references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

alter table public.admin_notificaciones enable row level security;

-- Solo el admin puede ver y editar notificaciones
create policy "admin_notificaciones: solo admin"
  on public.admin_notificaciones
  for all
  using (auth.jwt() ->> 'email' = 'reformasxander@gmail.com');


-- 2. FUNCIÓN: trigger que crea notificación cuando se registra un nuevo usuario
-- ============================================================
create or replace function public.notify_admin_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.admin_notificaciones (tipo, titulo, mensaje, user_id)
  values (
    'nuevo_registro',
    'Nuevo autónomo registrado',
    'Se ha registrado un nuevo usuario con ID: ' || new.id::text,
    new.id
  );
  return new;
end;
$$;

-- Trigger en profiles: se dispara cuando se crea un perfil nuevo (= registro completado)
drop trigger if exists on_new_profile_notify_admin on public.profiles;
create trigger on_new_profile_notify_admin
  after insert on public.profiles
  for each row
  execute procedure public.notify_admin_new_user();


-- 3. FUNCIÓN RPC: obtener todos los usuarios (solo admin puede llamarla)
-- ============================================================
create or replace function public.admin_get_all_profiles()
returns table (
  id                    uuid,
  nombre                text,
  apellidos             text,
  email                 text,
  empresa_nombre        text,
  empresa_ciudad        text,
  onboarding_completado boolean,
  created_at            timestamptz,
  last_sign_in_at       timestamptz
)
security definer
set search_path = public
language plpgsql
as $$
begin
  -- Solo el admin puede ejecutar esta función
  if auth.jwt() ->> 'email' != 'reformasxander@gmail.com' then
    raise exception 'Acceso denegado: solo el administrador puede ver los usuarios';
  end if;

  return query
  select
    p.id,
    p.nombre,
    p.apellidos,
    u.email::text,
    p.empresa_nombre,
    p.empresa_ciudad,
    p.onboarding_completado,
    p.created_at,
    u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;


-- 4. FUNCIÓN RPC: marcar notificación como leída
-- ============================================================
create or replace function public.admin_marcar_notificacion_leida(notificacion_id uuid)
returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  if auth.jwt() ->> 'email' != 'reformasxander@gmail.com' then
    raise exception 'Acceso denegado';
  end if;

  update public.admin_notificaciones
  set leida = true
  where id = notificacion_id;
end;
$$;


-- 5. FUNCIÓN RPC: contar notificaciones no leídas
-- ============================================================
create or replace function public.admin_contar_no_leidas()
returns integer
security definer
set search_path = public
language plpgsql
as $$
declare
  total integer;
begin
  if auth.jwt() ->> 'email' != 'reformasxander@gmail.com' then
    return 0;
  end if;

  select count(*) into total
  from public.admin_notificaciones
  where leida = false;

  return total;
end;
$$;
