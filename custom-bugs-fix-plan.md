# Asibi Bug Fix Plan
Date: 2026-05-15
Time: 07:53 PM UTC

## Phase 0 — Safety Rails (Immediate)
1. Freeze new feature merges until core auth/scope and sync bugs are addressed.
2. Add temporary monitoring alerts for sync failure rate, 403 CSRF rate, and dashboard query volumes.
3. Add backup/retention checks before export and audit schema changes.

## Phase 1 — Security & Data Isolation (Highest Priority)
1. Replace service-role broad reads with scoped queries tied to authenticated user permissions.
2. Harden CSRF origin validation with strict URL parsing and trusted-origin comparison.
3. Restrict health endpoint detail to privileged users.
4. Add audit action allowlist, payload schema validation, size limits, and redaction.

## Phase 2 — Correctness & Integrity
1. Unify risk-level enum across shared evaluator, UI, and dashboard API.
2. Fix date-range filtering so gte/lte are both applied simultaneously.
3. Correct health typing and overall status semantics.
4. Validate triage rules `lang` against supported language allowlist.

## Phase 3 — Reliability, Retry, and Atomicity
1. Repair SyncAgent to include CSRF and refresh fallback.
2. Add sync request timeout, bounded concurrency, and categorized retry with exponential backoff.
3. Make rate limiting fully atomic in Redis and fallback-only in-memory.
4. Add idempotent retry-safe audit/export write paths where required.

## Phase 4 — Scalability & Cost Controls
1. Replace full-memory CSV export with paginated streaming/background jobs.
2. Add caching namespaces, TTL policy docs, and cache key normalization.
3. Add query limits and server-side pagination defaults for all list endpoints.
4. Add anti-thundering-herd jitter at API and client retry layers.

## Phase 5 — Tests, Observability, and Governance
1. Remove duplicated evaluator test logic and use canonical shared evaluator vectors.
2. Add integration tests for RLS scope boundaries on dashboard/export/audit endpoints.
3. Add load tests for sync and export paths (concurrency and large payload scenarios).
4. Add security tests for CSRF bypass attempts and malformed origins.
5. Publish runbooks for incident response and rollback.

## Execution Order
1) Security isolation + CSRF hardening
2) Sync reliability + rate limiter atomicity
3) Risk/date correctness bugs
4) Export scaling and monitoring enhancements
5) Test and governance hardening

## Success Criteria
- No cross-scope data leakage in supervisor/admin endpoints.
- Auto-sync works reliably with measurable retry behavior and bounded failure rates.
- Dashboard totals/filters match canonical risk model.
- Export operations remain stable under large datasets without memory spikes.
- Security tests (CSRF, auth scope) pass consistently in CI.

Footer: Generated on 2026-05-15 at 07:53 PM UTC
