-- 025: veilige zichtbaarheid van klassement-opstellingen.
--
-- Regels:
-- 1) Je eigen huidige ploeg is altijd zichtbaar voor jezelf.
-- 2) Tijdens de allereerste fantasyweek (nog geen enkele vastgezette lineup)
--    zijn huidige ploegen van andere managers zichtbaar.
-- 3) Vanaf de tweede fantasyweek ziet een tegenstander vóór de deadline alleen
--    de laatst vastgezette opstelling.
-- 4) Zodra een nieuwe deadline passeert en lock_gameweek de nieuwe lineup
--    vastzet, wordt automatisch die nieuwste opstelling zichtbaar.
--
-- Zo kan de frontend nooit via deze RPC een transfer/opstelling vóór de
-- deadline van een tegenstander uitlezen.

create or replace function public.public_manager_visible_lineup(p_manager uuid)
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
  locked_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_first_fantasy_week boolean;
  v_current_gameweek integer;
begin
  if v_user is null then
    raise exception 'Log eerst in.';
  end if;

  select not exists(select 1 from public.gameweek_lineups)
  into v_first_fantasy_week;

  select w.gameweek_number
  into v_current_gameweek
  from public.current_edit_window() w
  limit 1;

  -- Eigen ploeg: altijd de huidige selectie tonen.
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
      null::timestamptz
    from public.teams t
    join public.profiles p on p.id=t.user_id
    where t.user_id=p_manager;
    return;
  end if;

  -- Eerste fantasyweek: expliciete uitzondering zodat vrienden elkaars eerste
  -- ploeg al vóór de eerste deadline kunnen bekijken.
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
      null::timestamptz
    from public.teams t
    join public.profiles p on p.id=t.user_id
    where t.user_id=p_manager
      and cardinality(coalesce(t.squad_ids,'{}'::text[]))=8;
    return;
  end if;

  -- Vanaf de tweede fantasyweek: uitsluitend de laatst werkelijk vastgezette
  -- lineup. Nieuwe transfers blijven dus verborgen tot de deadline.
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
    l.locked_at
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  join public.profiles p on p.id=l.user_id
  join public.teams t on t.user_id=l.user_id
  where l.user_id=p_manager
  order by g.season desc,g.number desc,l.locked_at desc
  limit 1;
end;
$$;

revoke all on function public.public_manager_visible_lineup(uuid) from public,anon;
grant execute on function public.public_manager_visible_lineup(uuid) to authenticated;
