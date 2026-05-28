create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  role text not null check (role in ('chw','supervisor','admin')),
  name text,
  clinic_id uuid,
  region_id uuid,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.cases (
  id uuid primary key,
  local_case_id text not null,
  idempotency_key text not null unique,
  chw_user_id uuid not null,
  clinic_id uuid,
  region_id uuid,
  patient_age_range text not null,
  patient_sex text,
  symptoms jsonb not null,
  answers jsonb not null,
  triage_result jsonb not null,
  recommended_action text not null,
  risk_level text not null,
  referral_required boolean not null default false,
  decision_tree_version text not null,
  app_version text not null,
  created_at timestamptz default now(),
  synced_at timestamptz,
  unique (chw_user_id, local_case_id)
);

alter table public.cases enable row level security;

