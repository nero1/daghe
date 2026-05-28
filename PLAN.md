# Daghe Migration Plan: Asibi → Daghe

## Context

The existing repo at `/home/user/daghe` is the **Asibi** codebase — an offline-first PWA for symptom-based clinical triage used by Nigerian community health workers. The user wants to convert it into **Daghe** (Esan: "to see"), an AI-assisted visual diagnostic platform for cervical cancer screening via VIA (Visual Inspection with Acetic Acid). The PRD (`/home/user/daghe/Daghe_PRD-1.md`) is the authoritative specification.

Daghe shares Asibi's offline-first PWA architecture, sync infrastructure, multilingual framework, Next.js/Supabase/Tailwind stack, and admin panel structure. What changes: the domain logic (symptom triage → image capture + AI inference), the database schema (cases → encounters), the AI backend (none → 5-step TFLite + cloud AI fallback chain), and many string/namespace references.

**Key non-negotiable constraints from PRD:**
- TFLite runs in-browser (TFJS-tflite WASM), NEVER server-side
- Images held in memory only; explicitly nulled after session; never stored/transmitted unless admin enables with consent
- Confidence band always visible (never tooltip/expandable)
- LOW or REFERENCE_ONLY confidence always overrides classification to REFER
- BYOK keys AES-256-GCM encrypted server-side; never plaintext in DB/logs/responses
- Role verified by DB query on every API route, never from session token alone
- Idempotent sync by UUID (DB-level unique constraint)
- Decimal.js for all cost/token arithmetic
- No PII at any layer

---

## Phase 1 — Foundation: Rename + Infrastructure Rewire (Days 1–5)

**Goal:** Zero Asibi strings visible in the app. No new features. Must pass `typecheck` and `build`.

### What to delete
- `apps/web/app/triage/page.tsx`
- `apps/web/app/api/triage/evaluate/route.ts`
- `apps/web/app/api/triage/rules/route.ts`

### Package identity renames
- `package.json` (root): `"name": "asibi"` → `"daghe"`, workspace scripts `@asibi/web` → `@daghe/web`
- `apps/web/package.json`: `"name": "@asibi/web"` → `"@daghe/web"`, dep `@asibi/shared` → `@daghe/shared`
- `packages/shared/package.json`: `"name": "@asibi/shared"` → `"@daghe/shared"`

### String replacements (exact files)
| File | Old | New |
|---|---|---|
| `apps/web/lib/server/auth.ts` | `asibi_access_token`, `asibi_refresh_token` | `daghe_access_token`, `daghe_refresh_token` |
| `apps/web/lib/server/security.ts` | `asibi_csrf` | `daghe_csrf` |
| `apps/web/lib/csrf.ts` | `asibi_csrf` | `daghe_csrf` |
| `apps/web/app/layout.tsx` | `asibi_theme`, title "Asibi" | `daghe_theme`, "Daghe" |
| `apps/web/app/page.tsx` | `asibi_theme`, `asibi:themechange` | `daghe_theme`, `daghe:themechange` |
| `apps/web/app/components/NavBar.tsx` | "Asibi" brand label, theme keys | "Daghe" |
| `apps/web/app/demo/page.tsx` | `asibi_demo_banner_dismissed` | `daghe_demo_banner_dismissed` |
| `apps/web/app/sync-agent.tsx` | `asibi_sync_lock` | `daghe_sync_lock` |
| `apps/web/lib/cases.ts` | `DB_NAME = "asibi"`, `VERSION = 5` | `"daghe"`, `6` |
| `apps/web/lib/i18n.ts` | `title: "Asibi"` (all 19 language blocks) | `"Daghe"` |
| `apps/web/public/sw.js` | `asibi-shell-...` cache name, `checkTriageRulesVersion()` | `daghe-shell-v1`, stub `checkModelVersion()` |
| `apps/web/app/manifest.ts` | name, description | Daghe branding |
| `apps/web/app/sw-register.tsx` | "Asibi" update text, `TRIAGE_RULES_UPDATED` | "Daghe", `MODEL_VERSION_UPDATED` |

