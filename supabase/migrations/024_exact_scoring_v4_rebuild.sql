-- 024: exact scoring v4 rebuild + validation.
--
-- Waarom deze migratie bestaat:
-- migratie 023 paste alleen drie verschillen incrementeel toe. De databasefunctie
-- fantasy_score_from_stats() bevatte daarnaast nog oudere gewichten voor o.a.
-- penaltyWon, penAreaEntries, totalScoringAtt en successfulDribble.
-- Daardoor konden oude player_match_stats nog een oude fantasy_points-waarde hebben
-- terwijl de UI de actuele gewichten al toonde.
--
-- Deze migratie:
-- 1) maakt de SQL-scorefunctie exact gelijk aan sync-jpl/data.js;
-- 2) herberekent ELKE opgeslagen wedstrijdscore uit de ruwe stats (geen delta);
-- 3) markeert alle rijen scoringVersion=4;
-- 4) herberekent spelerstotalen, fantasy-gameweeks en marktprijzen;
-- 5) stopt met een fout als er daarna nog één score afwijkt.

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
      + coalesce((s->>'cleanSheet')::numeric,0) * 10
      + coalesce((s->>'savesInsideBox')::numeric,0) * 4
      + coalesce((s->>'punches')::numeric,0) * 2
      - coalesce((s->>'goalsConceded')::numeric,0) * 7
      - coalesce((s->>'foulsMade')::numeric,0)
      + coalesce((s->>'foulsDrawn')::numeric,0)
      - coalesce((s->>'yellow')::numeric,0) * 3
      - coalesce((s->>'red')::numeric,0) * 10
      + coalesce((s->>'goal')::numeric,0) * 10
      + coalesce((s->>'assist')::numeric,0) * 10
      + coalesce((s->>'successfulTackles')::numeric,0) * 3
      + coalesce((s->>'duelWon')::numeric,0) * 0.5
      - coalesce((s->>'duelLost')::numeric,0) * 0.5
      + coalesce((s->>'clearances')::numeric,0)
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
      + coalesce((s->>'penaltyWon')::numeric,0) * 5
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.1
      + coalesce((s->>'penAreaEntries')::numeric,0) * 0.3
      - coalesce((s->>'errorLeadToGoal')::numeric,0) * 15;

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
      + coalesce((s->>'clearances')::numeric,0)
      + coalesce((s->>'interceptions')::numeric,0) * 0.5
      + coalesce((s->>'possessionWon')::numeric,0) * 0.2
      - coalesce((s->>'possessionLost')::numeric,0) * 0.3
      + coalesce((s->>'successfulPass')::numeric,0) * 0.1
      + coalesce((s->>'successfulLongPass')::numeric,0) * 0.3
      + coalesce((s->>'keyPass')::numeric,0) * 0.4
      - coalesce((s->>'passMissed')::numeric,0) * 0.2
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.4
      + coalesce((s->>'shotOnTarget')::numeric,0) * 2
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 2
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.2
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 5
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.2
      + coalesce((s->>'penAreaEntries')::numeric,0) * 0.3
      - coalesce((s->>'errorLeadToGoal')::numeric,0) * 15;

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
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.6
      + coalesce((s->>'shotOnTarget')::numeric,0) * 2
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 3
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.3
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 5
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.4
      + coalesce((s->>'penAreaEntries')::numeric,0) * 0.3
      - coalesce((s->>'errorLeadToGoal')::numeric,0) * 15;

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
      - coalesce((s->>'duelLost')::numeric,0) * 0.7
      + coalesce((s->>'clearances')::numeric,0) * 0.5
      + coalesce((s->>'interceptions')::numeric,0) * 0.5
      + coalesce((s->>'possessionWon')::numeric,0) * 0.2
      - coalesce((s->>'possessionLost')::numeric,0) * 0.1
      + coalesce((s->>'successfulPass')::numeric,0) * 0.1
      + coalesce((s->>'successfulLongPass')::numeric,0) * 0.3
      + coalesce((s->>'keyPass')::numeric,0) * 0.6
      - coalesce((s->>'passMissed')::numeric,0) * 0.1
      + coalesce((s->>'successfulDribble')::numeric,0) * 0.8
      + coalesce((s->>'shotOnTarget')::numeric,0) * 4
      + coalesce((s->>'bigChanceCreated')::numeric,0) * 3
      + coalesce((s->>'successfulFinalThirdPasses')::numeric,0) * 0.3
      - coalesce((s->>'bigChanceMissed')::numeric,0) * 2
      + coalesce((s->>'penaltyWon')::numeric,0) * 5
      + coalesce((s->>'totalScoringAtt')::numeric,0) * 0.4
      + coalesce((s->>'penAreaEntries')::numeric,0) * 0.5
      - coalesce((s->>'errorLeadToGoal')::numeric,0) * 15;
  end if;

  return round(score,2);
end;
$$;


-- Exacte rebuild van alle opgeslagen matchscores. We rekenen niet verder op
-- een eerdere fantasy_points-waarde, zodat elke oude fout verdwijnt.
update public.player_match_stats s
set
  stats = coalesce(s.stats,'{}'::jsonb)
    || jsonb_build_object(
      'minutes',coalesce(s.minutes,0),
      'scoringVersion',4
    ),
  fantasy_points = public.fantasy_score_from_stats(
    p.position,
    coalesce(s.stats,'{}'::jsonb)
      || jsonb_build_object(
        'minutes',coalesce(s.minutes,0),
        'scoringVersion',4
      )
  ),
  updated_at = now()
from public.players p
where p.id=s.player_id;


-- Spelerstotalen opnieuw vanaf de wedstrijdregels.
select public.refresh_player_totals();


-- Alle vastgezette fantasy-speeldagen opnieuw berekenen, zodat oude lineups,
-- automatische wissels en teamtotalen dezelfde gecorrigeerde scores gebruiken.
do $$
declare
  g record;
begin
  for g in select id from public.gameweeks order by id loop
    perform public.recalculate_gameweek_scores(g.id);
  end loop;
end
$$;


-- Marktprijzen opnieuw chronologisch opbouwen op basis van de gecorrigeerde scores.
do $$
begin
  if to_regprocedure('public.recalculate_market_prices()') is not null then
    perform public.recalculate_market_prices();
  end if;
end;
$$;


-- Harde eindcontrole: na deze migratie mag geen enkele opgeslagen score afwijken
-- van wat dezelfde ruwe stats met scoring v4 opleveren.
do $$
declare
  v_bad integer;
begin
  select count(*)
  into v_bad
  from public.player_match_stats s
  join public.players p on p.id=s.player_id
  where abs(
    coalesce(s.fantasy_points,0)
    - public.fantasy_score_from_stats(
        p.position,
        coalesce(s.stats,'{}'::jsonb)
          || jsonb_build_object('minutes',coalesce(s.minutes,0))
      )
  ) > 0.005;

  if v_bad <> 0 then
    raise exception 'Scoring v4 validatie mislukt: % player_match_stats rijen wijken nog af.',v_bad;
  end if;
end;
$$;
