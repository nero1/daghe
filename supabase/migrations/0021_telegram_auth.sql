-- Add Telegram login fields to users table
alter table public.users
  add column if not exists telegram_id text unique,
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists photo_url text;

create index if not exists users_telegram_id_idx on public.users(telegram_id);

-- Add PIN auth fields to facility_codes (allows facility-device shared login)
-- pin_hash already added in 0019; this migration is a no-op if 0019 was already applied
-- with the pin_hash column. Safe to run multiple times due to IF NOT EXISTS.
alter table public.facility_codes
  add column if not exists pin_hash text;
