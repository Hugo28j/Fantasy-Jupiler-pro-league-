-- 018: captain mag nooit op de bank staan + captain volgt een automatische invaller.
--
-- De frontend voorkomt dit ook. Deze triggers bewaken dezelfde regel in de database.
-- Captain geeft voorlopig nog geen puntenbonus; in de score-breakdown bewaren we wel
-- wie effectief captain werd wanneer de oorspronkelijke captain niet speelde.

create or replace function public.enforce_team_captain_is_starter()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.captain_id is not null then
    if not (new.captain_id=any(coalesce(new.squad_ids,'{}'::text[]))) then
      raise exception 'De captain moet in je selectie zitten.';
    end if;

    if new.captain_id=new.bench_gk_id or new.captain_id=new.bench_outfield_id then
      raise exception 'Een bankspeler kan geen captain zijn.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists teams_captain_must_start on public.teams;
create trigger teams_captain_must_start
before insert or update of squad_ids,bench_gk_id,bench_outfield_id,captain_id
on public.teams
for each row execute function public.enforce_team_captain_is_starter();


create or replace function public.enforce_lineup_captain_is_starter()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.captain_id is not null
     and not (new.captain_id=any(coalesce(new.starter_ids,'{}'::text[]))) then
    raise exception 'De captain moet in de basisopstelling staan.';
  end if;

  return new;
end;
$$;

drop trigger if exists gameweek_lineup_captain_must_start on public.gameweek_lineups;
create trigger gameweek_lineup_captain_must_start
before insert or update of starter_ids,captain_id
on public.gameweek_lineups
for each row execute function public.enforce_lineup_captain_is_starter();


create or replace function public.recalculate_gameweek_scores(p_gameweek_id bigint)
returns void
language plpgsql
security definer set search_path = public
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

      coalesce((
        select sum(coalesce(t.points,0))
        from unnest(l.starter_ids) sid
        left join totals t on t.player_id=sid
        where coalesce(t.minutes,0)>0
      ),0) as starter_points,

      exists(
        select 1
        from unnest(l.starter_ids) sid
        join public.players p on p.id=sid
        left join totals t on t.player_id=sid
        where p.position='GK' and coalesce(t.minutes,0)=0
      ) as missing_gk,

      exists(
        select 1
        from unnest(l.starter_ids) sid
        join public.players p on p.id=sid
        left join totals t on t.player_id=sid
        where p.position<>'GK' and coalesce(t.minutes,0)=0
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
