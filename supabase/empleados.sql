-- ============================================================
-- TABLA: empleados
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.empleados (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre          text NOT NULL,
  apellidos       text NOT NULL,
  dni             text,
  telefono        text,
  email           text,
  puesto          text NOT NULL DEFAULT 'oficial_2',
  especialidad    text,
  tipo_contrato   text NOT NULL DEFAULT 'indefinido',
  fecha_alta      date NOT NULL DEFAULT current_date,
  fecha_baja      date,
  salario_bruto   numeric(10,2) NOT NULL DEFAULT 0,
  jornada_pct     integer NOT NULL DEFAULT 100,
  num_ss          text,
  grupo_convenio  text DEFAULT 'IV',
  estado          text NOT NULL DEFAULT 'activo',
  notas           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empleados: solo propios" ON public.empleados
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_empleados_user_id ON public.empleados(user_id);
CREATE INDEX IF NOT EXISTS idx_empleados_estado   ON public.empleados(estado);

CREATE OR REPLACE TRIGGER empleados_updated_at
  BEFORE UPDATE ON public.empleados
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
