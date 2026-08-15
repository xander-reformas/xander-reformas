-- Tabla de eventos del calendario
CREATE TABLE IF NOT EXISTS public.calendario_eventos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fecha           date        NOT NULL,
  hora            time,                          -- hora de ejecución (opcional)
  titulo          text        NOT NULL,
  tipo            text        NOT NULL DEFAULT 'trabajo',
  descripcion     text,
  notificar_email boolean     NOT NULL DEFAULT false,
  notificado_24h  boolean     NOT NULL DEFAULT false,  -- ya se envió aviso 24h antes
  notificado_1h   boolean     NOT NULL DEFAULT false,  -- ya se envió aviso 1h antes
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.calendario_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_propios_eventos"
  ON public.calendario_eventos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_calendario_user_fecha ON public.calendario_eventos (user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_calendario_notificar  ON public.calendario_eventos (notificar_email, notificado_1h, fecha, hora);
