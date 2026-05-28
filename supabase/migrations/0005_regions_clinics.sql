-- Regions and clinics provide geographic scope for RLS filtering and supervisor access control.

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null default 'Nigeria',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  region_id uuid references public.regions(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Foreign key constraints from users and cases to regions/clinics
-- (FK not added retroactively to avoid breaking existing data; enforced via application logic and RLS)

alter table public.regions enable row level security;
alter table public.clinics enable row level security;

-- All authenticated users may read regions and clinics (needed for UI dropdowns and location labelling).
create policy "regions_read_authenticated" on public.regions
  for select using (auth.role() = 'authenticated');

create policy "clinics_read_authenticated" on public.clinics
  for select using (auth.role() = 'authenticated');

-- Only admins may insert/update regions and clinics.
create policy "regions_admin_write" on public.regions
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "clinics_admin_write" on public.clinics
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
