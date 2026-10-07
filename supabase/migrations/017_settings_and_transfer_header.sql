-- 017: instellingen + eerste-week-transfers in de header.
--
-- * teamnaam kan onafhankelijk van de lineupdeadline gewijzigd worden;
-- * leeg gelaten teamnaam valt terug op de gebruikersnaam;
-- * account kan alleen zichzelf verwijderen;
-- * transferstatus vertelt de frontend of de manager nog nooit een
--   vorige vastgezette ploeg had (dan zijn transfers onbeperkt = ∞).

create or replace function public.update_my_team_name(p_name text default null)
returns text
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_name,''));
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;

  if v_name='' then
    select trim(coalesce(display_name,''))
    into v_name
    from public.profiles
    where id=v_user;
  end if;

  if v_name='' then v_name := 'Mijn Fantasy Team'; end if;
  if char_length(v_name) > 28 then v_name := left(v_name,28); end if;

  update public.teams
  set team_name=v_name,updated_at=now()
  where user_id=v_user;

  if not found then
    insert into public.teams(user_id,team_name,budget)
    values(v_user,v_name,125.0);
  end if;

  return v_name;
end;
$$;

revoke all on function public.update_my_team_name(text) from public,anon;
grant execute on function public.update_my_team_name(text) to authenticated;


create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;
  delete from auth.users where id=v_user;
  if not found then raise exception 'Account niet gevonden.'; end if;
end;
$$;

revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;


drop function if exists public.my_transfer_status();

create function public.my_transfer_status()
returns table(
  gameweek_number integer,
  transfers_used integer,
  free_transfers integer,
  point_cost numeric,
  unlimited boolean,
  baseline_squad_ids text[]
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_window record;
  v_baseline text[];
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;

  select * into v_window from public.current_edit_window();

  if not found then
    return query select null::integer,0,2,0::numeric,true,null::text[];
    return;
  end if;

  select l.squad_ids
  into v_baseline
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  where l.user_id=v_user
    and l.gameweek_id<>v_window.gameweek_id
  order by g.season desc,g.number desc
  limit 1;

  if v_baseline is null then
    return query
    select v_window.gameweek_number,0,2,0::numeric,true,null::text[];
    return;
  end if;

  return query
  select
    v_window.gameweek_number,
    coalesce(p.transfers_used,0),
    2,
    coalesce(p.point_cost,0)::numeric,
    false,
    v_baseline
  from (select 1) x
  left join public.team_transfer_plans p
    on p.user_id=v_user and p.gameweek_id=v_window.gameweek_id;
end;
$$;

revoke all on function public.my_transfer_status() from public,anon;
grant execute on function public.my_transfer_status() to authenticated;
