create table if not exists public.modules (
  id text primary key,
  version text not null,
  display_name text not null,
  enabled boolean not null default true,
  model_version text not null default '1.0.0',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Seed the cervical-via module
insert into public.modules (id, version, display_name, enabled, model_version)
values ('cervical-via', '1.0.0', 'Cervical Cancer Screening (VIA)', true, '1.0.0')
on conflict (id) do nothing;

create table if not exists public.admin_config (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.users(id),
  updated_at timestamptz default now()
);
-- Seed default AI provider toggles
insert into public.admin_config (key, value) values
  ('gemini_enabled', 'true'),
  ('openai_enabled', 'true'),
  ('deepseek_enabled', 'true'),
  ('image_storage_enabled', 'false')
on conflict (key) do nothing;

alter table public.modules enable row level security;
alter table public.admin_config enable row level security;
create policy "modules_public_read" on public.modules for select using (true);
create policy "admin_config_admin_only" on public.admin_config
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
