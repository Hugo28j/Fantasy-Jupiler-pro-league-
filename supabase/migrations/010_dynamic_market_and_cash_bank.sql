-- 010: dynamische marktprijzen + cashbudget.
--
-- Belangrijk verschil:
--   * €100M is startcash, geen permanente maximumwaarde van de selectie.
--   * teams.budget is voortaan de beschikbare CASH.
--   * verkopen gebeurt aan de actuele spelersprijs, kopen ook.
--   * spelersprijzen worden chronologisch na iedere afgewerkte wedstrijd herberekend.
--   * prijs vóór/verschil/prijs na blijft per wedstrijd in player_match_stats.stats staan.

create or replace function public.recalculate_market_prices()
returns table(players_updated integer, history_rows_updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_player_id text := null;
  v_db_price numeric := 0;
  v_base numeric := 0;
  v_price numeric := 0;
  v_before numeric := 0;
  v_after numeric := 0;
  v_delta numeric := 0;
  v_actual_delta numeric := 0;
  v_points numeric := 0;
  v_ratio numeric := 0;
  v_players_updated integer := 0;
  v_history_updated integer := 0;
begin
  for r in
    select
      s.fixture_id,
      s.player_id,
      s.stats,
      s.fantasy_points,
      p.price as current_player_price,
      f.kickoff
    from public.player_match_stats s
    join public.fixtures f on f.id=s.fixture_id
    join public.players p on p.id=s.player_id
    where f.status='FT'
    order by s.player_id,f.kickoff,s.fixture_id
  loop
    if v_player_id is distinct from r.player_id then
      if v_player_id is not null and abs(v_db_price-v_price) > 0.001 then
        update public.players
        set price=v_price,updated_at=now()
        where id=v_player_id;
        v_players_updated := v_players_updated+1;
      end if;

      v_player_id := r.player_id;
      v_db_price := round(coalesce(r.current_player_price,1)::numeric,1);
      v_base := coalesce(
        nullif(r.stats->>'marketBasePrice','')::numeric,
        v_db_price
      );
      v_base := greatest(1,round(v_base,1));
      v_price := v_base;
    end if;

    v_before := round(v_price,1);
    v_points := coalesce(r.fantasy_points,0);
    v_ratio := case
      when v_before > 0 then round((v_points/v_before)*100,1)
      else 0
    end;

    v_delta := case
      when v_points <= 0 then -1.0
      when v_ratio < 30 then -1.0
      when v_ratio < 40 then -0.7
      when v_ratio < 50 then -0.5
      when v_ratio < 90 then -0.3
      when v_ratio < 100 then 0.0
      when v_ratio < 110 then 0.3
      when v_ratio < 120 then 0.5
      when v_ratio < 140 then 1.0
      when v_ratio < 160 then 1.5
      else 2.0
    end;

    v_after := greatest(1,round(v_before+v_delta,1));
    v_actual_delta := round(v_after-v_before,1);

    if
      coalesce(nullif(r.stats->>'priceModelVersion','')::integer,0) <> 1
      or abs(coalesce(nullif(r.stats->>'marketBasePrice','')::numeric,-99999)-v_base) > 0.001
      or abs(coalesce(nullif(r.stats->>'priceBefore','')::numeric,-99999)-v_before) > 0.001
      or abs(coalesce(nullif(r.stats->>'priceDelta','')::numeric,-99999)-v_actual_delta) > 0.001
      or abs(coalesce(nullif(r.stats->>'priceAfter','')::numeric,-99999)-v_after) > 0.001
      or abs(coalesce(nullif(r.stats->>'pricePerformancePct','')::numeric,-99999)-v_ratio) > 0.001
    then
      update public.player_match_stats
      set stats=coalesce(stats,'{}'::jsonb) || jsonb_build_object(
        'marketBasePrice',v_base,
        'priceBefore',v_before,
        'priceDelta',v_actual_delta,
        'priceAfter',v_after,
        'pricePerformancePct',v_ratio,
        'priceModelVersion',1
      ),
      updated_at=now()
      where fixture_id=r.fixture_id and player_id=r.player_id;

      v_history_updated := v_history_updated+1;
    end if;

    v_price := v_after;
  end loop;

  if v_player_id is not null and abs(v_db_price-v_price) > 0.001 then
    update public.players
    set price=v_price,updated_at=now()
    where id=v_player_id;
    v_players_updated := v_players_updated+1;
  end if;

  return query select v_players_updated,v_history_updated;
end;
$$;

revoke all on function public.recalculate_market_prices() from public,anon,authenticated;
grant execute on function public.recalculate_market_prices() to service_role;


create or replace function public.save_my_team(
  p_name text,
  p_squad_ids text[],
  p_bench_gk_id text default null,
  p_bench_outfield_id text default null
)
returns table(saved boolean,locked boolean,lock_at timestamptz,gameweek_number integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_count integer := coalesce(cardinality(p_squad_ids),0);
  v_distinct integer;
  v_found integer;
  v_gk integer;
  v_def integer;
  v_mid integer;
  v_fwd integer;
  v_window record;
  v_baseline text[];
  v_transfers integer := 0;
  v_cost numeric(10,2) := 0;

  v_old_squad text[] := '{}'::text[];
  v_cash numeric(8,1) := 100.0;
  v_sell_value numeric(8,1) := 0;
  v_buy_value numeric(8,1) := 0;
  v_new_cash numeric(8,1) := 100.0;
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;

  select * into v_window from public.current_edit_window();
  if found and v_window.locked then
    raise exception 'De opstelling is vergrendeld: speeldag % is begonnen.',v_window.gameweek_number;
  end if;

  if char_length(trim(coalesce(p_name,''))) not between 1 and 28 then
    raise exception 'De teamnaam moet 1 tot 28 tekens bevatten.';
  end if;
  if v_count > 8 then
    raise exception 'Een selectie mag maximaal 8 spelers bevatten.';
  end if;

  select count(distinct x)
  into v_distinct
  from unnest(coalesce(p_squad_ids,'{}'::text[])) x;

  if v_distinct <> v_count then
    raise exception 'Een speler kan maar één keer in je selectie staan.';
  end if;

  select
    count(*),
    count(*) filter(where position='GK'),
    count(*) filter(where position='DEF'),
    count(*) filter(where position='MID'),
    count(*) filter(where position='FWD')
  into v_found,v_gk,v_def,v_mid,v_fwd
  from public.players
  where active and id=any(coalesce(p_squad_ids,'{}'::text[]));

  if v_found <> v_count then
    raise exception 'De selectie bevat een onbekende of inactieve speler.';
  end if;

  if v_gk > 2 or v_def > 2 or v_mid > 2 or v_fwd > 2 then
    raise exception 'Je mag maximaal 2 spelers per positie kiezen.';
  end if;

  if p_bench_gk_id is not null and not exists(
    select 1
    from public.players
    where id=p_bench_gk_id
      and position='GK'
      and id=any(coalesce(p_squad_ids,'{}'::text[]))
  ) then
    raise exception 'De reservekeeper is ongeldig.';
  end if;

  if p_bench_outfield_id is not null and not exists(
    select 1
    from public.players
    where id=p_bench_outfield_id
      and position<>'GK'
      and id=any(coalesce(p_squad_ids,'{}'::text[]))
  ) then
    raise exception 'De veldspeler op de bank is ongeldig.';
  end if;

  if v_count=8 and not (v_gk=2 and v_def=2 and v_mid=2 and v_fwd=2) then
    raise exception 'Een volledige selectie vereist exact 2 GK, 2 DEF, 2 MID en 2 FWD.';
  end if;

  -- Lock de eigen teamrij terwijl we koop/verkoopcash uitrekenen.
  select coalesce(t.squad_ids,'{}'::text[]),coalesce(t.budget,100.0)
  into v_old_squad,v_cash
  from public.teams t
  where t.user_id=v_user
  for update;

  if not found then
    v_old_squad := '{}'::text[];
    v_cash := 100.0;
  end if;

  -- Verkoop: actuele marktprijs wordt cash.
  select coalesce(sum(p.price),0)
  into v_sell_value
  from public.players p
  where p.id=any(coalesce(v_old_squad,'{}'::text[]))
    and not (p.id=any(coalesce(p_squad_ids,'{}'::text[])));

  -- Aankoop: actuele marktprijs gaat van de cash.
  select coalesce(sum(p.price),0)
  into v_buy_value
  from public.players p
  where p.id=any(coalesce(p_squad_ids,'{}'::text[]))
    and not (p.id=any(coalesce(v_old_squad,'{}'::text[])));

  v_new_cash := round((v_cash+v_sell_value-v_buy_value)::numeric,1);

  if v_new_cash < 0 then
    raise exception 'Onvoldoende cash. Beschikbaar na verkopen: €%M, aankopen kosten €%M.',
      round((v_cash+v_sell_value)::numeric,1),round(v_buy_value::numeric,1);
  end if;

  insert into public.teams(
    user_id,team_name,squad_ids,bench_gk_id,bench_outfield_id,budget,updated_at
  )
  values(
    v_user,trim(p_name),coalesce(p_squad_ids,'{}'::text[]),
    p_bench_gk_id,p_bench_outfield_id,v_new_cash,now()
  )
  on conflict(user_id) do update set
    team_name=excluded.team_name,
    squad_ids=excluded.squad_ids,
    bench_gk_id=excluded.bench_gk_id,
    bench_outfield_id=excluded.bench_outfield_id,
    budget=excluded.budget,
    updated_at=now();

  -- Transferpunten blijven zoals voordien: 2 gratis inkomende spelers per speeldag.
  if v_count=8 and v_window.gameweek_id is not null then
    select l.squad_ids
    into v_baseline
    from public.gameweek_lineups l
    join public.gameweeks g on g.id=l.gameweek_id
    where l.user_id=v_user
      and l.gameweek_id<>v_window.gameweek_id
    order by g.season desc,g.number desc
    limit 1;

    if v_baseline is not null then
      select count(*)
      into v_transfers
      from unnest(p_squad_ids) player_id
      where not (player_id=any(v_baseline));

      v_cost := greatest(0,v_transfers-2)*4;
    end if;

    insert into public.team_transfer_plans(
      user_id,gameweek_id,transfers_used,free_transfers,point_cost,updated_at
    )
    values(v_user,v_window.gameweek_id,v_transfers,2,v_cost,now())
    on conflict(user_id,gameweek_id) do update set
      transfers_used=excluded.transfers_used,
      free_transfers=2,
      point_cost=excluded.point_cost,
      updated_at=now();
  end if;

  return query
  select true,coalesce(v_window.locked,false),v_window.lock_at,v_window.gameweek_number;
end;
$$;

revoke all on function public.save_my_team(text,text[],text,text) from public;
grant execute on function public.save_my_team(text,text[],text,text) to authenticated;

-- Meteen de 7 reeds gespeelde speeldagen verwerken.
select * from public.recalculate_market_prices();
