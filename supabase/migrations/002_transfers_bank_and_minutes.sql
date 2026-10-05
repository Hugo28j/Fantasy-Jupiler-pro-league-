-- Punt 5–7: expliciete bankwissels, twee gratis transfers en transferpunten.

-- Een gemiddelde speler kost nu ongeveer €12,5M. Vanaken is bewust de
-- unieke duurste speler van €25M; alle andere bestaande prijzen stoppen op €24M.
update public.players
set price=case
  when lower(name)='hans vanaken' then 25
  else least(24,round(price*3)/2)
end,
updated_at=now();

alter table public.gameweek_lineups
  add column if not exists transfer_cost numeric(10,2) not null default 0;

create table if not exists public.team_transfer_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  gameweek_id bigint not null references public.gameweeks(id) on delete cascade,
  transfers_used integer not null default 0 check (transfers_used >= 0),
  free_transfers integer not null default 2 check (free_transfers = 2),
  point_cost numeric(10,2) not null default 0 check (point_cost >= 0),
  updated_at timestamptz not null default now(),
  primary key(user_id,gameweek_id)
);

alter table public.team_transfer_plans enable row level security;
drop policy if exists "transfer plans own read" on public.team_transfer_plans;
create policy "transfer plans own read" on public.team_transfer_plans
for select using (auth.uid() = user_id);

create or replace function public.save_my_team(
  p_name text,
  p_squad_ids text[],
  p_bench_gk_id text default null,
  p_bench_outfield_id text default null
)
returns table(saved boolean,locked boolean,lock_at timestamptz,gameweek_number integer)
language plpgsql
security definer set search_path = public
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
  v_spent numeric(8,1);
  v_window record;
  v_baseline text[];
  v_transfers integer := 0;
  v_cost numeric(10,2) := 0;
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;
  select * into v_window from public.current_edit_window();
  if found and v_window.locked then
    raise exception 'De opstelling is vergrendeld: speeldag % is begonnen.',v_window.gameweek_number;
  end if;
  if char_length(trim(coalesce(p_name,''))) not between 1 and 28 then
    raise exception 'De teamnaam moet 1 tot 28 tekens bevatten.';
  end if;
  if v_count > 8 then raise exception 'Een selectie mag maximaal 8 spelers bevatten.'; end if;

  select count(distinct x) into v_distinct from unnest(coalesce(p_squad_ids,'{}')) x;
  if v_distinct <> v_count then raise exception 'Een speler kan maar één keer in je selectie staan.'; end if;

  select count(*),coalesce(sum(price),0),
    count(*) filter(where position='GK'),count(*) filter(where position='DEF'),
    count(*) filter(where position='MID'),count(*) filter(where position='FWD')
  into v_found,v_spent,v_gk,v_def,v_mid,v_fwd
  from public.players where active and id = any(coalesce(p_squad_ids,'{}'));

  if v_found <> v_count then raise exception 'De selectie bevat een onbekende of inactieve speler.'; end if;
  if v_spent > 100 then raise exception 'Onvoldoende budget: je selectie kost €%M.',v_spent; end if;
  if v_gk > 2 or v_def > 2 or v_mid > 2 or v_fwd > 2 then
    raise exception 'Je mag maximaal 2 spelers per positie kiezen.';
  end if;

  if p_bench_gk_id is not null and not exists(
    select 1 from public.players where id=p_bench_gk_id and position='GK' and id=any(p_squad_ids)
  ) then raise exception 'De reservekeeper is ongeldig.'; end if;
  if p_bench_outfield_id is not null and not exists(
    select 1 from public.players where id=p_bench_outfield_id and position<>'GK' and id=any(p_squad_ids)
  ) then raise exception 'De veldspeler op de bank is ongeldig.'; end if;

  if v_count = 8 and not (v_gk=2 and v_def=2 and v_mid=2 and v_fwd=2) then
    raise exception 'Een volledige selectie vereist exact 2 GK, 2 DEF, 2 MID en 2 FWD.';
  end if;

  insert into public.teams(user_id,team_name,squad_ids,bench_gk_id,bench_outfield_id,budget,updated_at)
  values(v_user,trim(p_name),coalesce(p_squad_ids,'{}'),p_bench_gk_id,p_bench_outfield_id,100-v_spent,now())
  on conflict(user_id) do update set
    team_name=excluded.team_name,squad_ids=excluded.squad_ids,
    bench_gk_id=excluded.bench_gk_id,bench_outfield_id=excluded.bench_outfield_id,
    budget=excluded.budget,updated_at=now();

  -- De eerste selectie is gratis. Daarna telt alleen het verschil met de
  -- laatst vastgezette selectie; heen-en-terug klikken kost dus niets extra.
  if v_count=8 and v_window.gameweek_id is not null then
    select l.squad_ids into v_baseline
    from public.gameweek_lineups l
    join public.gameweeks g on g.id=l.gameweek_id
    where l.user_id=v_user and l.gameweek_id<>v_window.gameweek_id
    order by g.season desc,g.number desc
    limit 1;

    if v_baseline is not null then
      select count(*) into v_transfers
      from unnest(p_squad_ids) player_id
      where not (player_id=any(v_baseline));
      v_cost := greatest(0,v_transfers-2)*4;
    end if;

    insert into public.team_transfer_plans(user_id,gameweek_id,transfers_used,free_transfers,point_cost,updated_at)
    values(v_user,v_window.gameweek_id,v_transfers,2,v_cost,now())
    on conflict(user_id,gameweek_id) do update set
      transfers_used=excluded.transfers_used,free_transfers=2,
      point_cost=excluded.point_cost,updated_at=now();
  end if;

  return query select true,coalesce(v_window.locked,false),v_window.lock_at,v_window.gameweek_number;
