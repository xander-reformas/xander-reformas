-- ============================================================
-- TABLA: gastos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

create table public.gastos (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  obra_id       uuid references public.obras(id) on delete set null,
  fecha         date default current_date not null,
  categoria     text not null,
  descripcion   text not null,
  importe_base  numeric(10,2) not null default 0,
  iva_pct       numeric(5,2) not null default 21,
  importe       numeric(10,2) not null default 0,  -- total con IVA
  proveedor     text,
  factura_num   text,
  notas         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Si la tabla ya existe, ejecuta esto para añadir las columnas nuevas:
-- ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS importe_base numeric(10,2) NOT NULL DEFAULT 0;
-- ALTER TABLE public.gastos ADD COLUMN IF NOT EXISTS iva_pct numeric(5,2) NOT NULL DEFAULT 21;

alter table public.gastos enable row level security;

create policy "gastos: solo propios" on public.gastos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_gastos_user_id on public.gastos(user_id);
create index idx_gastos_fecha on public.gastos(fecha);
create index idx_gastos_obra_id on public.gastos(obra_id);

create trigger gastos_updated_at before update on public.gastos
  for each row execute procedure public.update_updated_at();
