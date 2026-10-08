-- 019: één vaste adminaccount + handmatige wedstrijdopstelling-overrides.
--
-- BELANGRIJK:
-- De adminrechten worden NIET blijvend op de zichtbare naam "Hugo" gecontroleerd.
-- Net zoals migratie 013 zoeken we NU exact één bestaand profiel met display_name
-- "Hugo", slaan alleen diens onveranderlijke UUID op en gebruiken vanaf dan alleen
-- die UUID. Een toekomstig nieuw account dat ook Hugo heet krijgt dus geen rechten.

create table if not exists public.fantasy_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.fantasy_admin_users enable row level security;

-- Ken de rechten alleen toe wanneer er NU exact één bestaand Hugo-profiel is.
-- Omdat alleen de UUID in fantasy_admin_users wordt opgeslagen, krijgt een later
-- aangemaakt account met dezelfde naam nooit automatisch adminrechten.
insert into public.fantasy_admin_users(user_id)
select p.id
from public.profiles p
where lower(trim(p.display_name))='hugo'
  and (
    select count(*)
    from public.profiles
    where lower(trim(display_name))='hugo'
  )=1
on conflict(user_id) do nothing;


create or replace function public.is_fantasy_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.fantasy_admin_users a
    where a.user_id=auth.uid()
  );
$$;

revoke all on function public.is_fantasy_admin() from public,anon;
grant execute on function public.is_fantasy_admin() to authenticated;


create table if not exists public.fixture_lineup_overrides (
  fixture_id bigint not null references public.fixtures(id) on delete cascade,
  side text not null check(side in ('home','away')),
  formation text not null,
  slots jsonb not null default '[]'::jsonb,
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  primary key(fixture_id,side),
  check(jsonb_typeof(slots)='array')
);

alter table public.fixture_lineup_overrides enable row level security;

drop policy if exists "fixture lineup overrides public read" on public.fixture_lineup_overrides;
create policy "fixture lineup overrides public read"
on public.fixture_lineup_overrides
for select
using (true);


create or replace function public.admin_save_fixture_lineup_override(
  p_fixture_id bigint,
  p_side text,
  p_formation text,
  p_slots jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_def integer;
  v_mid integer;
  v_fwd integer;
  v_slot_count integer;
  v_distinct_count integer;
  v_gk_count integer;
  v_def_count integer;
  v_mid_count integer;
  v_fwd_count integer;
  v_known_count integer;
begin
  if not public.is_fantasy_admin() then
    raise exception 'Geen adminrechten.';
  end if;

  if p_side not in ('home','away') then
    raise exception 'Ongeldige zijde.';
  end if;

  if p_formation !~ '^[3-5]-[2-5]-[1-3]$' then
    raise exception 'Ongeldige formatie.';
  end if;

  v_def := split_part(p_formation,'-',1)::integer;
  v_mid := split_part(p_formation,'-',2)::integer;
  v_fwd := split_part(p_formation,'-',3)::integer;

  if v_def + v_mid + v_fwd <> 10 then
    raise exception 'Een formatie moet 10 veldspelers bevatten.';
  end if;

  if jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Slots moeten een array zijn.';
  end if;

  select
    count(*),
    count(distinct item->>'player_id'),
    count(*) filter(where item->>'zone'='GK'),
    count(*) filter(where item->>'zone'='DEF'),
    count(*) filter(where item->>'zone'='MID'),
    count(*) filter(where item->>'zone'='FWD')
  into
    v_slot_count,v_distinct_count,v_gk_count,v_def_count,v_mid_count,v_fwd_count
  from jsonb_array_elements(p_slots) item;

  if v_slot_count <> 11 or v_distinct_count <> 11 then
    raise exception 'Kies exact 11 verschillende spelers.';
  end if;

  if v_gk_count <> 1
     or v_def_count <> v_def
     or v_mid_count <> v_mid
     or v_fwd_count <> v_fwd then
    raise exception 'De slots komen niet overeen met de gekozen formatie.';
  end if;

  select count(*)
  into v_known_count
  from public.player_match_stats s
  where s.fixture_id=p_fixture_id
    and s.player_id in (
      select item->>'player_id'
      from jsonb_array_elements(p_slots) item
    );

  if v_known_count <> 11 then
    raise exception 'Minstens één gekozen speler hoort niet bij deze wedstrijd.';
  end if;

  insert into public.fixture_lineup_overrides(
    fixture_id,side,formation,slots,updated_by,updated_at
  )
  values(
    p_fixture_id,p_side,p_formation,p_slots,auth.uid(),now()
  )
  on conflict(fixture_id,side) do update set
    formation=excluded.formation,
    slots=excluded.slots,
    updated_by=excluded.updated_by,
    updated_at=now();
end;
$$;

revoke all on function public.admin_save_fixture_lineup_override(bigint,text,text,jsonb) from public,anon;
grant execute on function public.admin_save_fixture_lineup_override(bigint,text,text,jsonb) to authenticated;


create or replace function public.admin_reset_fixture_lineup_override(
  p_fixture_id bigint
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_fantasy_admin() then
    raise exception 'Geen adminrechten.';
  end if;

  delete from public.fixture_lineup_overrides
  where fixture_id=p_fixture_id;
end;
$$;

revoke all on function public.admin_reset_fixture_lineup_override(bigint) from public,anon;
grant execute on function public.admin_reset_fixture_lineup_override(bigint) to authenticated;
