-- Live match minute + pre-match official lineup polling.
-- The existing 2-minute sync now starts 75 minutes before kickoff so Sorare's
-- official XI can replace the prediction as soon as it is published.

alter table public.fixtures
  add column if not exists live_minute integer;

select cron.unschedule(jobid)
from cron.job
where jobname = 'fantasy-jpl-live-sync-2m';

select cron.schedule(
  'fantasy-jpl-live-sync-2m',
  '*/2 * * * *',
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
      where f.kickoff <= now() + interval '75 minutes'
        and f.kickoff >= now() - interval '3 hours'
        and f.status in ('NS','LIVE')
    );
  $cron$
);
