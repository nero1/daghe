create table if not exists public.ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  encounter_id uuid references public.encounters(id),
  provider text not null,
  task_type text not null default 'via_classification',
  key_type text not null check (key_type in ('platform','byok')),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  estimated_cost_usd numeric(20,8) not null default 0,
  created_at timestamptz default now()
);
alter table public.ai_usage_log enable row level security;
-- Admins and supervisors can read usage logs; inserting done via service role
create policy "ai_usage_log_supervisor_read" on public.ai_usage_log
  for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role in ('supervisor','admin')
    )
  );
create index if not exists ai_usage_log_user_id_idx on public.ai_usage_log(user_id);
create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log(created_at);
