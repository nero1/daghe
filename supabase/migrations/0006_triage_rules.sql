-- Triage rules versioning allows the decision tree to be updated server-side
-- and clients to detect when a cached version is stale.

create table if not exists public.triage_rules (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  language text not null default 'en',
  rules_json jsonb not null default '{}',
  is_active boolean not null default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  unique (version, language)
);

alter table public.triage_rules enable row level security;

-- All authenticated users may read active triage rules (needed for offline cache refresh).
create policy "triage_rules_read_authenticated" on public.triage_rules
  for select using (auth.role() = 'authenticated' and is_active = true);

-- Only admins may manage triage rules.
create policy "triage_rules_admin_write" on public.triage_rules
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- Seed the initial rule version matching the shared package evaluator.
insert into public.triage_rules (version, language, rules_json, is_active)
values ('v2', 'en', '{"evaluator": "shared-package", "clusters": ["fever","breathing","vomiting_diarrhea","confusion_collapse","skin_rash","other"]}', true)
on conflict (version, language) do nothing;
