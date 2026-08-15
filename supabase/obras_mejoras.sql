-- ============================================================
-- MEJORAS TABLA OBRAS: etapas, seguimiento y fotos
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

alter table public.obras
  add column if not exists etapa       text not null default 'Planificación',
  add column if not exists seguimiento jsonb not null default '[]',
  add column if not exists fotos       jsonb not null default '[]';

-- Bucket de almacenamiento para fotos de obra
-- IMPORTANTE: también debes crear el bucket manualmente en
-- Supabase → Storage → New bucket → nombre: "obras-fotos" → Public: ON
