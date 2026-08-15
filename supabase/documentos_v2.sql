-- ============================================================
-- MIGRACIÓN: documentos_v2
-- Añade columnas para Supabase Storage
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Nuevas columnas en la tabla documentos
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS storage_path text,    -- ruta interna en el bucket
  ADD COLUMN IF NOT EXISTS file_size    bigint;  -- tamaño en bytes

-- 2. Actualizar función de updated_at si no existe
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- STORAGE: instrucciones manuales (NO se ejecutan como SQL)
-- ============================================================
-- Ve a Supabase → Storage → New bucket
-- Nombre:  documentos-empresa
-- Public:  ✓ (marcar como público)
-- Guardar
--
-- Luego añade estas políticas en Storage → Policies:
-- (o usa las políticas por defecto si el bucket es público)
--
-- Policy name: "Usuarios autenticados pueden subir sus archivos"
-- Allowed operation: INSERT
-- Target roles: authenticated
-- USING expression:
--   (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy name: "Usuarios pueden ver sus propios archivos"
-- Allowed operation: SELECT
-- Target roles: authenticated
-- USING expression:
--   (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policy name: "Usuarios pueden eliminar sus propios archivos"
-- Allowed operation: DELETE
-- Target roles: authenticated
-- USING expression:
--   (auth.uid()::text = (storage.foldername(name))[1])
-- ============================================================
