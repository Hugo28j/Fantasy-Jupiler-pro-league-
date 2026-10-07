-- 016: netto transferperiode + één knop om alle transfers te resetten.
--
-- save_my_team vergelijkt de huidige definitieve selectie al met de vorige
-- vastgezette gameweek. Daardoor telt A -> B -> A als 0 transfers en A -> B
-- als 1 transfer, ongeacht hoeveel tussenstappen de manager maakte.
-- Deze RPC herstelt die vorige vastgezette selectie, bank en captain in één keer.

create or replace function public.reset_my_transfers()
returns table(
  restored boolean,
  gameweek_number integer,
  squad_ids text[],
  bench_gk_id text,
  bench_outfield_id text,
  captain_id text,
  budget numeric
)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_window record;
  v_baseline record;
  v_current_squad text[] := '{}'::text[];
  v_current_budget numeric(8,1) := 125.0;
  v_sell_value numeric(8,1) := 0;
  v_buy_value numeric(8,1) := 0;
  v_new_budget numeric(8,1) := 125.0;
begin
  if v_user is null then
    raise exception 'Log eerst in.';
  end if;

  select * into v_window
  from public.current_edit_window();

  if not found or v_window.gameweek_id is null then
    raise exception 'Er is momenteel geen actieve transferperiode.';
  end if;

  if coalesce(v_window.locked,false) then
    raise exception 'De opstelling is vergrendeld: speeldag % is begonnen.',v_window.gameweek_number;
  end if;

  select
    l.squad_ids,
    l.bench_gk_id,
    l.bench_outfield_id,
    l.captain_id
  into v_baseline
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  where l.user_id=v_user
    and l.gameweek_id<>v_window.gameweek_id
  order by g.season desc,g.number desc
  limit 1;

  if not found or coalesce(cardinality(v_baseline.squad_ids),0)<>8 then
    raise exception 'Er is nog geen vorige vastgezette selectie om te herstellen.';
  end if;

  select coalesce(t.squad_ids,'{}'::text[]),coalesce(t.budget,125.0)
  into v_current_squad,v_current_budget
  from public.teams t
  where t.user_id=v_user
  for update;

  if not found then
    raise exception 'Er is nog geen team opgeslagen.';
  end if;

  select coalesce(sum(p.price),0)
  into v_sell_value
  from public.players p
  where p.id=any(v_current_squad)
    and not (p.id=any(v_baseline.squad_ids));

  select coalesce(sum(p.price),0)
  into v_buy_value
  from public.players p
  where p.id=any(v_baseline.squad_ids)
    and not (p.id=any(v_current_squad));

  v_new_budget := round((v_current_budget+v_sell_value-v_buy_value)::numeric,1);

  if v_new_budget < 0 then
    raise exception 'Je hebt onvoldoende cash om de vorige selectie tegen de huidige marktprijzen te herstellen.';
  end if;

  update public.teams
  set
    squad_ids=v_baseline.squad_ids,
    bench_gk_id=v_baseline.bench_gk_id,
    bench_outfield_id=v_baseline.bench_outfield_id,
    captain_id=case
      when v_baseline.captain_id=any(v_baseline.squad_ids) then v_baseline.captain_id
      else null
    end,
    budget=v_new_budget,
    updated_at=now()
  where user_id=v_user;

  insert into public.team_transfer_plans(
    user_id,gameweek_id,transfers_used,free_transfers,point_cost,updated_at
  )
  values(v_user,v_window.gameweek_id,0,2,0,now())
  on conflict(user_id,gameweek_id) do update set
    transfers_used=0,
    free_transfers=2,
    point_cost=0,
    updated_at=now();

  return query
  select
    true,
    v_window.gameweek_number,
    v_baseline.squad_ids,
    v_baseline.bench_gk_id,
    v_baseline.bench_outfield_id,
    case
      when v_baseline.captain_id=any(v_baseline.squad_ids) then v_baseline.captain_id
      else null
    end,
    v_new_budget::numeric;
end;
$$;

revoke all on function public.reset_my_transfers() from public,anon;
grant execute on function public.reset_my_transfers() to authenticated;
