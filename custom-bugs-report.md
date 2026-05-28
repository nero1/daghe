# Asibi Bug Report
Date: 2026-05-15
Time: 07:53 PM UTC

## 1-line Bug/Issue List
1: BUG-001: Dashboard summary uses invalid risk level `routine` that does not match triage output values, causing wrong counts/filter behavior.
   FILES: apps/web/app/api/dashboard/summary/route.ts, apps/web/app/dashboard/page.tsx, packages/shared/src/index.ts
   FIX: Replace `routine` with canonical risk levels (monitor/treat_local/refer/urgent/emergency) and map UI labels explicitly.

2: BUG-002: Dashboard APIs query Supabase using service-role key without scope filters, bypassing RLS and leaking cross-region/cross-clinic data.
   FILES: apps/web/app/api/dashboard/summary/route.ts, apps/web/app/api/dashboard/cases/route.ts, apps/web/app/api/dashboard/export/route.ts, apps/web/app/api/audit/route.ts, apps/web/app/api/dashboard/chw-stats/route.ts
   FIX: Use user JWT-bound client or enforce explicit server-side scope predicates from the authenticated user profile before querying.

3: BUG-003: CSRF same-origin check uses `origin.includes(host)`, enabling origin-confusion bypasses.
   FILES: apps/web/lib/server/security.ts
   FIX: Parse URL origin and compare exact origin host/port/protocol against trusted host list.

4: BUG-004: Background SyncAgent posts to CSRF-protected sync API without CSRF header, so all auto-sync attempts fail.
   FILES: apps/web/app/sync-agent.tsx, apps/web/app/api/cases/sync/route.ts
   FIX: Acquire CSRF token and include `x-csrf-token` in each sync request, plus handle 401 refresh path.

5: BUG-005: Sync route performs serial per-case upstream writes with no timeout/retry/backoff, making large sync batches fragile and slow.
   FILES: apps/web/app/api/cases/sync/route.ts
   FIX: Add bounded concurrency, per-request timeout, categorized retry with exponential backoff, and partial-failure telemetry.

6: BUG-006: Redis rate limiter is not atomic and can leak keys without TTL if process fails between INCR and EXPIRE.
   FILES: apps/web/lib/server/redis.ts
   FIX: Use single atomic script/command pattern (INCR+EXPIRE NX) or Lua transaction.

7: BUG-007: Hybrid limiter applies in-memory limit even when Redis succeeds, causing over-throttling and inconsistent distributed behavior.
   FILES: apps/web/lib/server/rate-limit.ts
   FIX: Use Redis result as source of truth when available; only fallback to memory on Redis-unavailable/error path.

8: BUG-008: Health endpoint mis-types latency field into status union and computes overall status with permissive OR logic.
   FILES: apps/web/app/api/health/route.ts
   FIX: Separate typed latency metrics object and require critical dependencies policy (AND or weighted health policy).

9: BUG-009: `created_at` filtering uses duplicated query param assignment, so one bound overwrites the other and date windows become incorrect.
   FILES: apps/web/app/api/dashboard/summary/route.ts, apps/web/app/api/dashboard/cases/route.ts, apps/web/app/api/dashboard/export/route.ts
   FIX: Apply combined PostgREST filters with `and=(created_at.gte...,created_at.lte...)` or dedicated gte/lte syntax without overwrites.

10: BUG-010: Export endpoint loads unbounded result set into memory, enabling data bloat/DoS on large datasets.
   FILES: apps/web/app/api/dashboard/export/route.ts
   FIX: Add upper bounds/pagination streaming CSV generation and background export jobs for large reports.

11: BUG-011: Triage rules API uses dashboard cache helpers and unvalidated `lang` parameter in cache key and query.
   FILES: apps/web/app/api/triage/rules/route.ts
   FIX: Create dedicated rules cache namespace and validate language against allowlist.

12: BUG-012: Auth flow verifies token by remote call on every request with no timeout/circuit-breaker/cache, increasing latency and outage blast radius.
   FILES: apps/web/lib/server/auth.ts
   FIX: Add short timeout, per-token cache, and graceful degradation strategy with explicit failure semantics.

13: BUG-013: Sensitive health and monitoring endpoints expose internal dependency details publicly without auth.
   FILES: apps/web/app/api/health/route.ts
   FIX: Gate detailed diagnostics by auth/role and provide minimal public liveness response.

14: BUG-014: Audit logging accepts arbitrary action/payload schema and writes via service role, increasing log-injection/noise and storage bloat risk.
   FILES: apps/web/app/api/audit/route.ts
   FIX: Validate action enum, cap payload size/depth, redact sensitive keys, and enforce quotas.

15: BUG-015: Tests duplicate evaluator logic in JS snapshot test, risking false confidence and drift.
   FILES: tests/triage.test.mjs
   FIX: Import shared evaluator in runnable test pipeline or generate golden vectors centrally.

## Detailed Findings
1) BUG-001: Risk taxonomy mismatch
The dashboard uses `routine`, while triage emits `monitor`, `treat_local`, `refer`, `urgent`, `emergency`. This breaks filtering consistency and aggregate correctness.

2) BUG-002: Authorization scope bypass in analytics endpoints
Although endpoint access is role-gated, actual data fetches use service-role credentials and omit supervisor scope restrictions; this can expose unrelated data across tenants/regions.

3) BUG-003: Weak CSRF origin validation
Substring origin checks are vulnerable (`evil.com?host=target.com` patterns). Strict origin parsing/matching is required.

4) BUG-004: Automatic sync path broken
Periodic sync requests omit required CSRF header, so CSRF validation fails and queued cases never auto-sync.

5) BUG-005: Sync reliability and atomicity gaps
Serial sync has high latency and no retry policy for transient failures; no request timeout can stall full batches.

6) BUG-006: Rate-limit atomicity issue
INCR then EXPIRE non-atomically can leave never-expiring counters when interrupted, causing long-term throttling drift.

7) BUG-007: Double-limiting logic bug
Applying memory limiter after successful Redis check effectively rate-limits twice and inconsistently across instances.

8) BUG-008: Health status correctness
Latency data is type-coerced into status union and overall status uses weak OR logic, possibly reporting healthy while dependencies are down.

9) BUG-009: Date filter overwrite
Setting `created_at` twice in URLSearchParams overwrites one constraint, invalidating intended interval filtering.

10) BUG-010: Export memory/scale risk
Single fetch of all matching rows and in-memory CSV assembly does not scale to high-volume deployments.

11) BUG-011: Cache namespace/validation smell
Rules endpoint reuses dashboard cache primitives and accepts arbitrary lang keys, enabling cache pollution and operational confusion.

12) BUG-012: Auth verification resiliency
Every protected request incurs remote token validation without timeout/circuit breaker, creating fragility under upstream slowness.

13) BUG-013: Overexposed observability surface
Health response leaks backend dependency state and timings to unauthenticated callers.

14) BUG-014: Audit integrity/storage hardening gaps
Unbounded action strings/payloads permit noisy or malicious log inflation and potential sensitive data persistence.

15) BUG-015: Test drift anti-pattern
Copied evaluator logic in tests can pass even if production evaluator diverges, reducing defect detection power.

Footer: Generated on 2026-05-15 at 07:53 PM UTC
