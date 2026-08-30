-- ============================================================
-- PORTAL DEL CLIENTE: login propio + lectura del estado de su obra
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Vincula un cliente con su propia cuenta de acceso al portal
-- (distinto de clientes.user_id, que es el profesional dueño del registro).
alter table public.clientes
  add column if not exists portal_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_clientes_portal_user_id
  on public.clientes(portal_user_id) where portal_user_id is not null;

-- El cliente puede ver su propia ficha (nombre, etc.) una vez tiene el portal activado.
drop policy if exists "clientes: portal lectura propia" on public.clientes;
create policy "clientes: portal lectura propia" on public.clientes
  for select using (auth.uid() = portal_user_id);

-- El cliente puede ver (solo lectura) las obras vinculadas a su ficha de cliente.
-- Esta política se suma a "obras: solo propias" (la del profesional); Postgres
-- combina ambas con OR, así que el profesional mantiene su acceso total.
drop policy if exists "obras: portal cliente lectura" on public.obras;
create policy "obras: portal cliente lectura" on public.obras
  for select using (
    exists (
      select 1 from public.clientes c
      where c.id = obras.cliente_id
        and c.portal_user_id = auth.uid()
    )
  );

-- El bucket "obras-fotos" ya se creó como Public, pero añadimos también una
-- política explícita de lectura para que .list()/.download() funcionen igual
-- desde una sesión de cliente autenticado como desde el profesional.
drop policy if exists "obras-fotos: lectura publica" on storage.objects;
create policy "obras-fotos: lectura publica" on storage.objects
  for select using (bucket_id = 'obras-fotos');
