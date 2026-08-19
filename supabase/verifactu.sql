-- ============================================================
-- VERIFACTU — Libro registro de facturación inalterable
-- Reglamento RD 1007/2023 (Ley Antifraude 11/2021)
-- Ejecutar en el SQL Editor de Supabase
--
-- Qué hace este script:
--   1. Crea un libro registro (registro_facturacion) append-only:
--      nadie puede editarlo ni borrarlo, ni siquiera el propio usuario.
--   2. Cuando una factura sale de "borrador" (se emite), genera
--      automáticamente su huella SHA-256 encadenada a la anterior
--      del mismo NIF emisor — igual que exige el reglamento.
--   3. Bloquea la edición o el borrado de una factura ya emitida:
--      a partir de ahí solo se puede rectificar (factura nueva
--      vinculada), nunca modificar el original.
--
-- Lo que NO hace todavía (a propósito):
--   El envío en tiempo real a la Agencia Tributaria y el código QR
--   de verificación oficial. Esa parte se conecta a través de un
--   proveedor certificado (ver tarea "Verifactu: conexión AEAT") y
--   se añade en un paso posterior — imprimir un QR de verificación
--   antes de estar realmente conectados a Hacienda sería más
--   perjudicial que no tenerlo.
-- ============================================================

create extension if not exists pgcrypto;

-- 1. TABLA: libro registro de facturación
-- ============================================================
create table if not exists public.registro_facturacion (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users(id) on delete cascade not null,
  factura_id       uuid references public.facturas(id) on delete restrict not null,
  tipo_registro    text not null default 'alta', -- alta | anulacion
  nif_emisor       text not null,
  numero_serie     text not null,
  fecha_expedicion date not null,
  importe_total    numeric(12,2) not null,
  hash_anterior    text,           -- null solo en el primer registro de cada NIF
  hash             text not null,
  datos_registro   jsonb not null, -- snapshot de los datos que generaron el hash (auditoría)
  creado_en        timestamptz default now()
);

comment on table public.registro_facturacion is
  'Libro registro inalterable de facturación (RD 1007/2023). Solo se escribe mediante triggers, nunca directamente desde la app.';

alter table public.registro_facturacion enable row level security;

-- Cada usuario solo puede LEER sus propios registros. Nadie tiene permiso
-- de insert/update/delete directo: solo lo hacen las funciones SECURITY DEFINER de abajo.
create policy "registro_facturacion: solo lectura propia"
  on public.registro_facturacion
  for select using (auth.uid() = user_id);

create index if not exists idx_registro_fact_user   on public.registro_facturacion(user_id, creado_en);
create index if not exists idx_registro_fact_nif     on public.registro_facturacion(nif_emisor, creado_en);
create unique index if not exists idx_registro_fact_factura_alta
  on public.registro_facturacion(factura_id) where tipo_registro = 'alta';


-- 2. FUNCIÓN + TRIGGER: registrar la emisión (alta en el libro)
-- ============================================================
create or replace function public.verifactu_registrar_emision()
returns trigger
security definer
set search_path = public, extensions
language plpgsql
as $$
declare
  v_nif           text;
  v_hash_anterior text;
  v_cadena        text;
  v_hash          text;
  v_importe       numeric(12,2);
  v_debe_registrar boolean := false;