end;
$$;

create or replace function public.my_transfer_status()
returns table(gameweek_number integer,transfers_used integer,free_transfers integer,point_cost numeric)
language plpgsql
stable
security definer set search_path = public
as $$
declare v_window record;
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  select * into v_window from public.current_edit_window();
  if not found then return; end if;
  return query
    select v_window.gameweek_number,coalesce(p.transfers_used,0),2,coalesce(p.point_cost,0)
    from (select 1) x
    left join public.team_transfer_plans p
      on p.user_id=auth.uid() and p.gameweek_id=v_window.gameweek_id;
end;
$$;
grant execute on function public.my_transfer_status() to authenticated;

create or replace function public.lock_gameweek(p_gameweek_id bigint)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare v_inserted integer;
begin
  insert into public.gameweek_lineups(
    gameweek_id,user_id,squad_ids,starter_ids,bench_gk_id,bench_outfield_id,transfer_cost
  )
  select p_gameweek_id,t.user_id,t.squad_ids,
    (select array_agg(u.id order by u.ord) from unnest(t.squad_ids) with ordinality u(id,ord)
      where u.id not in (t.bench_gk_id,t.bench_outfield_id)),
    t.bench_gk_id,t.bench_outfield_id,coalesce(tp.point_cost,0)
  from public.teams t
  left join public.team_transfer_plans tp on tp.user_id=t.user_id and tp.gameweek_id=p_gameweek_id
  where cardinality(t.squad_ids)=8 and t.bench_gk_id is not null and t.bench_outfield_id is not null
  on conflict(gameweek_id,user_id) do nothing;
  get diagnostics v_inserted = row_count;
  update public.gameweeks set status='active' where id=p_gameweek_id and status='upcoming';
  return v_inserted;
end;
$$;
revoke all on function public.lock_gameweek(bigint) from public,anon,authenticated;
grant execute on function public.lock_gameweek(bigint) to service_role;

create or replace function public.recalculate_gameweek_scores(p_gameweek_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  with totals as (
    select s.player_id,sum(s.minutes)::integer as minutes,sum(s.fantasy_points)::numeric(10,2) as points
    from public.player_match_stats s join public.fixtures f on f.id=s.fixture_id
    where f.gameweek_id=p_gameweek_id group by s.player_id
  ), components as (
    select l.user_id,l.transfer_cost,
      coalesce((select sum(coalesce(t.points,0)) from unnest(l.starter_ids) sid
        left join totals t on t.player_id=sid where coalesce(t.minutes,0)>0),0) as starter_points,
      exists(select 1 from unnest(l.starter_ids) sid join public.players p on p.id=sid
        left join totals t on t.player_id=sid where p.position='GK' and coalesce(t.minutes,0)=0) as missing_gk,
      exists(select 1 from unnest(l.starter_ids) sid join public.players p on p.id=sid
        left join totals t on t.player_id=sid where p.position<>'GK' and coalesce(t.minutes,0)=0) as missing_outfield,
      coalesce((select t.points from totals t where t.player_id=l.bench_gk_id and t.minutes>0),0) as bench_gk_points,
      coalesce((select t.points from totals t where t.player_id=l.bench_outfield_id and t.minutes>0),0) as bench_outfield_points
    from public.gameweek_lineups l where l.gameweek_id=p_gameweek_id
  ), calculated as (
    select user_id,
      starter_points
      + case when missing_gk then bench_gk_points else 0 end
      + case when missing_outfield then bench_outfield_points else 0 end
      - transfer_cost as points,
      jsonb_build_object(
        'keeper_substitution',missing_gk and bench_gk_points<>0,
        'outfield_substitution',missing_outfield and bench_outfield_points<>0,
        'maximum_outfield_substitutions',1,
        'transfer_cost',transfer_cost
      ) as breakdown
    from components
  )
  insert into public.gameweek_scores(gameweek_id,user_id,points,breakdown,calculated_at)
  select p_gameweek_id,user_id,points,breakdown,now() from calculated
  on conflict(gameweek_id,user_id) do update set
    points=excluded.points,breakdown=excluded.breakdown,calculated_at=now();

  update public.teams t set total_points=coalesce(x.points,0)
  from (select user_id,sum(points) points from public.gameweek_scores group by user_id) x
  where t.user_id=x.user_id;
end;
$$;
revoke all on function public.recalculate_gameweek_scores(bigint) from public,anon,authenticated;
grant execute on function public.recalculate_gameweek_scores(bigint) to service_role;
