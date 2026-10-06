-- Automatische Sorare-sync met een random server-side secret.
-- Geen API/service secret wordt in GitHub opgeslagen.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.sync_cron_auth (
  id smallint primary key check (id = 1),
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.sync_cron_auth enable row level security;
revoke all on table public.sync_cron_auth from public, anon, authenticated;
grant select on table public.sync_cron_auth to service_role;

insert into public.sync_cron_auth(id,secret)
values(1,encode(gen_random_bytes(32),'hex'))
on conflict(id) do nothing;

-- De migratie is veilig opnieuw uitvoerbaar: verwijder alleen onze eigen jobs.
do $$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname in ('fantasy-jpl-sync-2h','fantasy-jpl-player-refresh-daily')
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end
$$;

-- Normale sync: iedere twee uur, op minuut 13.
select cron.schedule(
  'fantasy-jpl-sync-2h',
  '13 */2 * * *',
  $cron$
    select net.http_post(
      url := 'https://wjjtbnvushxjlqdkqbls.supabase.co/functions/v1/sync-jpl',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-fantasy-cron-secret',(select secret from public.sync_cron_auth where id=1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);

-- Dagelijks de spelerskernen verversen voor transfers, nieuwe spelers en clubwissels.
select cron.schedule(
  'fantasy-jpl-player-refresh-daily',
  '41 3 * * *',
  $cron$
    select net.http_post(
      url := 'https://wjjtbnvushxjlqdkqbls.supabase.co/functions/v1/sync-jpl',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'x-fantasy-cron-secret',(select secret from public.sync_cron_auth where id=1)
      ),
      body := '{"refreshPlayers":true}'::jsonb,
      timeout_milliseconds := 60000
    ) as request_id;
  $cron$
);