### next.config.ts updates
- Add `'wasm-unsafe-eval'` to `script-src` (TFJS WASM)
- Add `worker-src 'self' blob:` (TFJS Web Worker)
- Add `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
- Add `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Add AI provider domains to `connect-src`

### Dependencies to add (Phase 1)
```json
"dompurify": "^3.1.0",
"@types/dompurify": "^3.0.5",
"decimal.js": "^10.4.3",
"dexie": "^4.0.0"
```

### CI (`.github/workflows/ci.yml`)
- Remove test commands for deleted triage tests
- Add placeholder env vars for new keys

---

## Phase 2 — Condition Module System + Data Layer (Days 6–12)

**Goal:** `@daghe/shared` defines the module contract. `cervical-via` module skeleton exists. Dexie.js replaces hand-rolled IDB.

### Rewrite `packages/shared/src/index.ts` (complete replacement)
Exports: `ViaClassification`, `ConfidenceBand`, `InferenceMethod`, `ModuleResult`, `applyConfidenceOverride()` (critical safety function), `ConditionModule`, `LocalEncounter`.

### New package: `packages/cervical-via/`
```
packages/cervical-via/
  package.json  ("name": "@daghe/cervical-via")
  src/
    index.ts              — cervicalViaModule: ConditionModule descriptor
    fallback-logic.json   — WHO VIA rule tree (data, not code; OTA-updateable)
    strings/en.ts, ha.ts, yo.ts, ig.ts, fr.ts
    demo/images.ts        — references to bundled demo images
```

### New file: `apps/web/lib/encounters.ts` (replaces `lib/cases.ts`)
- Dexie.js `DagheDB` class; DB name `"daghe"`; stores: `encounters`, `devicePrefs`, `facilityToken`
- Exports: `saveEncounter`, `getUnsyncedEncounters` (filters `isDemoEncounter: true`), `markEncounterSynced`, `markEncounterFailed`

### Update `apps/web/lib/sync.ts`
- `LocalCase` → `LocalEncounter` (type-level rename, logic unchanged)

### Update `apps/web/app/sync-agent.tsx`
- Import `getUnsyncedEncounters` from `lib/encounters`
- API call changes from `/api/cases/sync` → `/api/encounters/sync`

### Rename API route directory
- `app/api/cases/` → `app/api/encounters/`; update Zod schemas for `LocalEncounter` shape

### Add Daghe-specific i18n keys to `lib/i18n.ts`
New keys: `moduleSelect`, `cervicalVia`, `patientAgeBand`, `screeningContext`, screening step strings, quality check error messages, result labels, confidence band labels, `demoModeBanner`, action taken labels.

### New page skeletons (empty `<main>` shells)
- `apps/web/app/screening/page.tsx`
- `apps/web/app/screening/result/page.tsx`
- `apps/web/app/encounters/page.tsx`
- `apps/web/app/settings/page.tsx`

---

## Phase 3 — AI Inference Pipeline (Days 13–22)

**Goal:** Full 5-step fallback chain implemented. Screening flow complete. Demo mode rebuilt.

### New dependency
```json
"@tensorflow/tfjs-tflite": "^0.0.1-alpha.10",
"@tensorflow/tfjs-core": "^4.x",
"@tensorflow/tfjs-backend-wasm": "^4.x"
```
**Must be dynamically imported** — never in initial bundle.

### New files
| File | Purpose |
|---|---|
| `apps/web/lib/ai/constants.ts` | Hardcoded AI provider config, cost rates (read from env vars) |
| `apps/web/lib/ai/quality-check.ts` | `checkBlur()` (Laplacian variance), `checkExposure()`, `runQualityChecks()` |
| `apps/web/lib/ai/tflite-runner.ts` | Dynamic import of TFJS-tflite, detection + classification pipeline, returns `ModuleResult \| null` |
| `apps/web/lib/server/byok.ts` | `encryptKey()` / `decryptKey()` using AES-256-GCM + `crypto` (Node built-in) |
| `apps/web/app/api/ai/vision/route.ts` | Server-side AI proxy: steps 2–3 of fallback chain; Decimal.js cost calc; logs to `ai_usage_log` |
| `apps/web/app/api/keys/route.ts` | BYOK key management: POST (encrypt+store), DELETE, GET (masked only) |
| `apps/web/app/api/modules/version/route.ts` | Returns current model version for SW version checking |
| `apps/web/app/model-loader.tsx` | Background TFLite model download with progress indicator |

