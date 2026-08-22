-- Ejecutar en Supabase SQL Editor DESPUÉS de desplegar la Edge Function backup-automatico
-- Requisito: extensión pg_cron activa (Dashboard → Extensions) y las settings
-- app.supabase_url / app.service_role_key ya configuradas (mismo requisito que
-- el cron de notificar-eventos, ver cron_notificaciones.sql).

-- Cron semanal: domingos a las 04:00 (hora del servidor, UTC)
SELECT cron.schedule(
  'backup-automatico-semanal',
  '0 4 * * 0',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/backup-automatico',
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
-- SELECT cron.unschedule('backup-automatico-semanal');
