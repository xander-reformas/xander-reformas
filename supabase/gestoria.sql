-- ============================================================
-- GESTORÍA: envío mensual de facturas y gastos, con seguimiento
-- de qué se ha enviado ya y qué falta.
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- Contacto de la gestoría (se configura en Mi Empresa).
alter table public.profiles add column if not exists gestoria_email  text;
alter table public.profiles add column if not exists gestoria_nombre text;

-- Seguimiento de envío por factura y por gasto: así se puede ver de un
-- vistazo qué falta por mandar y no se duplica ni se olvida nada.
alter table public.facturas add column if not exists enviado_gestoria       boolean default false;
alter table public.facturas add column if not exists enviado_gestoria_fecha timestamptz;

alter table public.gastos add column if not exists enviado_gestoria       boolean default false;
alter table public.gastos add column if not exists enviado_gestoria_fecha timestamptz;

-- Guarda el archivo original (ticket/factura de gasto) que hoy solo se usaba
-- de forma transitoria para el OCR y no se conservaba en ningún sitio.
-- Sin esto no hay nada real que adjuntar cuando se envía a la gestoría.
alter table public.gastos add column if not exists comprobante_path text;

-- Bucket privado (no público, a diferencia de obras-fotos: aquí puede haber
-- datos de proveedores/pagos) para los comprobantes de gastos.
insert into storage.buckets (id, name, public)
values ('gastos-comprobantes', 'gastos-comprobantes', false)
on conflict (id) do nothing;

-- Cada usuario solo puede leer/escribir dentro de su propia carpeta
-- (el primer segmento de la ruta es su user_id).
drop policy if exists "gastos-comprobantes: propios" on storage.objects;
create policy "gastos-comprobantes: propios" on storage.objects
  for all using (
    bucket_id = 'gastos-comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'gastos-comprobantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

notify pgrst, 'reload schema';