### `apps/web/app/screening/page.tsx` — full implementation
State machine: `module-select → patient-context → capture-guide → capture → quality-check → inference → result → action`

**Critical requirements:**
- Camera via `MediaDevices.getUserMedia({ video: { facingMode: "environment" } })`
- Image in `useRef<ImageData | null>` (NOT React state)
- Image explicitly nulled on unmount and on "New Screening" tap + `URL.revokeObjectURL()`
- Quality failures: specific message per failure type; max 3 attempts; then "Continue anyway" with `qualityOverride: true`
- After TFLite: if null (WASM fail) → call `/api/ai/vision`; if offline → rule-based questions (step 4)
- `applyConfidenceOverride()` called unconditionally before rendering result
- Result screen: classification badge + **always-visible** confidence band + inference method chip + cost chip (online AI only) + action selector + save button
- Demo mode guard: `isDemoEncounter: true` in encounter; skip sync write

### `apps/web/app/demo/page.tsx` — complete rewrite
- Three bundled demo images from `/public/demo/`
- Full pipeline (quality check → TFLite → result)
- Fixed yellow DEMO banner: `position: fixed; top: 0; z-index: 10000` — rendered by layout, never dismissible
- Demo encounters: `isDemoEncounter: true`; NEVER appear in `getUnsyncedEncounters`

### `apps/web/app/api/ai/vision/route.ts` — security requirements
- SSRF guard: AI provider URLs come from `AI_CONSTANTS` only, never user input
- Prompt injection delimiter pattern: `---USER_CONTEXT_START--- ... ---USER_CONTEXT_END---`
- Rate limit: 20 requests/minute per user ID
- Image base64 never logged or in error responses
- BYOK key decrypted server-side, used once, not cached or stored post-call

---

## Phase 4 — Database + Extended Auth (Days 23–33)

**Goal:** Supabase schema updated to Daghe model. Google OAuth, Telegram, PIN, 2FA, facility-linked mode implemented.

### New migrations (`supabase/migrations/`)
| File | Content |
|---|---|
| `0015_encounters.sql` | `encounters` table (UUID PK, idempotency_key unique, classification/confidence enums, is_demo, deleted_at for soft-delete, RLS enabled) |
| `0016_user_api_keys.sql` | BYOK keys: encrypted_key_iv/ciphertext/tag columns, unique(user_id, provider), RLS: own rows only |
| `0017_ai_usage_log.sql` | AI call audit: provider, task_type, key_type, input/output tokens, `estimated_cost_usd NUMERIC(20,8)`, encounter_id |
| `0018_modules.sql` | Module registry + `admin_config` table; seed `cervical-via` row |
| `0019_facility_codes.sql` | 8-char facility codes linked to clinics |
| `0020_encounters_rls.sql` | CHW: own records; Supervisor: whole facility; CHW INSERT with `is_demo = false` enforcement |

### New auth routes
- `apps/web/app/api/auth/telegram/route.ts` — HMAC-SHA256 validate Telegram widget data
- `apps/web/app/api/auth/pin/route.ts` — bcrypt server-side PIN verify, 5-min Redis PIN token
- `apps/web/app/api/auth/2fa/route.ts` — TOTP setup/verify/disable via `otplib`
- `apps/web/app/api/auth/facility-token/route.ts` — validate facility code → issue short-lived facility JWT

### Admin panel extensions (`apps/web/app/admin/page.tsx`)
New tabs: **Modules** (enable/disable toggle, model version, OTA trigger), **AI Providers** (per-provider toggle from `admin_config`, central key management), **Cost Dashboard** (Decimal.js sum from `ai_usage_log`).

New page: `apps/web/app/settings/api-keys/page.tsx` — supervisor BYOK key management (calls `/api/keys/`).

### Dependency additions
```json
"otplib": "^12.0.1"
```

---

## Phase 5 — Polish, Hardening, Production (Days 34–56)

**Goal:** All 5 languages complete. OWASP hardened. Performance budget met. CI test suite complete.

