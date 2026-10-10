-- 034: Sorare API failover + one live sync every minute from 30m pre-match
-- through the match and 10m after the first FT transition.
-- The secondary API key itself is intentionally NOT stored in GitHub.

create table if not exists public.sync_provider_api_keys (
  provider text not null,
  slot text not null,
  secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, slot),
  constraint sync_provider_api_keys_slot_check check (slot in ('secondary'))
);

alter table public.sync_provider_api_keys enable row level security;
revoke all on table public.sync_provider_api_keys from public, anon, authenticated;
grant select on table public.sync_provider_api_keys to service_role;

alter table public.fixtures
  add column if not exists live_finished_at timestamptz;

create or replace function public.set_fixture_live_finished_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'FT' and old.status is distinct from 'FT' then
    new.live_finished_at := coalesce(new.live_finished_at, now());
  elsif new.status is distinct from 'FT' then
    new.live_finished_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fixture_live_finished_at on public.fixtures;
create trigger trg_fixture_live_finished_at
before update of status on public.fixtures
for each row
execute function public.set_fixture_live_finished_at();

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname in (
      'fantasy-jpl-live-sync-3m',
      'fantasy-jpl-live-sync-2m',
      'fantasy-jpl-kickoff-sync-1m',
      'fantasy-jpl-live-sync-1m'
    )
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end
$$;

select cron.schedule(
  'fantasy-jpl-live-sync-1m',
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
      where (
        f.status = 'NS'
        and f.kickoff <= now() + interval '30 minutes'
        and f.kickoff >= now() - interval '3 hours'
      ) or (
        f.status = 'LIVE'
        and f.kickoff >= now() - interval '4 hours'
      ) or (
        f.status = 'FT'
        and f.live_finished_at >= now() - interval '10 minutes'
      )
    );
  $cron$
);
