create table if not exists public.encounters (
  id uuid primary key,
  idempotency_key text not null unique,
  chw_user_id uuid references public.users(id),
  facility_id uuid,
  module_id text not null default 'cervical-via',
  patient_age_band text not null,
  screening_context text not null check (screening_context in ('routine','referral','hpv-positive-triage')),
  classification text not null check (classification in ('POSITIVE','NEGATIVE','REFER')),
  confidence_band text not null check (confidence_band in ('HIGH','MODERATE','LOW','REFERENCE_ONLY')),
  confidence_score numeric(5,4),
  inference_method text not null check (inference_method in ('tflite','gemini','gpt4o','rule-based','reference')),
  recommended_action text not null,
  referral_required boolean not null default false,
  quality_override boolean not null default false,
  action_taken text check (action_taken in ('treated','referred','monitored','declined')),
  image_hash text,
  app_version text not null,
  module_version text not null,
  device_local_time timestamptz not null,
  synced_at timestamptz default now(),
  is_demo boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz default now()
);
alter table public.encounters enable row level security;
create index if not exists encounters_chw_user_id_idx on public.encounters(chw_user_id);
create index if not exists encounters_facility_id_idx on public.encounters(facility_id);
create index if not exists encounters_created_at_idx on public.encounters(created_at);
