-- ============================================================
-- COPIAS DE SEGURIDAD — bucket de Storage + políticas RLS
-- Ejecutar en Supabase → SQL Editor
--
-- Convención de rutas dentro del bucket:
--   {user_id}/manual-{timestamp}.json   -- creadas a mano desde la app
--   {user_id}/auto-{timestamp}.json     -- generadas por el cron semanal
-- ============================================================

-- 1. Crear el bucket (privado — no accesible por URL pública)
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

-- 2. Políticas: cada usuario solo puede leer/escribir/borrar dentro de su
--    propia carpeta {user_id}/... dentro del bucket 'backups'.
--    (storage.foldername(name))[1] es el primer segmento de la ruta.

drop policy if exists "backups: leer propias" on storage.objects;
create policy "backups: leer propias"
  on storage.objects for select
  using (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "backups: subir propias" on storage.objects;
create policy "backups: subir propias"
  on storage.objects for insert
  with check (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "backups: actualizar propias" on storage.objects;
create policy "backups: actualizar propias"
  on storage.objects for update
  using (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "backups: borrar propias" on storage.objects;
create policy "backups: borrar propias"
  on storage.objects for delete
  using (
    bucket_id = 'backups'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
