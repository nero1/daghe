# Daghe

**AI-assisted cervical cancer screening for community health workers — offline-first PWA.**

Daghe (Esan: "to see") is a multilingual Progressive Web App (PWA) that helps community health workers (CHWs) and nurses perform Visual Inspection with Acetic Acid (VIA) cervical cancer screening — with or without an internet connection.

---

## What Daghe Does

- Guides CHWs through a structured VIA screening flow
- Runs a 5-step AI inference chain: on-device TFLite → Gemini Flash → GPT-4o → offline rule-based → reference
- Works fully offline after first install — AI models pre-cached via Service Worker
- Saves screening encounters locally; syncs when connectivity returns
- Supervisors can view a cost dashboard, manage BYOK API keys, and toggle AI providers
- Supports English, Hausa (ha), Yoruba (yo), Igbo (ig), and French (fr)

---

## AI Inference Chain

| Step | Method | When Used |
|---|---|---|
| 1 | TFLite on-device (WASM) | Always tried first |
| 2 | Gemini Flash (cloud) | If TFLite unavailable |
| 3 | GPT-4o (cloud) | If Gemini fails |
| 4 | WHO VIA rule-based questions | If offline |
| 5 | Reference classification | Reserved |

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
supabase/migrations/0015_encounters.sql     — encounters table (VIA results)
supabase/migrations/0016_user_api_keys.sql  — BYOK encrypted API keys
supabase/migrations/0017_ai_usage_log.sql   — AI call audit trail
supabase/migrations/0018_modules.sql        — module registry + admin_config
supabase/migrations/0019_facility_codes.sql — facility codes for shared devices
supabase/migrations/0020_encounters_rls.sql — RLS policies for encounters
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

## Security Notes

- BYOK keys are AES-256-GCM encrypted server-side — never stored or returned in plaintext
- Images held in memory only (`useRef`, never React state); nulled after inference; never transmitted
- All AI provider URLs are hardcoded (SSRF guard) — never user-controlled
- Prompt injection: user fields wrapped in `---USER_CONTEXT_START/END---` delimiters
- Demo encounters (`isDemoEncounter: true`) excluded from sync both client and server side
- Role verified by DB query on every API route — never from session token alone
- All cost arithmetic uses Decimal.js — no native float operations on billing data
- No PII stored at any layer — no patient names, IDs, or contact details
