# Daghe — Claude Code Developer Harness

## What This Repo Is

Daghe (Esan: "to see") is an **offline-first, multi-modal AI medical imaging screening platform** for Community Health Workers (CHWs). It assists CHWs in capturing or uploading clinical images and receiving AI-assisted POSITIVE / NEGATIVE / REFER classifications — with or without an internet connection.

v1.0 ships the cervical cancer VIA screening module. The platform is designed to expand to chest X-ray (TB), skin lesions, retinal imaging, CT, MRI, X-ray, ultrasound, and more — each as a self-contained module requiring no changes to core app code.

Daghe is built on the Asibi CHW platform codebase, extended with an image capture and on-device AI inference layer.

---

## Repo Structure

```
/
├── apps/
│   └── web/                  # Next.js 15 app (App Router, TypeScript)
│       ├── app/              # Route pages and API routes
│       │   ├── api/          # Server-side API routes
│       │   │   ├── ai/       # Vision and text AI proxy routes
│       │   │   ├── auth/     # OAuth + Telegram auth routes
│       │   │   ├── byok/     # BYOK key management
│       │   │   ├── cron/     # Cron job routes (CRON_SECRET protected)
│       │   │   ├── encounters/ # Encounter sync
│       │   │   └── admin/    # Admin API endpoints
│       │   ├── app/          # Main app shell (authenticated)
│       │   ├── about/        # About page
│       │   ├── help/         # Help / user guide
│       │   └── page.tsx      # Landing page
│       ├── lib/
│       │   ├── i18n.ts       # All UI strings, 19 languages
│       │   ├── ai/           # AI inference chain, cost tracker
│       │   ├── db/           # Database adapter (Supabase / DigitalOcean)
│       │   ├── quality/      # Image quality checks (blur, exposure)
│       │   └── security/     # BYOK encryption, prompt injection guards
│       └── public/
│           └── models/       # TFLite model files (not bundled — placed manually)
├── packages/
│   ├── shared/               # @daghe/shared — types and utilities
│   └── cervical-via/         # @daghe/cervical-via — v1.0 condition module
├── supabase/
│   └── migrations/           # 0001_init.sql … 0021_telegram_auth.sql
├── tests/                    # Unit and security tests (.mjs)
│   └── security/
└── scripts/                  # Seed data and utility scripts
```

---

## Development Commands

```bash
# Install all workspace dependencies
npm install

# Run dev server (Next.js)
npm run dev --workspace=apps/web

# Typecheck
npm run typecheck --workspace=apps/web

# Production build
npm run build --workspace=apps/web

# Bundle analysis
ANALYZE=true npm run build --workspace=apps/web
```

### Run Tests

```bash
node tests/encounters.test.mjs
node tests/ai-chain.test.mjs
node tests/byok.test.mjs
node tests/cost-calc.test.mjs
node tests/quality-check.test.mjs
node tests/security/prompt-injection.test.mjs
node tests/security/demo-mode.test.mjs
```

---

## Adding a New Condition Module

1. Create a package at `packages/<module-id>/` with:
   - `manifest.json` — module ID, name, version, TFLite filenames, quality thresholds
   - `fallback-logic.json` — module-specific offline rule-based decision tree
   - `strings/en.json` — English UI strings (other languages are stubs until translated)
   - `demo/` — 3 demo images (positive, negative, indeterminate) + `annotations.json`
   - `clinical-guide/en.md` — cached clinical reference text

2. Implement `ConditionModule` interface from `@daghe/shared`.

3. Place TFLite model files in `apps/web/public/models/`.

4. Register the module: `INSERT INTO modules (id, name, version, enabled) VALUES (...)`.

5. Deploy — no core app code changes needed.

---

## Key Constraints (Non-Negotiable)

These are clinical safety and security requirements. Do not work around them:

| Constraint | Reason |
|---|---|
| TFLite inference is **client-side WASM only** — never server-side | Offline capability; patient images never leave the device for on-device inference |
| Images held in **memory only** (`useRef`, never React state); nulled + `URL.revokeObjectURL()` after inference; **never transmitted** | Privacy — no patient images on servers |
| LOW or REFERENCE_ONLY confidence **always overrides classification to REFER** | Clinical safety — a missed positive is more dangerous than a false referral |
| All cost arithmetic uses **Decimal.js** — no native float operations | Billing accuracy |
| Role verified by **DB query on every API route** — never from session token alone | Security — forged tokens must not grant elevated access |
| BYOK keys **AES-256-GCM encrypted** server-side; never in DB plaintext, never in API responses, never in IndexedDB | Security — keys are use-and-store only |
| All AI provider URLs **hardcoded** — never user-controlled | SSRF guard |
| Demo encounters (`isDemoEncounter: true`) **never synced** to server | Data integrity — demo data must not pollute real encounter records |
| `NEXT_PUBLIC_` prefix **only for genuinely public** variables | Security — secrets must not appear in client bundles |
| No PII at any layer — no patient names, IDs, contact details | Regulatory (NDPR, GDPR) and ethical |

---

## Database

### Migrations

Migrations live in `supabase/migrations/`. Naming: `NNNN_description.sql` (zero-padded 4-digit sequence). Run in order in Supabase SQL Editor.

Current range: `0001_init.sql` through `0021_telegram_auth.sql`.

### RLS

Every table has Row Level Security enabled. The service role key (which bypasses RLS) is used **only** in server-side API routes — never in client-side code. Write RLS tests that verify cross-facility data isolation.

---

## Test Patterns

Tests are plain `.mjs` files run directly with Node. No test framework dependency.

Each test file exports a `run()` function that throws on failure. The test runner in CI calls each file directly. To add a new test:

1. Create `tests/<name>.test.mjs`
2. Verify the specific behaviour with assertions (`if (result !== expected) throw new Error(...)`)
3. Add the file to the test list in `.github/workflows/ci.yml`

Security tests (RLS enforcement, BYOK key handling) live in `tests/security/`.

---

## Security Rules

**Never do this:**
- `NEXT_PUBLIC_` on any secret (API keys, service role key, BYOK encryption key)
- `dangerouslySetInnerHTML` without DOMPurify sanitisation
- Hardcode AI provider URLs anywhere — they are in `lib/ai/constants.ts` only
- Store images in React state, IndexedDB, localStorage, or transmit to server (except via the explicit cloud-AI proxy with immediate server-side discard)
- Store BYOK keys in IndexedDB, localStorage, Redis, or return them in plaintext in any API response
- Read role or admin status from the session token alone — always query the DB
- Use native float arithmetic for token counts or cost calculations — use Decimal.js
- Sync demo encounters (`isDemoEncounter: true`) to the server

**Safe patterns:**
- User input going into AI prompts: wrap in `---USER_CONTEXT_START---` / `---USER_CONTEXT_END---` delimiters
- Validating request bodies: use Zod schemas at the API boundary
- Rate limiting: use Upstash Ratelimit in Next.js middleware
- Cost arithmetic: `new Decimal(inputTokens).times(RATE_PER_TOKEN)`
