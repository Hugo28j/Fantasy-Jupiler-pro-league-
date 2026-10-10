-- 030: puntenbalans per gekozen speeldag + seizoensgemiddelden.
--
-- De oude latest_gameweek_balance() kon alleen de laatst volledig verwerkte
-- speeldag tonen. De Wedstrijden-tab kan nu iedere speeldag selecteren, dus
-- deze RPC geeft exact de spelerstats van de gekozen speeldag terug.
--
-- Scores worden hier opnieuw uit de ruwe stats berekend met
-- fantasy_score_from_stats(), zodat de balans altijd dezelfde actuele
-- puntgewichten gebruikt als de rest van de site.

create or replace function public.gameweek_balance(p_gameweek integer)
returns table(
  gameweek_number integer,
  player_id text,
  player_name text,
  club_name text,
  "position" text,
  price numeric,
  matches integer,
  minutes integer,
  fantasy_points numeric,
  stats jsonb
)
language sql
stable
security definer
set search_path=public
as $$
  with selected_gameweek as (
    select g.id,g.number
    from public.gameweeks g
    where g.number=p_gameweek
      and g.season=(select max(g2.season) from public.gameweeks g2)
    order by g.id desc
    limit 1
  ),
  player_rows as (
    select
      sg.number as gameweek_number,
      p.id as player_id,
      p.name as player_name,
      p.club_name,
      p.position,
      p.price,
      s.fixture_id,
      s.minutes,
      public.fantasy_score_from_stats(
        p.position,
        coalesce(s.stats,'{}'::jsonb)
          || jsonb_build_object('minutes',coalesce(s.minutes,0))
      ) as canonical_points,
      coalesce(s.stats,'{}'::jsonb) as stats
    from selected_gameweek sg
    join public.fixtures f on f.gameweek_id=sg.id
    join public.player_match_stats s on s.fixture_id=f.id
    join public.players p on p.id=s.player_id
    where coalesce(s.minutes,0)>0
  )
  select
    r.gameweek_number,
    r.player_id,
    r.player_name,
    r.club_name,
    r.position,
    r.price,
    count(distinct r.fixture_id)::integer as matches,
    sum(r.minutes)::integer as minutes,
    round(sum(r.canonical_points),2) as fantasy_points,
    jsonb_build_object(
      'minutes',sum(r.minutes),
      'save',sum(coalesce((r.stats->>'save')::numeric,0)),
      'cleanSheet',sum(coalesce((r.stats->>'cleanSheet')::numeric,0)),
      'savesInsideBox',sum(coalesce((r.stats->>'savesInsideBox')::numeric,0)),
      'punches',sum(coalesce((r.stats->>'punches')::numeric,0)),
      'goalsConceded',sum(coalesce((r.stats->>'goalsConceded')::numeric,0)),
      'foulsMade',sum(coalesce((r.stats->>'foulsMade')::numeric,0)),
      'foulsDrawn',sum(coalesce((r.stats->>'foulsDrawn')::numeric,0)),
      'yellow',sum(coalesce((r.stats->>'yellow')::numeric,0)),
      'red',sum(coalesce((r.stats->>'red')::numeric,0)),
      'goal',sum(coalesce((r.stats->>'goal')::numeric,0)),
      'assist',sum(coalesce((r.stats->>'assist')::numeric,0)),
      'successfulTackles',sum(coalesce((r.stats->>'successfulTackles')::numeric,0)),
      'duelWon',sum(coalesce((r.stats->>'duelWon')::numeric,0)),
      'duelLost',sum(coalesce((r.stats->>'duelLost')::numeric,0)),
      'clearances',sum(coalesce((r.stats->>'clearances')::numeric,0)),
      'interceptions',sum(coalesce((r.stats->>'interceptions')::numeric,0)),
      'possessionWon',sum(coalesce((r.stats->>'possessionWon')::numeric,0)),
      'possessionLost',sum(coalesce((r.stats->>'possessionLost')::numeric,0)),
      'successfulPass',sum(coalesce((r.stats->>'successfulPass')::numeric,0)),
      'successfulLongPass',sum(coalesce((r.stats->>'successfulLongPass')::numeric,0)),
      'keyPass',sum(coalesce((r.stats->>'keyPass')::numeric,0)),
      'passMissed',sum(coalesce((r.stats->>'passMissed')::numeric,0)),
      'successfulDribble',sum(coalesce((r.stats->>'successfulDribble')::numeric,0)),
      'shotOnTarget',sum(coalesce((r.stats->>'shotOnTarget')::numeric,0)),
      'bigChanceCreated',sum(coalesce((r.stats->>'bigChanceCreated')::numeric,0)),
      'successfulFinalThirdPasses',sum(coalesce((r.stats->>'successfulFinalThirdPasses')::numeric,0)),
      'bigChanceMissed',sum(coalesce((r.stats->>'bigChanceMissed')::numeric,0)),
      'penaltyWon',sum(coalesce((r.stats->>'penaltyWon')::numeric,0)),
      'totalScoringAtt',sum(coalesce((r.stats->>'totalScoringAtt')::numeric,0)),
      'penAreaEntries',sum(coalesce((r.stats->>'penAreaEntries')::numeric,0)),
      'errorLeadToGoal',sum(coalesce((r.stats->>'errorLeadToGoal')::numeric,0))
    ) as stats
  from player_rows r
  group by
    r.gameweek_number,r.player_id,r.player_name,r.club_name,r.position,r.price
  order by round(sum(r.canonical_points),2) desc,r.player_name;
$$;

revoke all on function public.gameweek_balance(integer) from public;
grant execute on function public.gameweek_balance(integer) to anon,authenticated;


-- Handige samenvatting over ALLE reeds gespeelde wedstrijden van het huidige
-- seizoen. Eén "appearance" = één speler met >0 minuten in één afgewerkte match.
create or replace function public.season_score_averages()
returns table(
  "position" text,
  appearances bigint,
  average_score numeric,
  minimum_score numeric,
  maximum_score numeric
)
language sql
stable
security definer
set search_path=public
as $$
  with current_season as (
    select max(season) as season
    from public.gameweeks
  ),
  appearances_source as (
    select
      p.position,
      public.fantasy_score_from_stats(
        p.position,
        coalesce(s.stats,'{}'::jsonb)
          || jsonb_build_object('minutes',coalesce(s.minutes,0))
      ) as score
    from public.player_match_stats s
    join public.players p on p.id=s.player_id
    join public.fixtures f on f.id=s.fixture_id
    join public.gameweeks g on g.id=f.gameweek_id
    join current_season cs on cs.season=g.season
    where coalesce(s.minutes,0)>0
      and f.status='FT'
  ),
  by_position as (
    select
      a.position,
      count(*)::bigint as appearances,
      round(avg(a.score),2) as average_score,
      round(min(a.score),2) as minimum_score,
      round(max(a.score),2) as maximum_score
    from appearances_source a
    group by a.position
  ),
  overall as (
    select
      'ALL'::text as position,
      count(*)::bigint as appearances,
      round(avg(score),2) as average_score,
      round(min(score),2) as minimum_score,
      round(max(score),2) as maximum_score
    from appearances_source
  )
  select * from by_position
  union all
  select * from overall
  order by
    case position
      when 'GK' then 1
      when 'DEF' then 2
      when 'MID' then 3
      when 'FWD' then 4
      else 5
    end;
$$;

revoke all on function public.season_score_averages() from public;
grant execute on function public.season_score_averages() to anon,authenticated;
