-- 029: één canonieke bron voor alle fantasy-punten.
--
-- Probleem:
-- sommige player_match_stats-rijen konden een fantasy_points-waarde bevatten die
-- niet meer overeenkwam met de actuele gewichten of met de zichtbare statverdeling.
-- Een duidelijk voorbeeld was een verschil exact gelijk aan de minutenbonus.
--
-- Oplossing:
-- 1) de database herberekent fantasy_points voortaan ZELF bij iedere insert/update;
-- 2) alle bestaande wedstrijdregels worden opnieuw door dezelfde functie gestuurd;
-- 3) spelerstotalen + fantasy-speeldagen worden opnieuw opgebouwd;
-- 4) een eindcontrole verhindert dat er nog een afwijkende rij overblijft.
--
-- Hierdoor kunnen oude/deployed Edge Function-versies geen afwijkende score meer
-- opslaan: de trigger maakt de databasewaarde altijd canoniek.

create or replace function public.enforce_canonical_player_match_score()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_position text;
  v_stats jsonb;
begin
  select p.position
  into v_position
  from public.players p
  where p.id=new.player_id;

  if v_position is null then
    raise exception 'Kan fantasy-score niet berekenen: speler % bestaat niet.',new.player_id;
  end if;

  v_stats := coalesce(new.stats,'{}'::jsonb)
    || jsonb_build_object(
      'minutes',coalesce(new.minutes,0),
      'scoringVersion',5
    );

  new.stats := v_stats;
  new.fantasy_points := public.fantasy_score_from_stats(v_position,v_stats);
  return new;
end;
$$;

drop trigger if exists player_match_stats_canonical_score on public.player_match_stats;
create trigger player_match_stats_canonical_score
before insert or update
on public.player_match_stats
for each row
execute function public.enforce_canonical_player_match_score();


-- Laat elke bestaande rij één keer door de trigger lopen.
update public.player_match_stats
set updated_at=now();


-- Spelerstotalen opnieuw vanuit de gecorrigeerde wedstrijdregels.
select public.refresh_player_totals();


-- Alle fantasy-speeldagen opnieuw berekenen, inclusief bank/auto-subregels.
do $$
declare
  g record;
begin
  for g in
    select id
    from public.gameweeks
    order by id
  loop
    perform public.recalculate_gameweek_scores(g.id);
  end loop;
end
$$;


-- Historische marktprijzen moeten dezelfde gecorrigeerde scores gebruiken.
do $$
begin
  if to_regprocedure('public.recalculate_market_prices()') is not null then
    perform public.recalculate_market_prices();
  end if;
end
$$;


-- Harde controle: geen enkele opgeslagen wedstrijdscore mag nog afwijken.
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
    raise exception 'Canonieke scorevalidatie mislukt: % wedstrijdregels wijken nog af.',v_bad;
  end if;
end
$$;
