-- ============================================================
-- TABLA: documentos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

create table public.documentos (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  obra_id     uuid references public.obras(id) on delete set null,
  nombre      text not null,
  descripcion text,
  categoria   text not null default 'Otros',
  url         text,
  fecha       date default current_date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.documentos enable row level security;

create policy "documentos: solo propios" on public.documentos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_documentos_user_id on public.documentos(user_id);
create index idx_documentos_categoria on public.documentos(categoria);

create trigger documentos_updated_at before update on public.documentos
  for each row execute procedure public.update_updated_at();
