-- 026: snellere live score sync.
--
-- Buiten wedstrijden blijft de bestaande normale sync om de 2 uur actief.
-- Deze extra job loopt iedere 3 minuten, maar roept sync-jpl ALLEEN aan wanneer
-- een JPL-wedstrijd volgens onze kalender bezig kan zijn.
--
-- We kijken naar een venster van kickoff t/m 3 uur na kickoff. Daardoor start
-- de live-sync ook wanneer de fixture in de database nog "NS" is en de vorige
-- 2-uurs sync dus nog niet gezien heeft dat Sorare hem LIVE noemt.
--
-- De Edge Function krijgt {"liveOnly":true}; die modus beperkt de zware
-- player-stats calls tot de clubs die live spelen / net klaar zijn.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'fantasy-jpl-live-sync-3m'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'fantasy-jpl-live-sync-3m',
  '*/3 * * * *',
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
      where f.kickoff <= now()
        and f.kickoff >= now() - interval '3 hours'
        and f.status in ('NS','LIVE')
    );
  $cron$
);
