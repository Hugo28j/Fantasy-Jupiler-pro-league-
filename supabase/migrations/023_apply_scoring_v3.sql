-- 023: pas scoring version 3 onmiddellijk toe op bestaande spelers/wedstrijden.
--
-- Wijzigingen t.o.v. scoring v2:
--   FWD verloren duel: -1.0 -> -0.7  (dus +0.3 per verloren duel)
--   GK tegendoelpunt:  -10  -> -7    (dus +3 per tegendoelpunt)
--   GK clean sheet:    +15  -> +10   (dus -5 bij een clean sheet)
--
-- Deze migratie is idempotent: rijen met scoringVersion >= 3 worden niet
-- opnieuw aangepast.

update public.player_match_stats s
set
  fantasy_points = round((
    s.fantasy_points
    + case
        when p.position='FWD'
          then 0.3 * coalesce((s.stats->>'duelLost')::numeric,0)
        when p.position='GK'
          then 3.0 * coalesce((s.stats->>'goalsConceded')::numeric,0)
             - 5.0 * coalesce((s.stats->>'cleanSheet')::numeric,0)
        else 0
      end
  )::numeric,2),
  stats = coalesce(s.stats,'{}'::jsonb) || jsonb_build_object('scoringVersion',3),
  updated_at = now()
from public.players p
join public.fixtures f on f.id=s.fixture_id
where p.id=s.player_id
  and f.status='FT'
  and coalesce((s.stats->>'scoringVersion')::integer,0) < 3;


-- Herbereken de seizoentotalen die de transfermarkt/spelerkaarten tonen.
with totals as (
  select
    p.id,
    coalesce(sum(s.fantasy_points) filter(where f.status='FT'),0)::numeric(10,2) as total_points,
    coalesce(sum(s.minutes) filter(where f.status='FT'),0)::integer as total_minutes
  from public.players p
  left join public.player_match_stats s on s.player_id=p.id
  left join public.fixtures f on f.id=s.fixture_id
  group by p.id
)
update public.players p
set
  total_points=t.total_points,
  minutes=t.total_minutes,
  updated_at=now()
from totals t
where p.id=t.id;


-- Herbereken alle reeds vastgezette fantasy-gameweeks zodat teamtotalen ook
-- overeenkomen met de nieuwe spelersscores.
do $$
declare
  g record;
begin
  if to_regprocedure('public.recalculate_gameweek_scores(bigint)') is not null then
    for g in
      select distinct gameweek_id
      from public.gameweek_lineups
      order by gameweek_id
    loop
      perform public.recalculate_gameweek_scores(g.gameweek_id);
    end loop;
  end if;
end;
$$;


-- Marktprijzen hangen af van fantasy-punten. Als de prijsfunctie uit migratie
-- 021 aanwezig is, bouw de prijshistorie daarom ook opnieuw op.
do $$
begin
  if to_regprocedure('public.recalculate_market_prices()') is not null then
    perform public.recalculate_market_prices();
  end if;
end;
$$;
