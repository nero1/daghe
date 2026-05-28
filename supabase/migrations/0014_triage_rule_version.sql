-- Migration 0014: Client triage rule version tracking
--
-- The decision tree update prompt feature (PRD §7.4) requires the server to
-- know which rule version each device is currently running so it can prompt
-- CHWs to update when a new version is published.
--
-- This table contains no personal data — only a stable device identifier and
-- version string — so a permissive RLS policy is appropriate.

create table if not exists public.client_rule_versions (
  device_id    text        not null,
  rule_version text        not null,
  last_seen_at timestamptz not null default now(),
  primary key (device_id)
);

comment on table  public.client_rule_versions              is 'Tracks the triage rule version last reported by each client device — PRD §7.4';
comment on column public.client_rule_versions.device_id    is 'Stable anonymous device identifier (generated on first app launch)';
comment on column public.client_rule_versions.rule_version is 'Semantic version string of the triage rule bundle on the device';
comment on column public.client_rule_versions.last_seen_at is 'Timestamp of the most recent sync that reported this version';

alter table public.client_rule_versions enable row level security;

-- Any authenticated user (CHW, supervisor, admin) can upsert their own device
-- record. This table holds no PII so there is no read-access concern.
drop policy if exists "client_rule_versions_upsert_own" on public.client_rule_versions;
create policy "client_rule_versions_upsert_own"
on public.client_rule_versions
for all
using (true)
with check (true);
