-- ============================================================
-- MIGRACIÓN: equipo_v2
-- Tablas: partes_trabajo, nominas, obra_empleados
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Partes de trabajo (registro diario de horas)
CREATE TABLE IF NOT EXISTS public.partes_trabajo (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empleado_id  uuid REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  obra_id      uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  fecha        date NOT NULL DEFAULT current_date,
  horas        numeric(5,2) NOT NULL DEFAULT 8,
  descripcion  text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.partes_trabajo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partes_trabajo: solo propios" ON public.partes_trabajo
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_partes_user    ON public.partes_trabajo(user_id);
CREATE INDEX IF NOT EXISTS idx_partes_fecha   ON public.partes_trabajo(fecha);
CREATE INDEX IF NOT EXISTS idx_partes_emp     ON public.partes_trabajo(empleado_id);
CREATE INDEX IF NOT EXISTS idx_partes_obra    ON public.partes_trabajo(obra_id);

-- 2. Nóminas mensuales
CREATE TABLE IF NOT EXISTS public.nominas (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  empleado_id      uuid REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  periodo_mes      integer NOT NULL CHECK (periodo_mes BETWEEN 1 AND 12),
  periodo_año      integer NOT NULL,
  salario_bruto    numeric(10,2) NOT NULL DEFAULT 0,
  ss_trabajador    numeric(10,2) NOT NULL DEFAULT 0,   -- cuota SS a cargo trabajador
  irpf_pct         numeric(5,2)  NOT NULL DEFAULT 15,
  irpf_importe     numeric(10,2) NOT NULL DEFAULT 0,
  otros_desc       numeric(10,2) NOT NULL DEFAULT 0,   -- anticipos, embargos, etc.
  neto             numeric(10,2) NOT NULL DEFAULT 0,   -- líquido a percibir
  ss_empresa       numeric(10,2) NOT NULL DEFAULT 0,   -- cuota SS a cargo empresa
  pagada           boolean NOT NULL DEFAULT false,
  fecha_pago       date,
  notas            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  UNIQUE(empleado_id, periodo_mes, periodo_año)
);

ALTER TABLE public.nominas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nominas: solo propios" ON public.nominas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_nominas_user   ON public.nominas(user_id);
CREATE INDEX IF NOT EXISTS idx_nominas_emp    ON public.nominas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_nominas_period ON public.nominas(periodo_año, periodo_mes);

CREATE OR REPLACE TRIGGER nominas_updated_at
  BEFORE UPDATE ON public.nominas
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- 3. Relación obra ↔ empleado (equipo asignado)
CREATE TABLE IF NOT EXISTS public.obra_empleados (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  obra_id      uuid REFERENCES public.obras(id) ON DELETE CASCADE NOT NULL,
  empleado_id  uuid REFERENCES public.empleados(id) ON DELETE CASCADE NOT NULL,
  fecha_inicio date,
  fecha_fin    date,
  rol_en_obra  text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(obra_id, empleado_id)
);

ALTER TABLE public.obra_empleados ENABLE ROW LEVEL SECURITY;

-- Política basada en el user_id de la obra
CREATE POLICY "obra_empleados: propietario de la obra" ON public.obra_empleados
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.obras WHERE id = obra_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.obras WHERE id = obra_id AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_obra_emp_obra ON public.obra_empleados(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_emp_emp  ON public.obra_empleados(empleado_id);

-- 4. Añadir fecha_vencimiento a facturas si no existe
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fecha_vencimiento date;
