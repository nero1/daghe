-- Migration 0010: Add GPS location columns to cases table
--
-- PRD §6.3 requires the sync API to persist GPS coordinates captured at
-- case creation time. The sync endpoint already sends location_lat,
-- location_lng, and location_accuracy but the DB was rejecting them because
-- the columns didn't exist. All columns are nullable — location capture is
-- best-effort and may be absent (e.g. indoor use, GPS disabled).

alter table public.cases
  add column if not exists location_lat      float8,
  add column if not exists location_lng      float8,
  add column if not exists location_accuracy float8;

comment on column public.cases.location_lat      is 'WGS-84 latitude captured at case creation (degrees)';
comment on column public.cases.location_lng      is 'WGS-84 longitude captured at case creation (degrees)';
comment on column public.cases.location_accuracy is 'Horizontal accuracy of the GPS fix (metres)';
