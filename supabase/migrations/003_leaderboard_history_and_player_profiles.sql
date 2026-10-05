-- Punt 8–9: publiek klassement per speeldag, historische teams en spelersfiches.

-- Spelers zonder speelminuten zijn echte budgetopties. De syncfunctie neemt
-- dezelfde ondergrens over, zodat een reserve vanaf €1M beschikbaar kan zijn.
update public.players
set price=1,updated_at=now()
where minutes=0 and lower(name)<>'hans vanaken';

create or replace function public.public_leaderboard()
returns table(
  manager_id uuid,
  team_name text,
  total_points numeric,
  latest_gameweek_number integer,
  latest_gameweek_points numeric
)
language sql
stable
security definer set search_path=public
as $$
  select
    t.user_id,
    t.team_name,
    t.total_points,
    latest.gameweek_number,
    latest.points
  from public.teams t
  left join lateral (
    select g.number as gameweek_number,s.points
    from public.gameweek_scores s
    join public.gameweeks g on g.id=s.gameweek_id
    where s.user_id=t.user_id
    order by g.season desc,g.number desc
    limit 1
  ) latest on true
  order by t.total_points desc,t.team_name;
$$;
revoke all on function public.public_leaderboard() from public;
grant execute on function public.public_leaderboard() to anon,authenticated;

create or replace function public.public_manager_history(p_manager uuid)
returns table(
  gameweek_number integer,
  points numeric,
  squad_ids text[],
  starter_ids text[],
  bench_gk_id text,
  bench_outfield_id text,
  breakdown jsonb,
  locked_at timestamptz
)
language sql
stable
security definer set search_path=public
as $$
  select
    g.number,
    coalesce(s.points,0),
    l.squad_ids,
    l.starter_ids,
    l.bench_gk_id,
    l.bench_outfield_id,
    coalesce(s.breakdown,'{}'::jsonb),
    l.locked_at
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  left join public.gameweek_scores s
    on s.gameweek_id=l.gameweek_id and s.user_id=l.user_id
  where l.user_id=p_manager
  order by g.season desc,g.number desc;
$$;
revoke all on function public.public_manager_history(uuid) from public;
grant execute on function public.public_manager_history(uuid) to authenticated;
