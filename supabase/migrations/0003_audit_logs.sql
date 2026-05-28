create table if not exists public.audit_logs (
  id uuid primary key,
  actor_user_id uuid not null,
  actor_role text not null check (actor_role in ('chw','supervisor','admin')),
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_actor_user_id on public.audit_logs(actor_user_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);

alter table public.audit_logs enable row level security;

create policy "supervisor_admin_read_audit_logs" on public.audit_logs
for select
using ((auth.jwt() -> 'user_metadata' ->> 'role') in ('supervisor','admin'));