begin
  if TG_OP = 'INSERT' and new.estado <> 'borrador' then
    v_debe_registrar := true;
  elsif TG_OP = 'UPDATE' and old.estado = 'borrador' and new.estado <> 'borrador' then
    v_debe_registrar := true;
  end if;

  if not v_debe_registrar then
    return new;
  end if;

  -- Evita duplicar si por lo que sea ya existe un alta para esta factura
  if exists (select 1 from public.registro_facturacion where factura_id = new.id and tipo_registro = 'alta') then
    return new;
  end if;

  select empresa_nif into v_nif from public.profiles where id = new.user_id;
  if v_nif is null or trim(v_nif) = '' then
    raise exception 'No se puede emitir la factura: falta el NIF/CIF de la empresa en "Mi Empresa". Complétalo antes de enviar facturas.';
  end if;

  -- Importe total con la misma fórmula que usa el resto de la app
  select coalesce(sum((item->>'importe')::numeric), 0) into v_importe
  from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) as item;
  v_importe := v_importe - (v_importe * coalesce(new.descuento, 0) / 100);
  v_importe := v_importe + (v_importe * coalesce(new.iva, 0) / 100);
  v_importe := v_importe - (v_importe * coalesce(new.retencion, 0) / 100);
  v_importe := round(v_importe, 2);

  -- Huella del último registro de este NIF (la cadena es por emisor, no por usuario)
  select hash into v_hash_anterior
  from public.registro_facturacion
  where nif_emisor = v_nif
  order by creado_en desc
  limit 1;

  v_cadena := coalesce(v_nif, '') || '|' || coalesce(new.numero, '') || '|' ||
              coalesce(new.fecha::text, '') || '|' || coalesce(v_importe::text, '') || '|' ||
              coalesce(v_hash_anterior, '');

  v_hash := encode(extensions.digest(v_cadena, 'sha256'), 'hex');

  insert into public.registro_facturacion
    (user_id, factura_id, tipo_registro, nif_emisor, numero_serie, fecha_expedicion, importe_total, hash_anterior, hash, datos_registro)
  values
    (new.user_id, new.id, 'alta', v_nif, new.numero, new.fecha, v_importe, v_hash_anterior, v_hash,
     jsonb_build_object(
       'numero', new.numero, 'fecha', new.fecha, 'importe_total', v_importe,
       'cliente_id', new.cliente_id, 'obra_id', new.obra_id, 'iva', new.iva,
       'descuento', new.descuento, 'retencion', new.retencion
     ));

  return new;
end;
$$;

drop trigger if exists trg_01_verifactu_emision on public.facturas;
create trigger trg_01_verifactu_emision
  after insert or update on public.facturas
  for each row
  execute procedure public.verifactu_registrar_emision();


-- 3. FUNCIÓN + TRIGGER: bloquear factura ya registrada
-- ============================================================
create or replace function public.verifactu_bloquear_factura_registrada()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
declare
  v_bloqueada boolean;
begin
  select exists(
    select 1 from public.registro_facturacion
    where factura_id = old.id and tipo_registro = 'alta'
  ) into v_bloqueada;

  if v_bloqueada then
    if TG_OP = 'DELETE' then
      raise exception 'Esta factura ya está registrada en el libro Verifactu y no se puede eliminar. Emite una factura rectificativa.';
    end if;

    if new.numero     is distinct from old.numero
    or new.fecha       is distinct from old.fecha
    or new.items       is distinct from old.items
    or new.iva         is distinct from old.iva
    or new.descuento   is distinct from old.descuento
    or new.retencion   is distinct from old.retencion
    or new.cliente_id  is distinct from old.cliente_id then
      raise exception 'Esta factura ya está registrada en el libro Verifactu: sus datos económicos no se pueden modificar. Emite una factura rectificativa.';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_00_verifactu_bloqueo on public.facturas;
create trigger trg_00_verifactu_bloqueo
  before update or delete on public.facturas
  for each row
  execute procedure public.verifactu_bloquear_factura_registrada();


-- 4. FUNCIÓN RPC: comprobar la integridad de la cadena de un NIF
--    (útil para un futuro panel de "Verifactu" y para auditorías)
-- ============================================================
create or replace function public.verifactu_verificar_cadena()
returns table (total_registros integer, cadena_integra boolean, primer_registro timestamptz, ultimo_registro timestamptz)
security definer
set search_path = public
language plpgsql
as $$
declare
  v_nif text;
  v_rota boolean := false;
begin
  select empresa_nif into v_nif from public.profiles where id = auth.uid();

  with ordenado as (
    select *, lag(hash) over (order by creado_en) as hash_esperado
    from public.registro_facturacion
    where nif_emisor = v_nif
    order by creado_en
  )
  select bool_or(hash_esperado is distinct from hash_anterior) into v_rota
  from ordenado
  where hash_esperado is not null;

  return query
  select
    count(*)::integer,
    not coalesce(v_rota, false),
    min(creado_en),
    max(creado_en)
  from public.registro_facturacion
  where nif_emisor = v_nif;
end;
$$;
