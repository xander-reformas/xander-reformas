-- ============================================================
-- Programa de referidos
-- Cada suscriptor tiene un código propio. Si alguien se registra con su
-- enlace (?ref=CODIGO, capturado en la landing) y luego se hace Pro, el
-- referidor recibe un mes gratis (crédito de 19€ en su saldo de Stripe).
-- ============================================================

-- Código de referido propio + quién le invitó (si alguien lo hizo)
alter table public.profiles add column if not exists codigo_referido text unique;
alter table public.profiles add column if not exists referido_por uuid references public.profiles(id);

-- Genera un código corto y único (6 caracteres, letras/números mayúsculas)
create or replace function public.generar_codigo_referido()
returns text language plpgsql as $$
declare
  codigo text;
  existe boolean;
begin
  loop
    codigo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select exists(select 1 from public.profiles where codigo_referido = codigo) into existe;
    exit when not existe;
  end loop;
  return codigo;
end;
$$;

-- Backfill: los perfiles que ya existían no tienen código todavía
update public.profiles set codigo_referido = public.generar_codigo_referido()
where codigo_referido is null;

-- Tabla que registra cada referido: quién invitó a quién y si ya se convirtió
-- en cliente de pago (y si la recompensa ya se aplicó).
create table if not exists public.referidos (
  id                    uuid default uuid_generate_v4() primary key,
  referrer_id           uuid references public.profiles(id) on delete cascade not null,
  referido_id           uuid references public.profiles(id) on delete cascade not null unique,
  estado                text default 'registrado', -- registrado | convertido
  recompensa_aplicada   boolean default false,
  recompensa_detalle    text,
  created_at            timestamptz default now(),
  convertido_at         timestamptz
);

alter table public.referidos enable row level security;

create policy "referidos: ver los propios" on public.referidos
  for select using (auth.uid() = referrer_id);

create index if not exists referidos_referrer_id_idx on public.referidos (referrer_id);

-- Actualiza el trigger de alta de usuario para: 1) darle su propio código de
-- referido, 2) si venía con ?ref=CODIGO (guardado en user_metadata.ref_code
-- al registrarse), vincularlo con quien le invitó y crear la fila en
-- referidos.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_codigo      text;
  v_ref_code    text;
  v_referrer_id uuid;
begin
  v_codigo := public.generar_codigo_referido();
  v_ref_code := new.raw_user_meta_data->>'ref_code';

  if v_ref_code is not null and v_ref_code <> '' then
    select id into v_referrer_id
    from public.profiles
    where codigo_referido = upper(v_ref_code)
    limit 1;
  end if;

  insert into public.profiles (id, codigo_referido, referido_por)
  values (new.id, v_codigo, v_referrer_id);

  if v_referrer_id is not null then
    insert into public.referidos (referrer_id, referido_id, estado)
    values (v_referrer_id, new.id, 'registrado')
    on conflict (referido_id) do nothing;
  end if;

  return new;
end;
$$;
