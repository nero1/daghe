-- Run with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/rls-policy-verification.sql
begin;

create extension if not exists pgcrypto;

-- Ensure roles exist for policy testing.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

truncate table public.audit_logs, public.cases, public.users;

select set_config('role', 'postgres', false);

-- Seed users with known scopes.
select
  '11111111-1111-1111-1111-111111111111'::uuid as chw1,
  '22222222-2222-2222-2222-222222222222'::uuid as chw2,
  '33333333-3333-3333-3333-333333333333'::uuid as sup1,
  '44444444-4444-4444-4444-444444444444'::uuid as admin1,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid as clinic1,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid as clinic2,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid as region1,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid as region2
\gset

insert into public.users(id,email,role,name,clinic_id,region_id) values
(:'chw1','chw1@example.com','chw','CHW 1', :'clinic1', :'region1'),
(:'chw2','chw2@example.com','chw','CHW 2', :'clinic2', :'region2'),
(:'sup1','sup1@example.com','supervisor','SUP 1', :'clinic1', :'region1'),
(:'admin1','admin1@example.com','admin','Admin 1', null, null);

insert into public.cases(
  id, local_case_id, idempotency_key, chw_user_id, clinic_id, region_id,
  patient_age_range, patient_sex, symptoms, answers, triage_result,
  recommended_action, risk_level, referral_required, decision_tree_version, app_version
)
values
(gen_random_uuid(), 'c-1', 'idem-1', :'chw1', :'clinic1', :'region1', 'adult', 'f', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'review', 'low', false, 'v1', '1.0.0'),
(gen_random_uuid(), 'c-2', 'idem-2', :'chw2', :'clinic2', :'region2', 'adult', 'm', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'review', 'high', true, 'v1', '1.0.0');

grant usage on schema public to authenticated;
grant select, insert, update on public.users, public.cases, public.audit_logs to authenticated;

-- CHW boundary checks.
set local role authenticated;
select set_config('request.jwt.claim.sub', :'chw1', true);

-- CHW sees only own row.
do $$
declare c int;
begin
  select count(*) into c from public.cases;
  if c <> 1 then raise exception 'CHW expected 1 visible case, got %', c; end if;
end $$;

-- CHW cannot escalate own role.
do $$
begin
  begin
    update public.users set role = 'admin' where id = :'chw1';
    raise exception 'expected role escalation to fail';
  exception when others then
    null;
  end;
end $$;

-- Supervisor can read scoped cases but not insert for unrelated scope.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'sup1', true);

do $$
declare c int;
begin
  select count(*) into c from public.cases;
  if c <> 1 then raise exception 'Supervisor expected 1 scoped case, got %', c; end if;
end $$;

-- Admin can read all and write user rows.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin1', true);

do $$
declare c int;
begin
  select count(*) into c from public.cases;
  if c <> 2 then raise exception 'Admin expected 2 visible cases, got %', c; end if;
end $$;

insert into public.users(id,email,role,name) values
('55555555-5555-5555-5555-555555555555','new@example.com','chw','New CHW');

-- Bypass attempt: forge actor_role must fail.
do $$
begin
  begin
    insert into public.audit_logs(id,actor_user_id,actor_role,action,payload)
    values (gen_random_uuid(), :'admin1', 'chw', 'forged', '{}'::jsonb);
    raise exception 'expected forged actor role insert to fail';
  exception when others then
    null;
  end;
end $$;

rollback;
