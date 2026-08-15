-- Ejecutar en Supabase SQL Editor DESPUÉS de desplegar la Edge Function
-- Requisito: activar la extensión pg_cron en Supabase Dashboard → Extensions

-- Cron cada 15 minutos que llama a la Edge Function
SELECT cron.schedule(
  'notificar-eventos-calendario',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/notificar-eventos',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- Para ver los jobs activos:
-- SELECT * FROM cron.job;

-- Para eliminar el job si fuera necesario:
-- SELECT cron.unschedule('notificar-eventos-calendario');
