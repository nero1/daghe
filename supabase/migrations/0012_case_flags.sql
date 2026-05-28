-- Migration 0012: Case flagging for supervisor escalation (PRD §8.5)
--
-- Supervisors and admins need to mark cases as requiring escalation. This
-- migration adds a flag state (is_flagged, flag_reason) and an audit trail of
-- who flagged the case and when (flagged_by, flagged_at).

-- Add flagging columns to cases.
alter table public.cases
  add column if not exists is_flagged  boolean     not null default false,
  add column if not exists flag_reason text,
  add column if not exists flagged_by  uuid        references public.users(id) on delete set null,
  add column if not exists flagged_at  timestamptz;

comment on column public.cases.is_flagged  is 'Whether this case has been flagged for escalation — PRD §8.5';
comment on column public.cases.flag_reason is 'Free-text reason provided by the supervisor when flagging — PRD §8.5';
comment on column public.cases.flagged_by  is 'User ID of the supervisor/admin who set the flag — PRD §8.5';
comment on column public.cases.flagged_at  is 'Timestamp at which the flag was last set — PRD §8.5';

-- Index so dashboards can efficiently list all flagged cases.
create index if not exists idx_cases_is_flagged on public.cases(is_flagged);

-- RLS policy: supervisors and admins can update the flagging columns on cases
-- that fall within their scope (same clinic or region for supervisors; any
-- case for admins). CHWs cannot flag cases.
--
-- The helper functions current_user_role(), current_user_clinic_id(), and
-- current_user_region_id() were introduced in migration 0004.
drop policy if exists "cases_flag_by_supervisor_admin" on public.cases;
create policy "cases_flag_by_supervisor_admin"
on public.cases
for update
to authenticated
using (
  public.current_user_role() in ('supervisor', 'admin')
  and (
    public.current_user_role() = 'admin'
    or clinic_id  = public.current_user_clinic_id()
    or region_id  = public.current_user_region_id()
  )
)
with check (
  public.current_user_role() in ('supervisor', 'admin')
  and (
    public.current_user_role() = 'admin'
    or clinic_id  = public.current_user_clinic_id()
    or region_id  = public.current_user_region_id()
  )
);
