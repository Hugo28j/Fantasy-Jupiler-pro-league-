-- Herbereken alle bestaande Sorare-wedstrijdscores na de aangepaste puntgewichten.
create or replace function public.fantasy_score_from_stats(
  p_position text,
  p_stats jsonb
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  s jsonb := coalesce(p_stats,'{}'::jsonb);
  score numeric := 0;
begin
  score := coalesce((s->>'minutes')::numeric,0) * 0.1;

  if p_position = 'GK' then
    score := score
      + coalesce((s->>'save')::numeric,0) * 2
      + coalesce((s->>'cleanSheet')::numeric,0) * 15
      + coalesce((s->>'savesInsideBox')::numeric,0) * 4
      + coalesce((s->>'punches')::numeric,0) * 2
      - coalesce((s->>'goalsConceded')::numeric,0) * 10
      - coalesce((s->>'foulsMade')::numeric,0)
      + coalesce((s->>'foulsDrawn')::numeric,0)
      - coalesce((s->>'yellow')::numeric,0) * 3
      - coalesce((s->>'red')::numeric,0) * 10
      + coalesce((s->>'goal')::numeric,0) * 10
      + coalesce((s->>'assist')::numeric,0) * 10
      + coalesce((s->>'successfulTackles')::numeric,0) * 3
      + coalesce((s->>'duelWon')::numeric,0) * 0.5
      - coalesce((s->>'duelLost')::numeric,0) * 0.5
      + coalesce((s->>'clearances')::numeric,0) * 1
      + coalesce((s->>'interceptions')::numeric,0) * 0.5
      + coalesce((s->>'possessionWon')::numeric,0) * 0.2
      - coalesce((s->>'possessionLost')::numeric,0) * 0.2
      + coalesce((s->>'successfulPass')::numeric,0) * 0.1
      + coalesce((s->>'successfulLongPass')::numeric,0) * 0.3
      + coalesce((s->>'keyPass')::numeric,0) * 0.4
      - coalesce((s->>'passMissed')::numeric,0) * 0.2
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.2
      + coalesce((s->>'shotOnTarget')::numeric,0) * 2
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 2
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.2
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 3
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.1;

  elsif p_position = 'DEF' then
    score := score
      + coalesce((s->>'cleanSheet')::numeric,0) * 5
      - coalesce((s->>'goalsConceded')::numeric,0) * 5
      - coalesce((s->>'foulsMade')::numeric,0)
      + coalesce((s->>'foulsDrawn')::numeric,0)
      - coalesce((s->>'yellow')::numeric,0) * 3
      - coalesce((s->>'red')::numeric,0) * 10
      + coalesce((s->>'goal')::numeric,0) * 10
      + coalesce((s->>'assist')::numeric,0) * 10
      + coalesce((s->>'successfulTackles')::numeric,0) * 4
      + coalesce((s->>'duelWon')::numeric,0)
      - coalesce((s->>'duelLost')::numeric,0)
      + coalesce((s->>'clearances')::numeric,0) * 1
      + coalesce((s->>'interceptions')::numeric,0) * 0.5
      + coalesce((s->>'possessionWon')::numeric,0) * 0.2
      - coalesce((s->>'possessionLost')::numeric,0) * 0.3
      + coalesce((s->>'successfulPass')::numeric,0) * 0.1
      + coalesce((s->>'successfulLongPass')::numeric,0) * 0.3
      + coalesce((s->>'keyPass')::numeric,0) * 0.4
      - coalesce((s->>'passMissed')::numeric,0) * 0.2
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.2
      + coalesce((s->>'shotOnTarget')::numeric,0) * 2
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 2
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.2
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 3
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.1;

  elsif p_position = 'MID' then
    score := score
      - coalesce((s->>'goalsConceded')::numeric,0) * 3
      - coalesce((s->>'foulsMade')::numeric,0)
      + coalesce((s->>'foulsDrawn')::numeric,0)
      - coalesce((s->>'yellow')::numeric,0) * 3
      - coalesce((s->>'red')::numeric,0) * 10
      + coalesce((s->>'goal')::numeric,0) * 10
      + coalesce((s->>'assist')::numeric,0) * 10
      + coalesce((s->>'successfulTackles')::numeric,0) * 3
      + coalesce((s->>'duelWon')::numeric,0) * 0.5
      - coalesce((s->>'duelLost')::numeric,0) * 0.5
      + coalesce((s->>'clearances')::numeric,0) * 0.5
      + coalesce((s->>'interceptions')::numeric,0) * 0.5
      + coalesce((s->>'possessionWon')::numeric,0) * 0.4
      - coalesce((s->>'possessionLost')::numeric,0) * 0.3
      + coalesce((s->>'successfulPass')::numeric,0) * 0.2
      + coalesce((s->>'successfulLongPass')::numeric,0) * 0.5
      + coalesce((s->>'keyPass')::numeric,0) * 0.6
      - coalesce((s->>'passMissed')::numeric,0) * 0.3
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.3
      + coalesce((s->>'shotOnTarget')::numeric,0) * 2
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 3
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.3
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 3
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.1;

  elsif p_position = 'FWD' then
    score := score
      - coalesce((s->>'goalsConceded')::numeric,0)
      - coalesce((s->>'foulsMade')::numeric,0)
      + coalesce((s->>'foulsDrawn')::numeric,0)
      - coalesce((s->>'yellow')::numeric,0) * 3
      - coalesce((s->>'red')::numeric,0) * 10
      + coalesce((s->>'goal')::numeric,0) * 10
      + coalesce((s->>'assist')::numeric,0) * 10
      + coalesce((s->>'successfulTackles')::numeric,0) * 2
      + coalesce((s->>'duelWon')::numeric,0)
      - coalesce((s->>'duelLost')::numeric,0)
      + coalesce((s->>'clearances')::numeric,0) * 0.5
      + coalesce((s->>'interceptions')::numeric,0) * 0.5
      + coalesce((s->>'possessionWon')::numeric,0) * 0.2
      - coalesce((s->>'possessionLost')::numeric,0) * 0.1
      + coalesce((s->>'successfulPass')::numeric,0) * 0.1
      + coalesce((s->>'successfulLongPass')::numeric,0) * 0.3
      + coalesce((s->>'keyPass')::numeric,0) * 0.6
      - coalesce((s->>'passMissed')::numeric,0) * 0.1
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.5
      + coalesce((s->>'shotOnTarget')::numeric,0) * 4
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 3
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.3
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 3
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.1;
  end if;

  return round(score,2);
end;
$$;

update public.player_match_stats s
set fantasy_points = public.fantasy_score_from_stats(p.position,s.stats),
    updated_at = now()
from public.players p
where p.id = s.player_id;

select public.refresh_player_totals();

do $$
declare
  g record;
begin
  for g in select id from public.gameweeks loop
    perform public.recalculate_gameweek_scores(g.id);
  end loop;
end
$$;

-- De vijf nieuwe Sorare-statvelden staan nog niet in historische stats-json.
-- Laat de bestaande cron alle afgewerkte wedstrijden één keer opnieuw ophalen.
update public.fixtures
set details_processed = false
where status = 'FT';
