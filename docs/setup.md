# Asibi Setup Guide (No-CLI, Beginner Friendly)

This guide is written for new developers and project owners who may not use the command line.

## 1) What Asibi Is
Asibi is an offline-first health triage web app. Community Health Workers (CHWs) can:
- run triage checks,
- save cases offline on device,
- sync cases when internet returns,
- and supervisors can view dashboard summaries and exports.

## 2) Accounts and Services You Need
Create these accounts first (all can be done in browser):
1. **GitHub** (code hosting + CI)
2. **Vercel** (web hosting)
3. **Supabase** (database + auth)

## 3) Create Supabase Project (Browser Only)
1. Sign in to Supabase and create a new project.
2. Save these values from Project Settings → API:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (sensitive; never expose to client)
3. In SQL Editor, run migration files in this order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_cases_rls_policies.sql`
   - `supabase/migrations/0003_audit_logs.sql`

## 4) Configure Authentication Roles
In Supabase Auth dashboard:
1. Create users for CHW and supervisor/admin.
2. Add `user_metadata.role` values:
   - `chw`
   - `supervisor`
   - `admin`

## 5) Deploy to Vercel (No-CLI)
1. Import GitHub repo into Vercel.
2. Framework: Next.js (auto-detected).
3. Add environment variables in Vercel Project Settings:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Trigger deploy.

## 6) GitHub Actions CI Setup
In GitHub repository:
1. Open **Actions** tab.
2. Ensure workflow `.github/workflows/ci.yml` runs on push/PR.
3. Confirm pipeline steps:
   - install dependencies
   - typecheck
   - build
   - tests

## 7) Secrets and Security Rules
- Never share `SUPABASE_SERVICE_ROLE_KEY` publicly.
- Keep service role key only in server-side env settings.
- Rotate keys immediately if exposed.
- Use role-based users for real operations (no shared credentials).

## 8) Browser-Only Validation Checklist
After deployment, verify in browser:
1. Home page loads.
2. Login works for CHW.
3. Triage can evaluate and save case offline.
4. Cases page can sync unsynced items.
5. Dashboard loads for supervisor/admin.
6. Export CSV downloads.
7. Audit route is writing/reading logs (admin/supervisor).

## 9) Common Problems (No-CLI Fixes)
- **401 errors**: user not logged in or wrong role metadata.
- **403 CSRF errors**: stale browser session/cookies; refresh page and retry.
- **Dashboard empty**: no synced data yet, or wrong Supabase env vars.
- **Sync fails**: check service role key and cases table migrations.

## 10) Production Readiness (Browser-Managed)
- Turn on Vercel branch protection / production approvals.
- Enable Supabase backups.
- Create weekly key rotation policy.
- Create incident contact and recovery runbook.
