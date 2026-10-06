-- 014: captain + onboarding voor de eerste selectie.
--
-- Captain is voorlopig een aanduiding; hij geeft GEEN bonuspunten.
-- Nieuwe accounts blijven in Transfermarkt tot de eerste geldige 8/8-selectie klaar is.

alter table public.teams
  add column if not exists captain_id text references public.players(id) on delete set null,
  add column if not exists initial_setup_complete boolean not null default false,
  add column if not exists onboarding_seen boolean not null default false;

alter table public.gameweek_lineups
  add column if not exists captain_id text references public.players(id) on delete set null;

-- Bestaande volledige teams hoeven niet opnieuw door onboarding.
update public.teams
set initial_setup_complete=true
where cardinality(squad_ids)=8;

-- Startcash blijft €125M.
alter table public.teams alter column budget set default 125.0;

create or replace function public.mark_onboarding_seen()
returns void
language sql
security definer
set search_path=public
as $$
  update public.teams
  set onboarding_seen=true,updated_at=now()
  where user_id=auth.uid();
$$;
revoke all on function public.mark_onboarding_seen() from public,anon;
grant execute on function public.mark_onboarding_seen() to authenticated;

-- Oude RPC-signature verwijderen om ambiguïteit door default-argumenten te voorkomen.
drop function if exists public.save_my_team(text,text[],text,text);

create or replace function public.save_my_team(
  p_name text,
  p_squad_ids text[],
  p_bench_gk_id text default null,
  p_bench_outfield_id text default null,
  p_captain_id text default null
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
  v_cash numeric(8,1) := 125.0;
  v_sell_value numeric(8,1) := 0;
  v_buy_value numeric(8,1) := 0;
  v_new_cash numeric(8,1) := 125.0;
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

  if p_captain_id is not null and not (p_captain_id=any(coalesce(p_squad_ids,'{}'::text[]))) then
    raise exception 'De captain moet in je selectie zitten.';
  end if;

  -- Lock de eigen teamrij terwijl we koop/verkoopcash uitrekenen.
  select coalesce(t.squad_ids,'{}'::text[]),coalesce(t.budget,125.0)
  into v_old_squad,v_cash
  from public.teams t
  where t.user_id=v_user
  for update;

  if not found then
    v_old_squad := '{}'::text[];
    v_cash := 125.0;
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
    user_id,team_name,squad_ids,bench_gk_id,bench_outfield_id,captain_id,budget,initial_setup_complete,updated_at
  )
  values(
    v_user,trim(p_name),coalesce(p_squad_ids,'{}'::text[]),
    p_bench_gk_id,p_bench_outfield_id,p_captain_id,v_new_cash,(v_count=8),now()
  )
  on conflict(user_id) do update set
    team_name=excluded.team_name,
    squad_ids=excluded.squad_ids,
    bench_gk_id=excluded.bench_gk_id,
    bench_outfield_id=excluded.bench_outfield_id,
    captain_id=excluded.captain_id,
    budget=excluded.budget,
    initial_setup_complete=(public.teams.initial_setup_complete or excluded.initial_setup_complete),
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

revoke all on function public.save_my_team(text,text[],text,text,text) from public;
grant execute on function public.save_my_team(text,text[],text,text,text) to authenticated;





create or replace function public.lock_gameweek(p_gameweek_id bigint)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare v_inserted integer;
begin
  insert into public.gameweek_lineups(
    gameweek_id,user_id,squad_ids,starter_ids,bench_gk_id,bench_outfield_id,captain_id,transfer_cost
  )
  select p_gameweek_id,t.user_id,t.squad_ids,
    (select array_agg(u.id order by u.ord) from unnest(t.squad_ids) with ordinality u(id,ord)
      where u.id not in (t.bench_gk_id,t.bench_outfield_id)),
    t.bench_gk_id,t.bench_outfield_id,t.captain_id,coalesce(tp.point_cost,0)
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



drop function if exists public.public_manager_history(uuid);

create or replace function public.public_manager_history(p_manager uuid)
returns table(
  gameweek_number integer,
  points numeric,
  squad_ids text[],
  starter_ids text[],
  bench_gk_id text,
  bench_outfield_id text,
  captain_id text,
  breakdown jsonb,
  locked_at timestamptz
)
language sql
stable
security definer set search_path=public
as $$
  select
    g.number,
    coalesce(s.points,0),
    l.squad_ids,
    l.starter_ids,
    l.bench_gk_id,
    l.bench_outfield_id,
    l.captain_id,
    coalesce(s.breakdown,'{}'::jsonb),
    l.locked_at
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  left join public.gameweek_scores s
    on s.gameweek_id=l.gameweek_id and s.user_id=l.user_id
  where l.user_id=p_manager
  order by g.season desc,g.number desc;
$$;
revoke all on function public.public_manager_history(uuid) from public;
grant execute on function public.public_manager_history(uuid) to authenticated;
