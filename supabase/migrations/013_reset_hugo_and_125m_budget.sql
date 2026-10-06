-- 013: startbudget €125M + reset van het testaccount "Hugo".
--
-- De Auth-gebruiker en login blijven bestaan.
-- Alleen fantasydata wordt gereset:
--   team/selectie, bank, cash, leaderboardpunten,
--   vastgezette opstellingen, speeldagscores en transferplannen.
--
-- Veiligheid: als er niet EXACT één profiel met display_name 'Hugo' bestaat,
-- stopt de migratie zonder iemand te resetten.

alter table public.teams
  alter column budget set default 125.0;

do $$
declare
  v_user uuid;
  v_count integer;
begin
  select count(*)
  into v_count
  from public.profiles
  where lower(trim(display_name))='hugo';

  if v_count = 0 then
    raise exception 'Geen profiel met naam Hugo gevonden. Er is niets gereset.';
  elsif v_count > 1 then
    raise exception 'Meerdere profielen met naam Hugo gevonden. Reset afgebroken voor veiligheid.';
  end if;

  select id
  into v_user
  from public.profiles
  where lower(trim(display_name))='hugo'
  limit 1;

  delete from public.team_transfer_plans
  where user_id=v_user;

  delete from public.gameweek_scores
  where user_id=v_user;

  delete from public.gameweek_lineups
  where user_id=v_user;

  update public.teams
  set
    team_name='Mijn Fantasy Team',
    squad_ids='{}'::text[],
    bench_gk_id=null,
    bench_outfield_id=null,
    budget=125.0,
    total_points=0,
    updated_at=now()
  where user_id=v_user;

  -- Voor het geval het profiel wel bestaat maar de teamrij ooit ontbrak.
  insert into public.teams(
    user_id,team_name,squad_ids,bench_gk_id,bench_outfield_id,budget,total_points,updated_at
  )
  values(
    v_user,'Mijn Fantasy Team','{}'::text[],null,null,125.0,0,now()
  )
  on conflict(user_id) do nothing;
end;
$$;
