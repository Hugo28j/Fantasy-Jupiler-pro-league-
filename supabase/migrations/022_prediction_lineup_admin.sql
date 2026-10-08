-- 022: laat de vaste Hugo-admin ook toekomstige/prediction-opstellingen opslaan.
--
-- De security blijft identiek: alleen UUID's in fantasy_admin_users mogen deze
-- RPC uitvoeren. De zichtbare naam "Hugo" geeft dus geen rechten aan nieuwe accounts.
--
-- Migratie 019 vereiste dat de 11 spelers al in player_match_stats voor de
-- wedstrijd stonden. Dat kan bij een toekomstige wedstrijd nog niet. Voor
-- predictions valideren we daarom dat de fixture bestaat en dat alle 11 gekozen
-- player_id's bestaande spelers in de game zijn.

create or replace function public.admin_save_fixture_lineup_override(
  p_fixture_id bigint,
  p_side text,
  p_formation text,
  p_slots jsonb
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_def integer;
  v_mid integer;
  v_fwd integer;
  v_slot_count integer;
  v_distinct_count integer;
  v_gk_count integer;
  v_def_count integer;
  v_mid_count integer;
  v_fwd_count integer;
  v_known_count integer;
  v_fixture_exists boolean;
begin
  if not public.is_fantasy_admin() then
    raise exception 'Geen adminrechten.';
  end if;

  select exists(
    select 1 from public.fixtures where id=p_fixture_id
  ) into v_fixture_exists;

  if not v_fixture_exists then
    raise exception 'Wedstrijd bestaat niet.';
  end if;

  if p_side not in ('home','away') then
    raise exception 'Ongeldige zijde.';
  end if;

  if p_formation !~ '^[3-5]-[2-5]-[1-3]$' then
    raise exception 'Ongeldige formatie.';
  end if;

  v_def := split_part(p_formation,'-',1)::integer;
  v_mid := split_part(p_formation,'-',2)::integer;
  v_fwd := split_part(p_formation,'-',3)::integer;

  if v_def + v_mid + v_fwd <> 10 then
    raise exception 'Een formatie moet 10 veldspelers bevatten.';
  end if;

  if jsonb_typeof(p_slots) <> 'array' then
    raise exception 'Slots moeten een array zijn.';
  end if;

  select
    count(*),
    count(distinct item->>'player_id'),
    count(*) filter(where item->>'zone'='GK'),
    count(*) filter(where item->>'zone'='DEF'),
    count(*) filter(where item->>'zone'='MID'),
    count(*) filter(where item->>'zone'='FWD')
  into
    v_slot_count,v_distinct_count,v_gk_count,v_def_count,v_mid_count,v_fwd_count
  from jsonb_array_elements(p_slots) item;

  if v_slot_count <> 11 or v_distinct_count <> 11 then
    raise exception 'Kies exact 11 verschillende spelers.';
  end if;

  if v_gk_count <> 1
     or v_def_count <> v_def
     or v_mid_count <> v_mid
     or v_fwd_count <> v_fwd then
    raise exception 'De slots komen niet overeen met de gekozen formatie.';
  end if;

  select count(*)
  into v_known_count
  from public.players p
  where p.id in (
    select item->>'player_id'
    from jsonb_array_elements(p_slots) item
  );

  if v_known_count <> 11 then
    raise exception 'Minstens één gekozen speler bestaat niet in de game.';
  end if;

  insert into public.fixture_lineup_overrides(
    fixture_id,side,formation,slots,updated_by,updated_at
  )
  values(
    p_fixture_id,p_side,p_formation,p_slots,auth.uid(),now()
  )
  on conflict(fixture_id,side) do update set
    formation=excluded.formation,
    slots=excluded.slots,
    updated_by=excluded.updated_by,
    updated_at=now();
end;
$$;

revoke all on function public.admin_save_fixture_lineup_override(bigint,text,text,jsonb)
  from public,anon;
grant execute on function public.admin_save_fixture_lineup_override(bigint,text,text,jsonb)
  to authenticated;