### i18n completion
All new Daghe keys translated for ha, yo, ig, fr. Consider splitting `lib/i18n.ts` into per-language lazy-loaded modules (`lib/i18n/en.ts`, etc.) to reduce initial bundle size by ~200KB.

### Security hardening
- **DOMPurify** in admin footer scripts field: `DOMPurify.sanitize(footerScript, { FORCE_BODY: true })` before `dangerouslySetInnerHTML` (only legitimate use in codebase)
- **Pre-commit secret scan** in CI: grep for `NEXT_PUBLIC_` in API routes, key-like strings in lib
- **CSP tightening**: remove `'unsafe-inline'` from `script-src` after confirming Tailwind purge compatibility

### Performance
- Bundle size target: ≤500KB gzipped initial JS (TFLite dynamically imported, models excluded)
- `apps/web/app/model-loader.tsx`: background model download with stream progress, serves from `"daghe-models-v1"` Cache API cache
- `@next/bundle-analyzer` (devDep) added to measure

### Accessibility (WCAG 2.1 AA)
- All interactive elements in screening flow: `aria-label`
- Confidence band: dark text on amber (contrast ratio ≥4.5:1)
- POSITIVE/NEGATIVE/REFER: icon + colour + text (never colour alone)
- Touch targets ≥44×44px throughout
- Demo banner: `role="status"` `aria-live="polite"`
- CSS logical properties throughout (`margin-inline-start`, `padding-block`)

### New test files
| File | What it tests |
|---|---|
| `tests/encounters.test.mjs` | Dexie schema, demo encounter exclusion from sync queue |
| `tests/quality-check.test.mjs` | checkBlur/checkExposure with synthetic pixel data |
| `tests/ai-chain.test.mjs` | `applyConfidenceOverride` all 4 confidence levels |
| `tests/byok.test.mjs` | AES-256-GCM round-trip; key never in mock API response |
| `tests/cost-calc.test.mjs` | Decimal.js precision vs floating-point |
| `tests/security/prompt-injection.test.mjs` | Injected instruction strings don't escape USER_CONTEXT delimiters |
| `tests/security/demo-mode.test.mjs` | isDemoEncounter records never in sync payload |

### Documentation updates
- `README.md`: Daghe product description, new feature overview, env vars table
- `docs/setup.md`: new env vars, BYOK_ENCRYPTION_KEY generation, model file placement, Dexie migration notes
- `docs/howitworks.md`: replace triage flow diagram with image capture + AI inference pipeline diagram

---

## Verification Plan

### Phase 1
- `npm run typecheck` — zero errors
- `npm run build` — succeeds
- Manual: DevTools → Application → IndexedDB shows "daghe"; cookies named `daghe_access_token`; no "Asibi" visible anywhere in rendered UI

### Phase 2
- `npm run typecheck` — zero errors with new shared types
- `tests/encounters.test.mjs` — all pass
- `applyConfidenceOverride` unit test: LOW → REFER, REFERENCE_ONLY → REFER, HIGH → unchanged

### Phase 3
- TFLite dynamic import: confirmed in bundle analyzer (not in initial chunk)
- Quality check unit tests pass with synthetic ImageData
- Decimal.js cost test: `0.000075 × 1000 / 1000` returns exact value, not floating-point artifact
- BYOK encryption round-trip test passes
- Demo mode: complete a demo screening; no encounter in `getUnsyncedEncounters`; DEMO banner always visible

### Phase 4
- All 6 migration files found by CI migration check
- RLS test: CHW token cannot SELECT another facility's encounters (returns empty)
- BYOK key never appears in any API response (GET returns masked only)
- Sync route rejects `is_demo: true` encounters with 400

### Phase 5
- Lighthouse audit: Performance ≥80, Accessibility ≥90
- Bundle size: initial JS ≤500KB gzipped
- All new test suites pass in CI
- Manual end-to-end: full screening flow from module select to saved encounter, offline and online

---

## build-progress.md Setup

On first execution: create `/home/user/daghe/build-progress.md` with the instructions header, then append Phase 1 completion entry after Phase 1 is done. Continue appending after each phase.
