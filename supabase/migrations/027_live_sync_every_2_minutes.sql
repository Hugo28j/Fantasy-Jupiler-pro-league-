-- 027: live score sync verlagen van iedere 3 minuten naar iedere 2 minuten.
--
-- Buiten wedstrijden blijft de normale volledige sync om de 2 uur actief.
-- Tijdens een wedstrijd controleert deze job iedere 2 minuten of er een JPL-match
-- bezig kan zijn en roept dan de geoptimaliseerde liveOnly-sync aan.
--
-- Dit vervangt expliciet de 3-minutenjob uit migratie 026.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in (
      'fantasy-jpl-live-sync-3m',
      'fantasy-jpl-live-sync-2m'
    )
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end
$$;

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
      where f.kickoff <= now()
        and f.kickoff >= now() - interval '3 hours'
        and f.status in ('NS','LIVE')
    );
  $cron$
);
