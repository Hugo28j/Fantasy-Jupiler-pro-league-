-- Houd afzonderlijk bij of opstelling/bank/wisselmetadata al uit Sorare is opgeslagen.
alter table public.fixtures
  add column if not exists details_processed boolean not null default false;

create index if not exists fixtures_details_processed_idx
  on public.fixtures (details_processed, status, gameweek_id);
