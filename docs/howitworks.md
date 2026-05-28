# How Asibi Works (For Users and Admins)

This guide explains the product with no technical background required.

## 1) Main User Types
- **CHW (Field Worker):** Runs triage and records cases.
- **Supervisor/Admin:** Reviews metrics, case lists, exports, and audit logs.

## 2) App Areas
1. **Home**
   - Login / refresh / logout
   - language selection (English, Hausa, Yoruba, Igbo)
   - connection status + unsynced counter
2. **Triage**
   - symptom cluster + risk flags
   - evaluate case
   - save case offline
3. **Cases**
   - list saved local cases
   - sync unsynced cases to server
   - retry behavior after failures
4. **Dashboard**
   - summary counts
   - risk-level filtering
   - paginated case listing
   - CSV export

## 3) Offline-First Behavior
- If internet is unavailable, CHW can still create cases.
- Cases are stored locally in browser IndexedDB.
- When internet returns, sync sends cases to server.
- Failed sync attempts are retried with backoff timing.

## 4) Security Model (Simple Terms)
- Users must login.
- Roles control access:
  - CHW can sync field cases.
  - Supervisor/Admin can access dashboard and audit data.
- CSRF token checks protect sensitive actions.
- Rate limiting reduces abuse on login/sync endpoints.

## 5) Data Flow (Plain English)
1. CHW enters triage inputs.
2. App evaluates risk and recommendation.
3. Case saved locally.
4. Sync sends case to Supabase when allowed.
5. Dashboard APIs read summarized and detailed data.
6. Audit API records important actions.

## 6) What Supervisors Should Monitor
- Rising urgent/emergency counts.
- Delays in field sync (high unsynced volumes).
- Repeated login or sync failures.
- Audit logs for unusual actions.

## 7) What Admins Should Maintain
- User roles and account access.
- Supabase project keys and backups.
- Deployment health in Vercel.
- Incident response process.

## 8) Typical Day Workflow
1. CHW logs in and performs triage visits.
2. Saves multiple cases offline.
3. Returns to connectivity area.
4. Opens Cases and syncs data.
5. Supervisor checks Dashboard and exports report.

## 9) Feature Summary
- Offline triage capture
- Auth + role protection
- Secure sync with CSRF and rate limit guardrails
- Supervisor metrics, filters, pagination, exports
- Audit capture and retrieval
- Multi-language starter support

## 10) Limitations to Know
- Browser data can be lost if user clears site storage.
- In-memory rate limiter is per app instance (not globally distributed).
- For large scale, add centralized monitoring and distributed controls.
