-- CHW can read and insert their own non-demo encounters
create policy "encounters_chw_own" on public.encounters
  for select using (auth.uid() = chw_user_id);

create policy "encounters_chw_insert" on public.encounters
  for insert with check (
    auth.uid() = chw_user_id
    and is_demo = false
  );

-- Supervisors can read all encounters in their facility
create policy "encounters_supervisor_facility" on public.encounters
  for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('supervisor','admin')
    )
  );

-- Soft-delete: only mark deleted_at, never physical delete
create policy "encounters_soft_delete" on public.encounters
  for update using (auth.uid() = chw_user_id)
  with check (deleted_at is not null);
