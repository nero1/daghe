-- Migration 0013: Soft-delete and anonymization support (PRD §11.6)
--
-- PRD §11.6 requires that patient data can be deleted or anonymized on request
-- (e.g. right-to-erasure). Rather than hard-deleting rows (which breaks audit
-- trails and referential integrity), we implement soft-delete via deleted_at
-- and anonymization tracking via anonymized_at. Filtering logic is updated in
-- the select policy so soft-deleted cases are invisible to normal reads.

-- Add soft-delete / anonymization tracking columns to cases.
alter table public.cases
  add column if not exists deleted_at    timestamptz,
  add column if not exists anonymized_at timestamptz;

comment on column public.cases.deleted_at    is 'When the case was soft-deleted; null means not deleted — PRD §11.6';
comment on column public.cases.anonymized_at is 'When PII fields were anonymized; null means not yet anonymized — PRD §11.6';

-- Partial index: only indexes rows that have been soft-deleted, keeping the
-- index small and making "find deleted cases" queries efficient.
create index if not exists idx_cases_deleted_at
  on public.cases(deleted_at)
  where deleted_at is not null;

-- Update the select policy so soft-deleted cases are excluded from all normal
-- reads. We recreate the policy from migration 0004 with the extra condition.
-- Using DROP … IF EXISTS + CREATE ensures re-runnability.
drop policy if exists "cases_select_by_scope" on public.cases;
create policy "cases_select_by_scope"
on public.cases
for select
to authenticated
using (
  -- Exclude soft-deleted cases from all normal reads (PRD §11.6).
  deleted_at is null
  and (
    (public.current_user_role() = 'chw' and chw_user_id = auth.uid())
    or (
      public.current_user_role() = 'supervisor'
      and (clinic_id = public.current_user_clinic_id() or region_id = public.current_user_region_id())
    )
    or public.current_user_role() = 'admin'
  )
);

-- Helper function: anonymize PII fields on a single case.
-- Clears patient_sex and all GPS coordinates, then records anonymized_at.
-- Only admins can invoke this via the existing RLS update policy; the function
-- itself uses SECURITY INVOKER so the caller's permissions are checked.
create or replace function public.anonymize_case(case_id uuid)
returns void
language sql
security invoker
as $$
  update public.cases
  set
    patient_sex       = null,
    location_lat      = null,
    location_lng      = null,
    location_accuracy = null,
    anonymized_at     = now()
  where id = case_id;
$$;

revoke all on function public.anonymize_case(uuid) from public;
grant execute on function public.anonymize_case(uuid) to authenticated;

comment on function public.anonymize_case(uuid) is
  'Wipe PII fields (patient_sex, GPS) from a case and record anonymized_at. '
  'SECURITY INVOKER — the caller must have update permission on the row (admin only via RLS). '
  'PRD §11.6';
