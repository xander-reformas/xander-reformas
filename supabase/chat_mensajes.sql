-- ============================================================
-- TABLA: chat_mensajes
-- Historial persistente del agente IA
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

create table public.chat_mensajes (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz default now()
);

alter table public.chat_mensajes enable row level security;

create policy "chat: solo propios" on public.chat_mensajes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index idx_chat_mensajes_user_id on public.chat_mensajes(user_id);
create index idx_chat_mensajes_created_at on public.chat_mensajes(created_at desc);
