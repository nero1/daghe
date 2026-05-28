-- Least-privilege RLS hardening for users, cases, and audit_logs.

-- Helper functions for policy expressions.
create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.current_user_clinic_id()
returns uuid
language sql
stable
as $$
  select clinic_id from public.users where id = auth.uid()
$$;

create or replace function public.current_user_region_id()
returns uuid
language sql
stable
as $$
  select region_id from public.users where id = auth.uid()
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_clinic_id() from public;
revoke all on function public.current_user_region_id() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_clinic_id() to authenticated;
grant execute on function public.current_user_region_id() to authenticated;

alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.cases enable row level security;
alter table public.cases force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

-- USERS policies

drop policy if exists "users_select_self_or_privileged" on public.users;
create policy "users_select_self_or_privileged"
on public.users
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() in ('supervisor', 'admin')
);

drop policy if exists "users_update_self_profile_or_admin" on public.users;
create policy "users_update_self_profile_or_admin"
on public.users
for update
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() = 'admin'
)
with check (
  (
    id = auth.uid()
    and role = (select u.role from public.users u where u.id = auth.uid())
  )
  or public.current_user_role() = 'admin'
);

drop policy if exists "users_insert_admin_only" on public.users;
create policy "users_insert_admin_only"
on public.users
for insert
to authenticated
with check (public.current_user_role() = 'admin');

-- CASES policies

drop policy if exists "cases_insert_own" on public.cases;
create policy "cases_insert_own"
on public.cases
for insert
to authenticated
with check (
  (
    public.current_user_role() = 'chw'
    and chw_user_id = auth.uid()
  )
  or (
    public.current_user_role() in ('supervisor', 'admin')
    and (
      public.current_user_role() = 'admin'
      or clinic_id = public.current_user_clinic_id()
      or region_id = public.current_user_region_id()
    )
  )
);

drop policy if exists "cases_select_by_scope" on public.cases;
create policy "cases_select_by_scope"
on public.cases
for select
to authenticated
using (
  (public.current_user_role() = 'chw' and chw_user_id = auth.uid())
  or (
    public.current_user_role() = 'supervisor'
    and (clinic_id = public.current_user_clinic_id() or region_id = public.current_user_region_id())
  )
  or public.current_user_role() = 'admin'
);

drop policy if exists "cases_update_by_scope" on public.cases;
create policy "cases_update_by_scope"
on public.cases
for update
to authenticated
using (
  (public.current_user_role() = 'chw' and chw_user_id = auth.uid())
  or (
    public.current_user_role() = 'supervisor'
    and (clinic_id = public.current_user_clinic_id() or region_id = public.current_user_region_id())
  )
  or public.current_user_role() = 'admin'
)
with check (
  (public.current_user_role() = 'chw' and chw_user_id = auth.uid())
  or (
    public.current_user_role() = 'supervisor'
    and (clinic_id = public.current_user_clinic_id() or region_id = public.current_user_region_id())
  )
  or public.current_user_role() = 'admin'
);

-- AUDIT LOGS policies

drop policy if exists "supervisor_admin_read_audit_logs" on public.audit_logs;
drop policy if exists "audit_logs_select_privileged" on public.audit_logs;
create policy "audit_logs_select_privileged"
on public.audit_logs
for select
to authenticated
using (public.current_user_role() in ('supervisor', 'admin'));

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
on public.audit_logs
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and actor_role = public.current_user_role()
);
