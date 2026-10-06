-- 012: €150M startcash, zwakkere spelers goedkoper en nul-minuten veldspelers uit de markt.
--
-- Rebalance:
--   * 0 minuten: veldspeler onzichtbaar/inactief; keepers blijven beschikbaar.
--   * beginprijs kan alleen DALEN t.o.v. de vaste originele basis.
--   * prestaties worden gemeten als fantasy-punten per 90 minuten:
--       <10 p90  -> 55% van originele basis
--       10-20    -> 70%
--       20-30    -> 85%
--       30-40    -> 95%
--       40+      -> originele basis
--   * weinig minuten geven bovendien een prijsplafond:
--       <90 min  max €4M
--       <180     max €6M
--       <270     max €8M
--       <360     max €10M
--   * minimum blijft €1M.
--   * marktprijs wordt daarna opnieuw vanaf die beginprijs over alle gespeelde matchen berekend.
--
-- Budget:
--   * nieuwe managers starten met €150M cash.
--   * bestaande managers krijgen eenmalig +€50M cash.
--   * een onzichtbaar gemaakte nul-minuten veldspeler wordt uit bestaande selecties gehaald
--     en zijn actuele waarde wordt terugbetaald.

alter table public.market_initial_prices
  add column if not exists original_initial_price numeric(8,1);

update public.market_initial_prices
set original_initial_price=initial_price
where original_initial_price is null;

alter table public.market_initial_prices
  alter column original_initial_price set not null;

-- Totale minuten uit de echte wedstrijddata, niet uit de roster-seed.
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
where p.id=t.id;

-- Zwakkere / weinig gebruikte spelers krijgen een lagere vaste beginprijs.
with perf as (
  select
    p.id,
    p.position,
    coalesce(sum(s.minutes) filter(where f.status='FT'),0)::numeric as mins,
    coalesce(sum(s.fantasy_points) filter(where f.status='FT'),0)::numeric as pts
  from public.players p
  left join public.player_match_stats s on s.player_id=p.id
  left join public.fixtures f on f.id=s.fixture_id
  group by p.id,p.position
),
targets as (
  select
    m.player_id,
    m.original_initial_price,
    p.mins,
    case when p.mins>0 then (p.pts*90.0/p.mins) else null end as p90,
    greatest(
      1.0,
      least(
        m.original_initial_price,
        case
          when p.mins<=0 then m.original_initial_price
          when p.mins<90 then 4.0
          when p.mins<180 then 6.0
          when p.mins<270 then 8.0
          when p.mins<360 then 10.0
          else 999.0
        end,
        round((
          m.original_initial_price *
          case
            when p.mins<=0 then 1.00
            when (p.pts*90.0/p.mins) < 10 then 0.55
            when (p.pts*90.0/p.mins) < 20 then 0.70
            when (p.pts*90.0/p.mins) < 30 then 0.85
            when (p.pts*90.0/p.mins) < 40 then 0.95
            else 1.00
          end
        )*2)/2
      )
    )::numeric(8,1) as target_price
  from public.market_initial_prices m
  join perf p on p.id=m.player_id
)
update public.market_initial_prices m
set initial_price=t.target_price,
    source=case when t.target_price < t.original_initial_price then 'performance-rebalance' else m.source end,
    updated_at=now()
from targets t
where m.player_id=t.player_id
  and m.initial_price is distinct from t.target_price;

-- Budgetdefault verhogen voor nieuwe accounts.
alter table public.teams alter column budget set default 150.0;

create table if not exists public.fantasy_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
revoke all on table public.fantasy_settings from anon,authenticated;

-- Bestaande managers éénmalig €50M extra cash geven.
with applied as (
  insert into public.fantasy_settings(key,value,updated_at)
  values('start_budget_150_applied','{"from":100,"to":150}'::jsonb,now())
  on conflict(key) do nothing
  returning key
)
update public.teams
set budget=round((budget+50.0)::numeric,1),updated_at=now()
where exists(select 1 from applied);

-- Nul-minuten veldspelers die nog in een huidige selectie zaten: refund + verwijderen.
with removed as (
  select
    t.user_id,
    coalesce(sum(p.price),0)::numeric(8,1) as refund
  from public.teams t
  cross join lateral unnest(t.squad_ids) sid(player_id)
  join public.players p on p.id=sid.player_id
  where p.position<>'GK' and p.minutes=0
  group by t.user_id
)
update public.teams t
set budget=round((t.budget+r.refund)::numeric,1),
    squad_ids=coalesce((
      select array_agg(x order by ord)
      from unnest(t.squad_ids) with ordinality u(x,ord)
      join public.players p on p.id=x
      where p.position='GK' or p.minutes>0
    ),'{}'::text[]),
    bench_outfield_id=case
      when exists(
        select 1 from public.players p
        where p.id=t.bench_outfield_id and p.position<>'GK' and p.minutes=0
      ) then null else t.bench_outfield_id end,
    updated_at=now()
from removed r
where r.user_id=t.user_id;

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
  -- Werk totale speelminuten en zichtbaarheid telkens opnieuw bij.
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
    and (p.minutes is distinct from t.minutes or p.active is distinct from (p.position='GK' or t.minutes>0));

  -- Nieuwe spelers die later via Sorare bijkomen krijgen bij hun eerste run
  -- automatisch hun dan geldende importprijs als permanente basis.
  insert into public.market_initial_prices(player_id,initial_price,original_initial_price,source,updated_at)
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

      -- Niet gespeeld = geen marktbeweging en geen prestatiepercentage.
      if coalesce(r.minutes,0) <= 0 then
        v_ratio := 0;
        v_delta := 0;
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
        'priceModelVersion',3
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
  v_cash numeric(8,1) := 150.0;
  v_sell_value numeric(8,1) := 0;
  v_buy_value numeric(8,1) := 0;
  v_new_cash numeric(8,1) := 150.0;
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
  select coalesce(t.squad_ids,'{}'::text[]),coalesce(t.budget,150.0)
  into v_old_squad,v_cash
  from public.teams t
  where t.user_id=v_user
  for update;

  if not found then
    v_old_squad := '{}'::text[];
    v_cash := 150.0;
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



-- Herbereken huidige prijzen meteen vanaf de nieuwe vaste beginprijzen.
select * from public.recalculate_market_prices();
