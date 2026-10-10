-- 028: live klassementpunten + strikte bankregel.
--
-- Regels:
-- - Bankspelers leveren 0 teampunten zolang ze op de bank blijven.
-- - Reserve-GK telt alleen wanneer de basis-GK 0 minuten speelde EN diens
--   wedstrijd in deze speeldag definitief FT is.
-- - De veldreserve telt maximaal één keer, alleen wanneer minstens één
--   basisveldspeler 0 minuten speelde EN diens wedstrijd definitief FT is.
-- - Tijdens een lopende speeldag wordt een speler wiens match nog moet beginnen
--   dus NIET voortijdig als DNP behandeld.
-- - De publieke zichtbare lineup-RPC geeft ook speeldag- en totaalpunten terug.

create or replace function public.recalculate_gameweek_scores(p_gameweek_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  with totals as (
    select
      s.player_id,
      sum(s.minutes)::integer as minutes,
      sum(s.fantasy_points)::numeric(10,2) as points
    from public.player_match_stats s
    join public.fixtures f on f.id=s.fixture_id
    where f.gameweek_id=p_gameweek_id
    group by s.player_id
  ), components as (
    select
      l.user_id,
      l.transfer_cost,
      l.captain_id,
      l.bench_gk_id,
      l.bench_outfield_id,
      cp.position as captain_position,
      coalesce(ct.minutes,0) as captain_minutes,

      -- Alleen basisspelers met echte minuten tellen rechtstreeks mee.
      coalesce((
        select sum(coalesce(t.points,0))
        from unnest(l.starter_ids) sid
        left join totals t on t.player_id=sid
        where coalesce(t.minutes,0)>0
      ),0) as starter_points,

      -- Een DNP is pas definitief wanneer de wedstrijd van de speler FT is.
      exists(
        select 1
        from unnest(l.starter_ids) sid
        join public.players p on p.id=sid
        left join totals t on t.player_id=sid
        where p.position='GK'
          and coalesce(t.minutes,0)=0
          and exists(
            select 1
            from public.fixtures f
            where f.gameweek_id=p_gameweek_id
              and f.status='FT'
              and (f.home_team=p.club_name or f.away_team=p.club_name)
          )
      ) as missing_gk,

      exists(
        select 1
        from unnest(l.starter_ids) sid
        join public.players p on p.id=sid
        left join totals t on t.player_id=sid
        where p.position<>'GK'
          and coalesce(t.minutes,0)=0
          and exists(
            select 1
            from public.fixtures f
            where f.gameweek_id=p_gameweek_id
              and f.status='FT'
              and (f.home_team=p.club_name or f.away_team=p.club_name)
          )
      ) as missing_outfield,

      coalesce(bg.points,0) as bench_gk_points,
      coalesce(bg.minutes,0) as bench_gk_minutes,
      coalesce(bo.points,0) as bench_outfield_points,
      coalesce(bo.minutes,0) as bench_outfield_minutes
    from public.gameweek_lineups l
    left join public.players cp on cp.id=l.captain_id
    left join totals ct on ct.player_id=l.captain_id
    left join totals bg on bg.player_id=l.bench_gk_id
    left join totals bo on bo.player_id=l.bench_outfield_id
    where l.gameweek_id=p_gameweek_id
  ), effective as (
    select
      *,
      case
        when captain_id is null then null
        when captain_minutes>0 then captain_id
        when captain_position='GK' and missing_gk and bench_gk_minutes>0
          then bench_gk_id
        when captain_position<>'GK' and missing_outfield and bench_outfield_minutes>0
          then bench_outfield_id
        else captain_id
      end as effective_captain_id
    from components
  ), calculated as (
    select
      user_id,
      starter_points
      + case when missing_gk and bench_gk_minutes>0 then bench_gk_points else 0 end
      + case when missing_outfield and bench_outfield_minutes>0 then bench_outfield_points else 0 end
      - transfer_cost as points,
      jsonb_build_object(
        'keeper_substitution',missing_gk and bench_gk_minutes>0,
        'outfield_substitution',missing_outfield and bench_outfield_minutes>0,
        'maximum_outfield_substitutions',1,
        'bench_points_only_after_confirmed_dnp',true,
        'transfer_cost',transfer_cost,
        'effective_captain_id',effective_captain_id,
        'captain_substituted',
          captain_id is not null
          and effective_captain_id is distinct from captain_id
      ) as breakdown
    from effective
  )
  insert into public.gameweek_scores(gameweek_id,user_id,points,breakdown,calculated_at)
  select p_gameweek_id,user_id,points,breakdown,now()
  from calculated
  on conflict(gameweek_id,user_id) do update set
    points=excluded.points,
    breakdown=excluded.breakdown,
    calculated_at=now();

  update public.teams t
  set total_points=coalesce(x.points,0)
  from (
    select user_id,sum(points) points
    from public.gameweek_scores
    group by user_id
  ) x
  where t.user_id=x.user_id;
end;
$$;

revoke all on function public.recalculate_gameweek_scores(bigint) from public,anon,authenticated;
grant execute on function public.recalculate_gameweek_scores(bigint) to service_role;


-- Returntype wordt uitgebreid, dus eerst droppen.
drop function if exists public.public_manager_visible_lineup(uuid);

create function public.public_manager_visible_lineup(p_manager uuid)
returns table(
  manager_id uuid,
  manager_name text,
  team_name text,
  squad_ids text[],
  starter_ids text[],
  bench_gk_id text,
  bench_outfield_id text,
  captain_id text,
  gameweek_number integer,
  lineup_source text,
  locked_at timestamptz,
  gameweek_points numeric,
  total_points numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_first_fantasy_week boolean;
  v_current_gameweek_id bigint;
  v_current_gameweek integer;
begin
  if v_user is null then
    raise exception 'Log eerst in.';
  end if;

  select not exists(select 1 from public.gameweek_lineups)
  into v_first_fantasy_week;

  select w.gameweek_id,w.gameweek_number
  into v_current_gameweek_id,v_current_gameweek
  from public.current_edit_window() w
  limit 1;

  -- Eigen ploeg: huidige selectie + actuele speeldagscore.
  if p_manager=v_user then
    return query
    select
      t.user_id,
      p.display_name,
      t.team_name,
      coalesce(t.squad_ids,'{}'::text[]),
      coalesce((
        select array_agg(x.id order by x.ord)
        from unnest(coalesce(t.squad_ids,'{}'::text[])) with ordinality x(id,ord)
        where x.id is distinct from t.bench_gk_id
          and x.id is distinct from t.bench_outfield_id
      ),'{}'::text[]),
      t.bench_gk_id,
      t.bench_outfield_id,
      t.captain_id,
      v_current_gameweek,
      'own-current'::text,
      null::timestamptz,
      coalesce((
        select s.points
        from public.gameweek_scores s
        where s.user_id=t.user_id and s.gameweek_id=v_current_gameweek_id
      ),0)::numeric,
      coalesce(t.total_points,0)::numeric
    from public.teams t
    join public.profiles p on p.id=t.user_id
    where t.user_id=p_manager;
    return;
  end if;

  -- Eerste fantasyweek: huidige ploeg mag zichtbaar zijn.
  if v_first_fantasy_week then
    return query
    select
      t.user_id,
      p.display_name,
      t.team_name,
      coalesce(t.squad_ids,'{}'::text[]),
      coalesce((
        select array_agg(x.id order by x.ord)
        from unnest(coalesce(t.squad_ids,'{}'::text[])) with ordinality x(id,ord)
        where x.id is distinct from t.bench_gk_id
          and x.id is distinct from t.bench_outfield_id
      ),'{}'::text[]),
      t.bench_gk_id,
      t.bench_outfield_id,
      t.captain_id,
      v_current_gameweek,
      'first-week-current'::text,
      null::timestamptz,
      coalesce((
        select s.points
        from public.gameweek_scores s
        where s.user_id=t.user_id and s.gameweek_id=v_current_gameweek_id
      ),0)::numeric,
      coalesce(t.total_points,0)::numeric
    from public.teams t
    join public.profiles p on p.id=t.user_id
    where t.user_id=p_manager
      and cardinality(coalesce(t.squad_ids,'{}'::text[]))=8;
    return;
  end if;

  -- Vanaf week 2: laatste vastgezette zichtbare lineup + score van die week.
  return query
  select
    l.user_id,
    p.display_name,
    t.team_name,
    l.squad_ids,
    l.starter_ids,
    l.bench_gk_id,
    l.bench_outfield_id,
    l.captain_id,
    g.number,
    'locked'::text,
    l.locked_at,
    coalesce(s.points,0)::numeric,
    coalesce(t.total_points,0)::numeric
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  join public.profiles p on p.id=l.user_id
  join public.teams t on t.user_id=l.user_id
  left join public.gameweek_scores s
    on s.gameweek_id=l.gameweek_id and s.user_id=l.user_id
  where l.user_id=p_manager
  order by g.season desc,g.number desc,l.locked_at desc
  limit 1;
end;
$$;

revoke all on function public.public_manager_visible_lineup(uuid) from public,anon;
grant execute on function public.public_manager_visible_lineup(uuid) to authenticated;


-- Meteen bestaande fantasy-scores opnieuw toepassen met de strikte bankregel.
do $$
declare
  g record;
begin
  for g in select id from public.gameweeks order by id loop
    perform public.recalculate_gameweek_scores(g.id);
  end loop;
end
$$;
