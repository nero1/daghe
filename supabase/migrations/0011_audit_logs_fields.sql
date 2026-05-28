-- Migration 0011: Bring audit_logs schema up to PRD §12.5 requirements
--
-- PRD §12.5 specifies the following columns for audit_logs:
--   id, actor_user_id, action, target_type, target_id,
--   metadata, ip_address, user_agent, created_at
--
-- Migration 0003 created the table with: id, actor_user_id, actor_role,
-- action, payload, created_at. The existing payload column is retained for
-- backward compatibility. All new columns are nullable so that existing rows
-- (which lack these values) remain valid.

-- target_type: the kind of resource affected (e.g. "case", "user", "export")
alter table public.audit_logs
  add column if not exists target_type text;

-- target_id: the primary-key value of the affected resource
alter table public.audit_logs
  add column if not exists target_id text;

-- metadata: structured context for the event; supplements the older payload
-- column without removing it (payload stays for any consumers that rely on it)
alter table public.audit_logs
  add column if not exists metadata jsonb;

-- ip_address: originating IP recorded by the API layer at event time
alter table public.audit_logs
  add column if not exists ip_address text;

-- user_agent: HTTP User-Agent string recorded by the API layer
alter table public.audit_logs
  add column if not exists user_agent text;

comment on column public.audit_logs.target_type is 'Resource type affected by the action (e.g. case, user, export) — PRD §12.5';
comment on column public.audit_logs.target_id   is 'Primary key of the affected resource — PRD §12.5';
comment on column public.audit_logs.metadata    is 'Structured event context (supplements legacy payload column) — PRD §12.5';
comment on column public.audit_logs.ip_address  is 'Originating IP address recorded by the API layer — PRD §12.5';
comment on column public.audit_logs.user_agent  is 'HTTP User-Agent string recorded by the API layer — PRD §12.5';

-- Indexes to support audit queries filtered by resource type / ID.
create index if not exists idx_audit_logs_target_type on public.audit_logs(target_type);
create index if not exists idx_audit_logs_target_id   on public.audit_logs(target_id);
