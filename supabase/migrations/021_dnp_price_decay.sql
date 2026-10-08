-- 021: spelers met 0 minuten verliezen €0,3M per verwerkte wedstrijd.
--
-- Alle bestaande prijsregels blijven gelijk. Alleen DNP verandert:
-- 0 minuten => -€0,3M (minimumprijs blijft €1,0M).
-- De volledige prijshistorie wordt opnieuw chronologisch opgebouwd zodat oude
-- DNP-wedstrijden dezelfde regel krijgen.

create or replace function public.recalculate_market_prices()
returns table(players_updated integer,history_rows_updated integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  p_rec record;
  r record;
  v_price numeric := 0;
  v_before numeric := 0;
  v_after numeric := 0;
  v_delta numeric := 0;
  v_points numeric := 0;
  v_ratio numeric := 0;
  v_players_updated integer := 0;
  v_history_updated integer := 0;
begin
  -- Werk totale speelminuten en marktzichtbaarheid opnieuw bij.
  with totals as (
    select p.id,coalesce(sum(s.minutes) filter(where f.status='FT'),0)::integer as minutes
    from public.players p
    left join public.player_match_stats s on s.player_id=p.id
    left join public.fixtures f on f.id=s.fixture_id
    group by p.id
  )
  update public.players p
  set minutes=t.minutes,
      active=(p.position='GK' or t.minutes>0),
      updated_at=now()
  from totals t
  where p.id=t.id
    and (
      p.minutes is distinct from t.minutes
      or p.active is distinct from (p.position='GK' or t.minutes>0)
    );

  -- Nieuwe Sorare-spelers krijgen één permanente startprijs.
  insert into public.market_initial_prices(
    player_id,initial_price,original_initial_price,source,updated_at
  )
  select
    p.id,
    case
      when public.normalize_market_name(p.name)='hansvanaken' then 25.0
      else greatest(1.0,least(24.0,coalesce(p.price,1.0)))
    end,
    case
      when public.normalize_market_name(p.name)='hansvanaken' then 25.0
      else greatest(1.0,least(24.0,coalesce(p.price,1.0)))
    end,
    'sorare-import',
    now()
  from public.players p
  where not exists(
    select 1 from public.market_initial_prices m where m.player_id=p.id
  )
  on conflict(player_id) do nothing;

  for p_rec in
    select p.id,p.price,m.initial_price
    from public.players p
    join public.market_initial_prices m on m.player_id=p.id
    order by p.id
  loop
    v_price := greatest(1,round(p_rec.initial_price::numeric,1));

    for r in
      select
        s.fixture_id,
        s.minutes,
        s.fantasy_points,
        s.stats,
        f.kickoff
      from public.player_match_stats s
      join public.fixtures f on f.id=s.fixture_id
      where s.player_id=p_rec.id
        and f.status='FT'
      order by f.kickoff asc,s.fixture_id asc
    loop
      v_before := round(v_price,1);
      v_points := coalesce(r.fantasy_points,0);

      if coalesce(r.minutes,0) <= 0 then
        -- Nieuw: een speler die niet speelt zakt geleidelijk in marktwaarde.
        v_ratio := 0;
        v_delta := -0.3;
      else
        v_ratio := case
          when v_before > 0 then round((v_points/v_before)*100,1)
          else 0
        end;

        v_delta := case
          when v_points <= 0 then -2.0
          when v_ratio < 30 then -2.0
          when v_ratio < 40 then -1.0
          when v_ratio < 70 then -0.7
          when v_ratio < 90 then -0.5
          when v_ratio < 100 then -0.3
          when v_ratio < 110 then 0.3
          when v_ratio < 120 then 0.5
          when v_ratio < 140 then 1.0
          when v_ratio < 160 then 1.5
          else 2.0
        end;
      end if;

      v_after := greatest(1,round(v_before+v_delta,1));
      v_delta := round(v_after-v_before,1);

      update public.player_match_stats
      set stats=coalesce(stats,'{}'::jsonb) || jsonb_build_object(
        'marketBasePrice',p_rec.initial_price,
        'priceBefore',v_before,
        'priceDelta',v_delta,
        'priceAfter',v_after,
        'pricePerformancePct',v_ratio,
        'priceModelVersion',4
      ),
      updated_at=now()
      where fixture_id=r.fixture_id
        and player_id=p_rec.id;

      v_history_updated := v_history_updated+1;
      v_price := v_after;
    end loop;

    if abs(coalesce(p_rec.price,0)-v_price) > 0.001 then
      update public.players
      set price=v_price,updated_at=now()
      where id=p_rec.id;
      v_players_updated := v_players_updated+1;
    end if;
  end loop;

  return query select v_players_updated,v_history_updated;
end;
$$;

revoke all on function public.recalculate_market_prices() from public,anon,authenticated;
grant execute on function public.recalculate_market_prices() to service_role;

-- Pas de nieuwe DNP-regel meteen toe op de bestaande prijshistorie.
select * from public.recalculate_market_prices();
