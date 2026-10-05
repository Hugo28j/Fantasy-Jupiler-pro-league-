-- Laatste volledig verwerkte JPL-speeldag: scores en alle gebruikte statistieken.

create or replace function public.latest_gameweek_balance()
returns table(
  gameweek_number integer,
  player_id text,
  player_name text,
  club_name text,
  position text,
  price numeric,
  matches integer,
  minutes integer,
  fantasy_points numeric,
  stats jsonb
)
language sql
stable
security definer set search_path=public
as $$
  with latest as (
    select g.id,g.number
    from public.gameweeks g
    join public.fixtures f on f.gameweek_id=g.id
    where g.status='finished'
    group by g.id,g.number,g.season
    having count(*)=9 and bool_and(f.stats_processed)
    order by g.season desc,g.number desc
    limit 1
  )
  select
    l.number,
    p.id,
    p.name,
    p.club_name,
    p.position,
    p.price,
    count(distinct s.fixture_id)::integer,
    sum(s.minutes)::integer,
    round(sum(s.fantasy_points),2),
    jsonb_build_object(
      'minutes',sum(s.minutes),
      'save',sum(coalesce((s.stats->>'save')::numeric,0)),
      'cleanSheet',sum(coalesce((s.stats->>'cleanSheet')::numeric,0)),
      'savesInsideBox',sum(coalesce((s.stats->>'savesInsideBox')::numeric,0)),
      'punches',sum(coalesce((s.stats->>'punches')::numeric,0)),
      'goalsConceded',sum(coalesce((s.stats->>'goalsConceded')::numeric,0)),
      'foulsMade',sum(coalesce((s.stats->>'foulsMade')::numeric,0)),
      'foulsDrawn',sum(coalesce((s.stats->>'foulsDrawn')::numeric,0)),
      'yellow',sum(coalesce((s.stats->>'yellow')::numeric,0)),
      'red',sum(coalesce((s.stats->>'red')::numeric,0)),
      'goal',sum(coalesce((s.stats->>'goal')::numeric,0)),
      'assist',sum(coalesce((s.stats->>'assist')::numeric,0)),
      'successfulTackles',sum(coalesce((s.stats->>'successfulTackles')::numeric,0)),
      'duelWon',sum(coalesce((s.stats->>'duelWon')::numeric,0)),
      'duelLost',sum(coalesce((s.stats->>'duelLost')::numeric,0)),
      'clearances',sum(coalesce((s.stats->>'clearances')::numeric,0)),
      'interceptions',sum(coalesce((s.stats->>'interceptions')::numeric,0)),
      'possessionWon',sum(coalesce((s.stats->>'possessionWon')::numeric,0)),
      'possessionLost',sum(coalesce((s.stats->>'possessionLost')::numeric,0)),
      'successfulPass',sum(coalesce((s.stats->>'successfulPass')::numeric,0)),
      'successfulLongPass',sum(coalesce((s.stats->>'successfulLongPass')::numeric,0)),
      'keyPass',sum(coalesce((s.stats->>'keyPass')::numeric,0)),
      'passMissed',sum(coalesce((s.stats->>'passMissed')::numeric,0)),
      'successfulDribble',sum(coalesce((s.stats->>'successfulDribble')::numeric,0)),
      'shotOnTarget',sum(coalesce((s.stats->>'shotOnTarget')::numeric,0))
    )
  from latest l
  join public.fixtures f on f.gameweek_id=l.id
  join public.player_match_stats s on s.fixture_id=f.id
  join public.players p on p.id=s.player_id
  group by l.number,p.id,p.name,p.club_name,p.position,p.price
  order by round(sum(s.fantasy_points),2) desc,p.name;
$$;

revoke all on function public.latest_gameweek_balance() from public;
grant execute on function public.latest_gameweek_balance() to anon,authenticated;
