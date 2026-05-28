create table if not exists public.facility_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  facility_name text not null,
  clinic_id uuid references public.clinics(id),
  pin_hash text,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.users(id),
  created_at timestamptz default now()
);
alter table public.facility_codes enable row level security;
create policy "facility_codes_admin_manage" on public.facility_codes
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role in ('supervisor','admin'))
  );
create index if not exists facility_codes_code_idx on public.facility_codes(code);
