# Daghe

**Offline-first, multi-modal AI medical imaging screening for community health workers.**

Daghe (Esan: "to see") is an offline-first Progressive Web App (PWA) for AI-assisted medical imaging screening. Community health workers (CHWs) and nurses capture or upload clinical images; Daghe analyses them using a 5-step AI inference chain and returns a POSITIVE / NEGATIVE / REFER classification — with or without an internet connection.

The platform is built as a pluggable **condition module** system. v1.0 ships with cervical cancer screening via VIA (Visual Inspection with Acetic Acid). Future modules — chest X-ray (TB), MRI, CT, ultrasound, skin lesions, retinal screening — can be added without changing core app code.

---

## What Daghe Does

- Guides CHWs through structured image screening flows across multiple imaging modalities
- Runs a 5-step AI inference chain: on-device TFLite → Gemini Flash → GPT-4o → DeepSeek → module-specific offline rule-based → reference
- Works fully offline after first install — AI models pre-cached via Service Worker
- Saves screening encounters locally; syncs when connectivity returns
- Supervisors can view a cost dashboard, manage BYOK API keys, and toggle AI providers
- Supports **19 languages**: English (en), Hausa (ha), Yoruba (yo), Igbo (ig), French (fr), Arabic (ar), Swahili (sw), Amharic (am), Oromo (om), Lingala (ln), Twi (tw), Ewe (ee), Ga (gaa), Dagbani (dag), Fula (ff), Wolof (wo), Zulu (zu), Xhosa (xh), Afrikaans (af)

---

## Condition Modules

Each module is a self-contained package defining: TFLite models, offline rule-based fallback, clinical reference text, demo images, and localised strings.

| Module | Modality | Status |
|---|---|---|
| `@daghe/cervical-via` | Cervical cancer — VIA | v1.0 (current) |
| `chest-xray-tb` | Chest X-ray — TB screening | Planned |
| `skin-lesion` | Skin / wound assessment | Planned |
| `retinal` | Retinal / eye screening | Planned |
| `malaria-slide` | Malaria slide reading | Planned |
| `ct-brain` | Brain CT interpretation | Planned |
| `mri-spine` | Spine MRI interpretation | Planned |
| `xray-general` | General X-ray interpretation | Planned |
| `ultrasound` | Ultrasound interpretation | Planned |

---

## AI Inference Chain

| Step | Method | When Used |
|---|---|---|
| 1 | TFLite on-device (WASM) | Always tried first |
| 2 | Gemini Flash (cloud) | If TFLite unavailable |
| 3 | GPT-4o (cloud) | If Gemini fails |
| 4 | DeepSeek (cloud) | If GPT-4o fails |
| 5 | Module-specific offline rule-based | If device is offline |
| 6 | Reference classification | Reserved for no-inference fallback |

**Safety rule:** LOW or REFERENCE_ONLY confidence always overrides classification to REFER, unconditionally.

---

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **Offline store:** Dexie.js (IndexedDB, DB name `daghe`)
- **On-device AI:** TensorFlow.js TFLite (WASM backend, dynamically imported)
- **Session cache:** Upstash Redis
- **Cost arithmetic:** Decimal.js (no native floats for billing)
- **Monorepo:** npm workspaces — `@daghe/web`, `@daghe/shared`, `@daghe/cervical-via`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis auth token |
| `BYOK_ENCRYPTION_KEY` | ✅ | 64-char hex AES-256 master key for BYOK key encryption |
| `GEMINI_API_KEY` | ⬜ | Google Gemini API key (platform key) |
| `GEMINI_ENABLED` | ⬜ | `"true"` to enable Gemini fallback |
| `GEMINI_MODEL` | ⬜ | Default: `gemini-2.0-flash` |
| `OPENAI_API_KEY` | ⬜ | OpenAI API key (platform key) |
| `OPENAI_ENABLED` | ⬜ | `"true"` to enable GPT-4o fallback |
| `OPENAI_MODEL` | ⬜ | Default: `gpt-4o` |
| `DEEPSEEK_API_KEY` | ⬜ | DeepSeek API key |
| `DEEPSEEK_ENABLED` | ⬜ | `"true"` to enable DeepSeek fallback |
| `DEEPSEEK_MODEL` | ⬜ | Default: `deepseek-chat` |
| `TELEGRAM_BOT_TOKEN` | ⬜ | Telegram bot token for widget auth |
| `FACILITY_JWT_SECRET` | ⬜ | Secret for facility-code JWT signing |

