-- 020: voorspelde basis-kans per komende wedstrijd.
--
-- Sorare kan deze tabel automatisch vullen zodra footballPlayingStatusOdds
-- opnieuw data teruggeeft. Handmatige voorspellingen uit GitHub blijven als
-- publieke fallback bestaan en worden client-side samengevoegd.

create table if not exists public.fixture_start_predictions (
  fixture_id bigint not null references public.fixtures(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  starter_probability smallint not null check(starter_probability between 0 and 100),
  reliability text,
  source text not null default 'sorare' check(source in ('sorare','manual')),
  updated_at timestamptz not null default now(),
  primary key(fixture_id,player_id)
);

create index if not exists fixture_start_predictions_player_idx
  on public.fixture_start_predictions(player_id,fixture_id);

alter table public.fixture_start_predictions enable row level security;

drop policy if exists "start predictions public read" on public.fixture_start_predictions;
create policy "start predictions public read"
on public.fixture_start_predictions
for select
using (true);

grant select on public.fixture_start_predictions to anon,authenticated;
