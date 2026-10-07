-- 015: privécompetities, managernamen in het klassement en ploegen na deadline.

create table if not exists public.private_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.private_league_members (
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);

create table if not exists public.private_league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (league_id,invitee_id)
);

create index if not exists private_league_members_user_idx on public.private_league_members(user_id);
create index if not exists private_league_invites_user_idx on public.private_league_invites(invitee_id,status);

alter table public.private_leagues enable row level security;
alter table public.private_league_members enable row level security;
alter table public.private_league_invites enable row level security;
revoke all on public.private_leagues,public.private_league_members,public.private_league_invites from anon,authenticated;

create or replace function public.create_private_league(p_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_league uuid;
  v_name text := trim(coalesce(p_name,''));
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;
  if char_length(v_name) not between 1 and 40 then
    raise exception 'Kies een competitienaam van 1 tot 40 tekens.';
  end if;

  insert into public.private_leagues(name,owner_id)
  values(v_name,v_user)
  returning id into v_league;

  insert into public.private_league_members(league_id,user_id,role)
  values(v_league,v_user,'owner');
  return v_league;
end;
$$;

create or replace function public.invite_to_private_league(p_league uuid,p_manager_name text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_invitee uuid;
  v_invite uuid;
  v_matches integer;
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;
  if not exists(select 1 from public.private_leagues where id=p_league and owner_id=v_user) then
    raise exception 'Alleen de eigenaar kan managers uitnodigen.';
  end if;

  select count(*) into v_matches
  from public.profiles
  where lower(trim(display_name))=lower(trim(coalesce(p_manager_name,'')));
  if v_matches=0 then raise exception 'Geen manager met deze gebruikersnaam gevonden.'; end if;
  if v_matches>1 then raise exception 'Deze gebruikersnaam is niet uniek. Vraag de manager om een unieke naam.'; end if;
  select id into v_invitee
  from public.profiles
  where lower(trim(display_name))=lower(trim(coalesce(p_manager_name,'')))
  limit 1;
  if v_invitee=v_user then raise exception 'Je bent al eigenaar van deze competitie.'; end if;
  if exists(select 1 from public.private_league_members where league_id=p_league and user_id=v_invitee) then
    raise exception 'Deze manager zit al in de competitie.';
  end if;

  insert into public.private_league_invites(league_id,invitee_id,invited_by,status,created_at,responded_at)
  values(p_league,v_invitee,v_user,'pending',now(),null)
  on conflict (league_id,invitee_id) do update
    set invited_by=excluded.invited_by,status='pending',created_at=now(),responded_at=null
  returning id into v_invite;
  return v_invite;
end;
$$;

create or replace function public.respond_private_league_invite(p_invite uuid,p_accept boolean)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user uuid := auth.uid();
  v_row public.private_league_invites%rowtype;
begin
  if v_user is null then raise exception 'Log eerst in.'; end if;
  select * into v_row from public.private_league_invites where id=p_invite for update;
  if not found or v_row.invitee_id<>v_user or v_row.status<>'pending' then
    raise exception 'Deze uitnodiging is niet meer geldig.';
  end if;

  update public.private_league_invites
  set status=case when p_accept then 'accepted' else 'declined' end,responded_at=now()
  where id=p_invite;
  if p_accept then
    insert into public.private_league_members(league_id,user_id,role)
    values(v_row.league_id,v_user,'member')
    on conflict (league_id,user_id) do nothing;
  end if;
end;
$$;

create or replace function public.delete_private_league(p_league uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Log eerst in.'; end if;
  delete from public.private_leagues where id=p_league and owner_id=auth.uid();
  if not found then raise exception 'Alleen de eigenaar kan deze competitie verwijderen.'; end if;
end;
$$;

create or replace function public.my_private_leagues()
returns table(id uuid,name text,owner_id uuid,owner_name text,is_owner boolean,member_count bigint)
language sql
stable
security definer
set search_path=public
as $$
  select l.id,l.name,l.owner_id,p.display_name,l.owner_id=auth.uid(),count(all_members.user_id)
  from public.private_league_members mine
  join public.private_leagues l on l.id=mine.league_id
  join public.profiles p on p.id=l.owner_id
  left join public.private_league_members all_members on all_members.league_id=l.id
  where mine.user_id=auth.uid()
  group by l.id,l.name,l.owner_id,p.display_name
  order by l.created_at,l.name;
$$;

create or replace function public.my_private_league_invites()
returns table(invite_id uuid,league_id uuid,league_name text,owner_name text,invited_at timestamptz)
language sql
stable
security definer
set search_path=public
as $$
  select i.id,l.id,l.name,p.display_name,i.created_at
  from public.private_league_invites i
  join public.private_leagues l on l.id=i.league_id
  join public.profiles p on p.id=l.owner_id
  where i.invitee_id=auth.uid() and i.status='pending'
  order by i.created_at desc;
$$;

drop function if exists public.public_leaderboard();
create function public.public_leaderboard()
returns table(
  rank bigint,
  manager_id uuid,
  manager_name text,
  team_name text,
  total_points numeric,
  latest_gameweek_number integer,
  latest_gameweek_points numeric
)
language sql
stable
security definer
set search_path=public
as $$
  select
    row_number() over(order by t.total_points desc,p.display_name,t.user_id),
    t.user_id,p.display_name,t.team_name,t.total_points,
    latest.gameweek_number,latest.points
  from public.teams t
  join public.profiles p on p.id=t.user_id
  left join lateral (
    select g.number as gameweek_number,s.points
    from public.gameweek_scores s
    join public.gameweeks g on g.id=s.gameweek_id
    where s.user_id=t.user_id
    order by g.season desc,g.number desc
    limit 1
  ) latest on true
  order by t.total_points desc,p.display_name,t.user_id;
$$;

create or replace function public.private_league_leaderboard(p_league uuid)
returns table(
  rank bigint,
  manager_id uuid,
  manager_name text,
  team_name text,
  total_points numeric,
  latest_gameweek_number integer,
  latest_gameweek_points numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if auth.uid() is null or not exists(
    select 1 from public.private_league_members where league_id=p_league and user_id=auth.uid()
  ) then raise exception 'Deze privécompetitie is alleen zichtbaar voor leden.'; end if;

  return query
  select
    row_number() over(order by t.total_points desc,p.display_name,t.user_id),
    t.user_id,p.display_name,t.team_name,t.total_points,
    latest.gameweek_number,latest.points
  from public.private_league_members m
  join public.teams t on t.user_id=m.user_id
  join public.profiles p on p.id=t.user_id
  left join lateral (
    select g.number as gameweek_number,s.points
    from public.gameweek_scores s
    join public.gameweeks g on g.id=s.gameweek_id
    where s.user_id=t.user_id
    order by g.season desc,g.number desc
    limit 1
  ) latest on true
  where m.league_id=p_league
  order by t.total_points desc,p.display_name,t.user_id;
end;
$$;

drop function if exists public.public_manager_history(uuid);
create function public.public_manager_history(p_manager uuid)
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
security definer
set search_path=public
as $$
  select
    g.number,coalesce(s.points,0),l.squad_ids,l.starter_ids,
    l.bench_gk_id,l.bench_outfield_id,l.captain_id,
    coalesce(s.breakdown,'{}'::jsonb),l.locked_at
  from public.gameweek_lineups l
  join public.gameweeks g on g.id=l.gameweek_id
  left join public.gameweek_scores s on s.gameweek_id=l.gameweek_id and s.user_id=l.user_id
  where l.user_id=p_manager
    and (p_manager=auth.uid() or now()>=g.lock_at)
  order by g.season desc,g.number desc;
$$;

revoke all on function public.create_private_league(text) from public,anon;
revoke all on function public.invite_to_private_league(uuid,text) from public,anon;
revoke all on function public.respond_private_league_invite(uuid,boolean) from public,anon;
revoke all on function public.delete_private_league(uuid) from public,anon;
revoke all on function public.my_private_leagues() from public,anon;
revoke all on function public.my_private_league_invites() from public,anon;
revoke all on function public.private_league_leaderboard(uuid) from public,anon;
revoke all on function public.public_manager_history(uuid) from public,anon;
revoke all on function public.public_leaderboard() from public;

grant execute on function public.create_private_league(text) to authenticated;
grant execute on function public.invite_to_private_league(uuid,text) to authenticated;
grant execute on function public.respond_private_league_invite(uuid,boolean) to authenticated;
grant execute on function public.delete_private_league(uuid) to authenticated;
grant execute on function public.my_private_leagues() to authenticated;
grant execute on function public.my_private_league_invites() to authenticated;
grant execute on function public.private_league_leaderboard(uuid) to authenticated;
grant execute on function public.public_manager_history(uuid) to authenticated;
grant execute on function public.public_leaderboard() to anon,authenticated;
