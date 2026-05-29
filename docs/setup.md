# Daghe Setup Guide

This guide covers setting up Daghe for development and production deployment.

## 1) What Daghe Is

Daghe is an offline-first AI-assisted medical imaging screening PWA — starting with cervical cancer VIA screening and extensible to CT, MRI, X-ray, ultrasound, skin lesions, retinal imaging, and more via its pluggable module system. Community Health Workers (CHWs) can:
- Capture or upload clinical images for AI-assisted analysis across multiple imaging modalities
- Get on-device AI results (TFLite WASM) or cloud AI results (Gemini, GPT-4o) — with or without internet
- Work fully offline with module-specific rule-based fallback
- Save encounters locally, sync when connectivity returns
- Supervisors manage facilities, BYOK API keys, and view cost dashboards

## 2) Accounts and Services

1. **GitHub** — code hosting + CI (GitHub Actions)
2. **Vercel** — web hosting
3. **Supabase** — database (PostgreSQL) + auth
4. **Upstash** — Redis (session cache, rate limiting)
5. **AI providers** (at least one): Google Gemini, OpenAI, DeepSeek

## 3) Generate Required Secrets

### BYOK_ENCRYPTION_KEY (required)
This 32-byte AES-256 master key encrypts all supervisor API keys at rest.
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Store the output (64 hex chars) in your environment. Never commit it.

### FACILITY_JWT_SECRET (optional — for shared-device deployments)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4) Supabase Setup

1. Create a new Supabase project.
2. From Project Settings → API, copy:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. In SQL Editor, run all 21 migration files in order:
   ```
   supabase/migrations/0001_init.sql through 0021_telegram_auth.sql
   ```
4. In Supabase Auth → Users, create accounts and set `user_metadata.role` to `chw`, `supervisor`, or `admin`.

## 5) Upstash Redis Setup

1. Create an Upstash Redis database.
2. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

## 6) TFLite Model Files

Place model files in `apps/web/public/models/`. Model filenames vary by module — for the v1.0 `cervical-via` module:
- `efficientdet-lite3-cervical-v1.2.tflite` (ROI detection)
- `mobilenetv2-cervical-via-v1.2.tflite` (classification)

Future modules (chest X-ray, MRI, CT, etc.) will add their own model filenames to this directory. All models are served as static files and cached by the Service Worker in the `daghe-models-v1` Cache API. The `ModelLoader` component (rendered after auth) downloads them in the background.

## 7) Local Development

```bash
npm install
```

Copy `.env.local.example` to `apps/web/.env.local` and fill in values:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
BYOK_ENCRYPTION_KEY=<64 hex chars>
GEMINI_API_KEY=...
GEMINI_ENABLED=true
OPENAI_API_KEY=...
OPENAI_ENABLED=true
```

```bash
npm run dev --workspace=apps/web
```

## 8) Deploy to Vercel

1. Import the GitHub repo into Vercel.
2. Framework: Next.js (auto-detected).
3. Add all environment variables from the table in README.md.
4. Deploy.

## 9) Dexie.js / IndexedDB Migration Notes

- The IndexedDB database is named `"daghe"` (was `"asibi"` in the previous codebase).
- If users have data in the old `"asibi"` database, it will not be migrated automatically — they should sync pending cases before upgrading.
- Current Dexie schema version: `1` (stores: `encounters`, `devicePrefs`, `facilityToken`).

## 10) Environment Variables Reference

See README.md for the full table. All AI provider keys are optional — the app gracefully degrades to offline rule-based mode if no AI provider is available.

## 11) CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs:
- Lint, typecheck, security audit
- Migration file count + syntax check
- Build
- 14 unit/security/offline test suites
- Deploy to Vercel on `main` push (requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` secrets)

## 12) Common Issues

- **BYOK_ENCRYPTION_KEY wrong length**: Must be exactly 64 hex characters (32 bytes). Generate with the command above.
- **Models not loading**: Place `.tflite` files in `public/models/`. Check browser DevTools → Application → Cache Storage for `daghe-models-v1`.
- **Sync fails with 400**: Check that encounter records have `isDemoEncounter: false` and valid UUID `idempotencyKey`.
- **Typecheck fails on new routes**: Run `npm run build --workspace=apps/web` first to regenerate `.next/types/routes.d.ts`.
