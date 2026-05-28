-- Ensure RLS is enabled and enforce CHW row ownership.
alter table public.cases enable row level security;

-- Users can insert only their own rows.
drop policy if exists "cases_insert_own" on public.cases;
create policy "cases_insert_own"
on public.cases
for insert
to authenticated
with check (chw_user_id = auth.uid());

-- Users can read only their own rows.
drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own"
on public.cases
for select
to authenticated
using (chw_user_id = auth.uid());

