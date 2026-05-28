-- Performance indexes required by PRD §21.
-- These support dashboard filters, CHW case lookups, and sync deduplication queries.

create index if not exists cases_chw_user_id_idx on public.cases (chw_user_id);
create index if not exists cases_clinic_id_idx on public.cases (clinic_id);
create index if not exists cases_region_id_idx on public.cases (region_id);
create index if not exists cases_created_at_idx on public.cases (created_at desc);
create index if not exists cases_risk_level_idx on public.cases (risk_level);
create index if not exists cases_referral_required_idx on public.cases (referral_required);
create index if not exists cases_local_case_id_idx on public.cases (local_case_id);

-- Composite indexes for supervisor dashboard filters (region + date, clinic + date).
create index if not exists cases_region_created_idx on public.cases (region_id, created_at desc);
create index if not exists cases_clinic_created_idx on public.cases (clinic_id, created_at desc);

-- Audit log query patterns.
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

-- Triage rules version lookup.
create index if not exists triage_rules_active_idx on public.triage_rules (is_active, version);
