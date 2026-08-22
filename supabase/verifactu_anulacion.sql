-- ============================================================
-- VERIFACTU — Anulación de facturas ya registradas
-- Reglamento RD 1007/2023 (Ley Antifraude 11/2021)
-- Ejecutar en el SQL Editor de Supabase, DESPUÉS de verifactu.sql
--
-- Por qué existe esto:
--   Una factura ya registrada en el libro (tipo_registro = 'alta')
--   no se puede borrar ni modificar (ver trigger
--   trg_00_verifactu_bloqueo en verifactu.sql) — es la protección
--   antifraude central del sistema. Pero sí existe un mecanismo
--   legal para invalidarla: un registro de "anulación" encadenado
--   igual que el resto, que dice "esta factura queda sin efecto"
--   sin borrar el rastro de que existió.
--
--   Esta función es la única forma de generar ese registro de
--   anulación (nadie escribe en registro_facturacion a mano).
-- ============================================================

create or replace function public.verifactu_anular_factura(p_factura_id uuid, p_motivo text default null)
returns void
security definer
set search_path = public, extensions
language plpgsql
as $$
declare
  v_factura       record;
  v_nif           text;
  v_hash_anterior text;
  v_cadena        text;
  v_hash          text;
begin
  select * into v_factura from public.facturas where id = p_factura_id and user_id = auth.uid();
  if not found then
    raise exception 'Factura no encontrada o no te pertenece.';
  end if;

  if not exists (
    select 1 from public.registro_facturacion
    where factura_id = p_factura_id and tipo_registro = 'alta'
  ) then
    raise exception 'Esta factura no está registrada en el libro Verifactu; si es un borrador, bórrala directamente.';
  end if;

  if exists (
    select 1 from public.registro_facturacion
    where factura_id = p_factura_id and tipo_registro = 'anulacion'
  ) then
    raise exception 'Esta factura ya está anulada.';
  end if;

  select empresa_nif into v_nif from public.profiles where id = v_factura.user_id;

  -- Huella del último registro de la cadena de este NIF (igual que en el alta)
  select hash into v_hash_anterior
  from public.registro_facturacion
  where nif_emisor = v_nif
  order by creado_en desc
  limit 1;

  v_cadena := coalesce(v_nif, '') || '|ANULACION|' || coalesce(v_factura.numero, '') || '|' ||
              coalesce(now()::text, '') || '|' || coalesce(v_hash_anterior, '');

  v_hash := encode(extensions.digest(v_cadena, 'sha256'), 'hex');

  insert into public.registro_facturacion
    (user_id, factura_id, tipo_registro, nif_emisor, numero_serie, fecha_expedicion, importe_total, hash_anterior, hash, datos_registro)
  values
    (v_factura.user_id, p_factura_id, 'anulacion', v_nif, v_factura.numero, current_date, 0, v_hash_anterior, v_hash,
     jsonb_build_object('motivo', p_motivo, 'numero_original', v_factura.numero, 'anulado_en', now()));

  -- Cambiar el estado no viola el bloqueo (solo protege numero/fecha/items/iva/descuento/retencion/cliente_id)
  update public.facturas set estado = 'anulada' where id = p_factura_id;
end;
$$;

grant execute on function public.verifactu_anular_factura(uuid, text) to authenticated;
