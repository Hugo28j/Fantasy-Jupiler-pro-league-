-- Allow the sync to distinguish Sorare's published official XI
-- from ordinary pre-match starter probabilities.

alter table public.fixture_start_predictions
  drop constraint if exists fixture_start_predictions_source_check;

alter table public.fixture_start_predictions
  add constraint fixture_start_predictions_source_check
  check (source = any (array['sorare'::text,'manual'::text,'sorare-lineup'::text]));
