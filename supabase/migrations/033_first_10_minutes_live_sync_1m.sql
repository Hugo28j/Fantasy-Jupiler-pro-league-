-- 033: tijdens de eerste 10 minuten van een LIVE-wedstrijd elke minuut
-- een extra Sorare live-sync uitvoeren. De bestaande 2-minuten-sync blijft
-- actief voor de rest van de wedstrijd.

select cron.unschedule(jobid)
from cron.job
where jobname='fantasy-jpl-kickoff-sync-1m';

select cron.schedule(
  'fantasy-jpl-kickoff-sync-1m',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://wjjtbnvushxjlqdkqbls.supabase.co/functions/v1/sync-jpl',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-fantasy-cron-secret',(select secret from public.sync_cron_auth where id=1)
      ),
      body := '{"liveOnly":true}'::jsonb,
      timeout_milliseconds := 60000
    ) as request_id
    where exists (
      select 1
      from public.fixtures f
      where f.status='LIVE'
        and f.kickoff <= now()
        and f.kickoff >= now() - interval '10 minutes'
    );
  $cron$
);