Generate `BYOK_ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Database Migrations

Run all migrations in order in Supabase SQL Editor:

```
supabase/migrations/0001_init.sql           — users, cases base tables
supabase/migrations/0002_cases_rls_policies.sql
supabase/migrations/0003_audit_logs.sql
supabase/migrations/0004_rls_least_privilege.sql
supabase/migrations/0005_regions_clinics.sql
supabase/migrations/0006_triage_rules.sql
supabase/migrations/0007_indexes.sql
supabase/migrations/0008_chw_stats.sql
supabase/migrations/0009_chw_stats_scope.sql
supabase/migrations/0010_cases_location.sql
supabase/migrations/0011_audit_logs_fields.sql
supabase/migrations/0012_case_flags.sql
supabase/migrations/0013_data_retention.sql
supabase/migrations/0014_triage_rule_version.sql
supabase/migrations/0015_encounters.sql     — encounters table (imaging results)
supabase/migrations/0016_user_api_keys.sql  — BYOK encrypted API keys
supabase/migrations/0017_ai_usage_log.sql   — AI call audit trail
supabase/migrations/0018_modules.sql        — module registry + admin_config
supabase/migrations/0019_facility_codes.sql — facility codes for shared devices
supabase/migrations/0020_encounters_rls.sql — RLS policies for encounters
supabase/migrations/0021_telegram_auth.sql  — Telegram auth columns
```

---

## TFLite Model Files

Place model files in `apps/web/public/models/`:
- `efficientdet-lite3-cervical-v1.2.tflite` (detection / ROI localisation)
- `mobilenetv2-cervical-via-v1.2.tflite` (classification)

Models are served statically and cached by the Service Worker in `daghe-models-v1` Cache API storage. The `ModelLoader` component downloads them in the background after first authentication.

---

## Development

```bash
npm install
npm run dev --workspace=apps/web
```

### Run tests
```bash
node tests/encounters.test.mjs
node tests/ai-chain.test.mjs
node tests/byok.test.mjs
node tests/cost-calc.test.mjs
node tests/quality-check.test.mjs
node tests/security/prompt-injection.test.mjs
node tests/security/demo-mode.test.mjs
```

### Bundle analysis
```bash
ANALYZE=true npm run build --workspace=apps/web
```

---

## Auth Methods

- **Google OAuth** (primary) — via Supabase Auth OAuth flow (`/api/auth/google` → `/api/auth/callback`)
- **Telegram Login Widget** (secondary) — HMAC-SHA256 validated server-side
- **Email + password** — fallback when OAuth providers are disabled
- **4-digit PIN** — optional, for sensitive operations (BYOK settings, quality override)
- **2FA** — TOTP (Google Authenticator / Authy) for supervisor/admin roles
- **Facility-linked mode** — shared-device deployments using facility codes; no personal login required

---

## Security Notes

- BYOK keys are AES-256-GCM encrypted server-side — never stored or returned in plaintext
- Images held in memory only (`useRef`, never React state); nulled after inference; never transmitted
- All AI provider URLs are hardcoded (SSRF guard) — never user-controlled
- Prompt injection: user fields wrapped in `---USER_CONTEXT_START/END---` delimiters
- Demo encounters (`isDemoEncounter: true`) excluded from sync both client and server side
- Role verified by DB query on every API route — never from session token alone
- All cost arithmetic uses Decimal.js — no native float operations on billing data
- No PII stored at any layer — no patient names, IDs, or contact details
