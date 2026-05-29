# Daghe — Product Requirements Document
**Version:** 1.2  
**Author:** NG44 Consulting Ltd  
**Last Updated:** May 2026  
**Status:** Pre-Build / Active Development  

---

## A NOTE TO THE DEVELOPER

This PRD is the single source of truth for building Daghe. Every requirement, constraint, and implementation detail the developer needs is in this document. Do not make assumptions about anything not stated here — if something is unclear, ask before implementing. Do not substitute a simpler or faster approach for a specified one without explicit approval from NG44.

Where specific implementation approaches are called out (e.g. "server-side encrypted field, not client-side storage"), these are non-negotiable requirements, not suggestions. They exist for security, regulatory, or clinical safety reasons that may not be immediately obvious from context.

This document will be updated as new decisions are made. Always work from the latest version.

---

## 1. Product Overview

### 1.1 Vision

Daghe (from the Esan language: "to see" / "vision") is an offline-capable, mobile-first Progressive Web Application that assists trained healthcare workers — including nurses, midwives, and community health workers (CHWs) — in the capture and AI-assisted interpretation of medical images and visual clinical findings. It delivers real-time clinical decision support at the point of care, without requiring specialist equipment or reliable internet connectivity.

Daghe is designed as an extensible multi-condition visual diagnostic support platform. It launches with AI-Assisted Cervix Visualization (AI-ACVT) for cervical cancer screening via VIA (Visual Inspection with Acetic Acid) and is architected from day one to support an expanding library of visual medical tasks: reading X-rays, interpreting wound images, analysing skin conditions, reviewing scans, and more. New disease/condition modules are continuously added over time.

### 1.2 Relationship to Asibi

Daghe is built on the Asibi codebase, adapted and extended for vision-based diagnostic tasks. Where Asibi uses symptom-based triage flows to guide clinical decisions, Daghe adds a camera capture and on-device AI inference layer that analyses images directly. The two products share:

- Offline-first PWA architecture (service workers, IndexedDB, cache-first strategy)
- Three-layer storage model
- Multilingual support framework
- CHW-optimised UX principles (one-thumb navigation, three-tap maximum to result, high contrast)
- Next.js + Supabase / PostgreSQL stack
- Admin dashboard architecture

Daghe is a standalone product. It does not depend on Asibi being installed and may in future be integrated with Asibi as a module.

### 1.3 Target Users

- **Primary:** Community health workers (CHWs), nurses, midwives in primary and secondary health facilities in Nigeria and broader LMICs
- **Secondary:** Clinic supervisors and programme managers monitoring screening activity
- **Tertiary:** National and state health programme administrators
- **Admin:** NG44 platform administrators

### 1.4 Core Design Principles

1. Offline-first — all critical functions work without internet
2. One-thumb navigation — designed for single-hand use on a phone
3. Three-tap maximum to result — from launch to clinical output in three taps
4. High contrast — readable in direct sunlight and low-light conditions
5. No PII stored on-device — patient privacy is non-negotiable
6. Extensible by design — new disease modules add without breaking existing ones
7. Graceful degradation — every component has a defined fallback; no blank screens, no dead ends
8. Developer explicitness — implementation details in this PRD are requirements, not hints

---

## 2. Goals and Non-Goals

### 2.1 Goals

- Deliver a validated, offline-capable AI-assisted VIA cervical screening tool as the launch module
- Provide a reusable, extensible visual diagnostic platform that supports new medical imaging tasks over time
- Support deployment across Nigeria and LMIC health systems with zero proprietary hardware dependency
- Achieve NAFDAC registration for the cervical screening module by end of 2027
- Serve as the technical foundation for NG44's CHAI AI-ACVT RFP submission

### 2.2 Non-Goals (v1.0)

- Daghe is not a standalone diagnostic tool — it is a clinical decision support tool. It does not replace clinical judgment.
- Daghe does not perform lab analysis, process blood/urine samples, or interpret non-visual clinical data in v1.0
- Daghe is not a telemedicine platform (no live video or remote specialist consultation in v1.0)
- Daghe does not require, and does not produce, personally identifiable information
- X-ray and scan interpretation modules are planned but not in scope for v1.0

---

## 3. Functional Requirements

### 3.1 Disease / Condition Module System

Daghe is built around a pluggable **condition module** architecture. Each module defines:

- Module ID and name
- Required input type (camera image / uploaded image / scan / etc.)
- On-device AI model (TFLite) to use
- Output schema (classification labels, confidence bands, recommended actions)
- Offline triage fallback logic (rule-based, stored as JSON, cached by service worker)
- Localised strings for all supported languages
- Clinical reference documentation (cached offline by service worker)
- Demo images for demo mode

**v1.0 launch module:** `cervical-via` — AI-assisted VIA cervical cancer screening

**Planned modules (post-v1.0):**
- `chest-xray-tb` — Chest X-ray interpretation (TB screening)
- `skin-lesion` — Skin / wound assessment
- `retinal` — Eye / retinal image screening
- `malaria-slide` — Malaria slide reading
- `ct-brain` — Brain CT abnormality detection
- `ct-chest` — Chest CT interpretation
- `ct-abdomen` — Abdominal CT interpretation
- `mri-brain` — Brain MRI interpretation
- `mri-spine` — Spine MRI interpretation
- `xray-fracture` — General X-ray for fracture detection
- `xray-pneumonia` — Chest X-ray for pneumonia / TB
- `ultrasound-obstetric` — Basic obstetric ultrasound
- `ultrasound-abdominal` — Abdominal ultrasound
- `dental-caries` — Dental caries screening
- `muac-malnutrition` — Malnutrition / MUAC visual assessment

For scan-based modules (CT, MRI, X-ray, ultrasound), the module `inputType` is set to `"uploaded-image"`, allowing healthcare workers to photograph or upload PACS/DICOM-exported images for analysis. The inference pipeline is identical — TFLite on-device → cloud AI fallback → rule-based fallback — with module-specific models and prompts.

New modules are added via a module registry in the admin panel. Admin can enable/disable individual modules per deployment. The module system must be designed so that adding a new module never requires changes to core application code — only the addition of the module package and a registry entry.

---

### 3.2 Cervical VIA Module (`cervical-via`) — v1.0

#### 3.2.1 Intended Use

Daghe assists a trained healthcare worker in:
1. Capturing a cervical image during a VIA procedure (acetic acid already applied by the clinician before the image is taken)
2. Receiving an AI-supported output: Positive / Negative / Refer for further assessment
3. Recording the screening encounter for later sync
4. Making a same-visit treatment or referral decision with AI-assisted support

#### 3.2.2 AI Model Architecture

- **Detection stage:** EfficientDet-Lite3 (TFLite) — ROI (region of interest) detection and cervix localisation
- **Classification stage:** MobileNetV2 (TFLite) — acetowhite lesion classification (Positive / Negative / Indeterminate)
- **Deployment format:** TFLite with INT8 quantisation for Android NPU/CPU
- **Runtime:** TensorFlow.js TFJS-tflite with WASM backend — runs entirely in the browser, no server-side component, works offline once cached. Do NOT use tflite-node or any server-side TFLite runtime — the app must perform inference fully offline in the browser.
- **Minimum device:** Android 8.0+, 2GB RAM, 8MP rear camera
- **Model source:** Global Health Labs AI-ACVT source (via CHAI partnership) + NG44 Nigeria-specific fine-tuning on annotated VIA dataset. Until the fine-tuned model is available, a placeholder MobileNetV2 model (e.g. ImageNet-pretrained) must be wired into the pipeline so the full inference flow is demonstrable end-to-end.

#### 3.2.3 Screening Flow

```
Launch → Select Module (Cervical VIA) → Patient Context (age range, screening reason — no name)
→ Image Capture Guide → Capture / Upload → Quality Check → AI Inference → Result Screen
→ Recommended Action → Case Log (local save) → Sync when online
```

**Steps in detail:**

1. **Patient context:** Age range selector (5-year bands: 25-29, 30-34, 35-39, 40-44, 45-49, 50+), screening context (routine / referral / HPV-positive triage), optional free-text notes field (notes are never synced to the server; they are stored locally only and cleared when the device cache is cleared). No name, no ID number, no phone number. The notes field must include a visible label: "Notes are stored on this device only and never uploaded."

2. **Image capture guide:** Animated overlay showing correct positioning, distance indicator, and lighting guidance. Healthcare workers who have completed certification can skip this screen via a "Skip — I'm certified" tap. The skip preference is remembered per device session but resets on next app launch, to prevent habituation skipping during training.

3. **Capture / upload:** Primary method is device camera (rear camera, accessed via browser MediaDevices API). Secondary method is gallery upload. The app must apply real-time image quality checks before accepting the image — do not wait until after submission to check quality.

4. **Quality check:** Three automated quality checks run on every image before inference:
   - Blur detection (Laplacian variance threshold — reject if below configurable threshold stored in module manifest)
   - Exposure check (reject if mean pixel brightness is below 30 or above 220 on 0-255 scale)
   - Framing check (EfficientDet-Lite3 ROI detection used here — if no cervix ROI is detected with >50% confidence, prompt recapture)
   
   On failure, the user receives specific plain-language feedback ("Image too dark — move to a brighter area" / "Image blurry — hold the device steady" / "Cervix not detected — reposition the device"). Maximum 3 guided recapture attempts. After 3 failures, the user is offered an override option ("Continue anyway — result confidence may be lower"). Override is logged in the case record as `quality_override: true`.

5. **AI inference:** Runs the full 5-step fallback chain as defined in Section 5.2.2. The result screen always displays which inference method was used and its confidence level. This is a clinical safety requirement — a CHW must always know whether they are looking at an on-device AI result, a cloud AI result, or a rule-based estimate.

6. **Result screen:** Three possible outputs. See Section 6.2 for full UI specification.
   - **NEGATIVE** — No acetowhite lesion detected. Recommended action: routine rescreening in 3 years.
   - **POSITIVE** — Acetowhite lesion detected. Recommended action: refer for colposcopy / same-visit cryotherapy if eligible.
   - **REFER** — Indeterminate or low-confidence result. Recommended action: escalate to supervising clinician. Note: a LOW CONFIDENCE result from any inference method must always produce a REFER output regardless of the raw classification. This is non-negotiable for clinical safety.

7. **Confidence display:** Confidence band is always visible on the result screen without any tap or scroll. It is not a tooltip or expandable element. See Section 5.2.3 for the full confidence label specification.

8. **Case log entry:** On result, the app immediately creates a local case log entry in IndexedDB. The entry includes:
   - Unique encounter ID (UUID v4, generated client-side)
   - Facility ID and user ID (or facility code for facility-linked mode)
   - Module ID (`cervical-via`)
   - Patient age band and screening context
   - AI result (POSITIVE / NEGATIVE / REFER)
   - Confidence band (HIGH / MODERATE / LOW / REFERENCE ONLY)
   - Inference method used (tflite / gemini / gpt4o / rule-based / reference)
   - Quality override flag (true/false)
   - Action taken (recorded by CHW after result: treated / referred / monitored / declined)
   - Image hash (SHA-256 of the image bytes — stored for audit purposes, not the image itself)
   - Timestamp (device local time + UTC)
   - Sync status (pending / synced / failed)
   
   The image itself is NOT stored in IndexedDB or anywhere on the device after the session ends. The image is held in memory only for the duration of the active screening. When the user navigates away from the result screen or starts a new screening, the image is explicitly cleared from memory. Do not rely on garbage collection alone — explicitly null the image reference.

9. **Sync:** Background sync to Supabase / PostgreSQL when device is online. See Section 5.4 for sync architecture. Images are never transmitted to the server unless admin has explicitly enabled image upload AND the patient has given explicit consent (consent screen presented in their language before image capture if image upload is enabled).

---

### 3.3 Demo Mode

- Accessible from the home screen without requiring login
- Loads 3 pre-labelled demo VIA images (one positive, one negative, one indeterminate) bundled with the app and cached by the service worker at install time
- Runs the full inference pipeline — including the quality check, TFLite inference, and confidence label — on demo images
- Shows annotated results with plain-language explanatory text explaining what the model detected and why
- A persistent yellow DEMO banner is displayed on every screen throughout demo mode. It must not be dismissible and must not disappear. This is a clinical safety requirement.
- Demo encounters are never written to the case log and never synced. If a developer accidentally wires demo mode to the case log, this is a bug that must be treated as critical.
- Demo mode works fully offline — all demo images and annotations are bundled and cached
- Useful for: CHW training, product demonstrations to funders and partners, new user onboarding

---

### 3.4 Offline Fallback (Rule-Based Triage)

When TFLite model inference fails (model not yet downloaded on first install, model file corrupted, or WASM unavailable on the device):

- The rule-based VIA fallback activates automatically with no user action required
- The CHW is shown a structured set of plain-language visual observation questions:
  - "Is there a white patch on the cervix after applying the acid?" (Yes / No / Unsure)
  - "Does the white patch touch the central opening (os)?" (Yes / No / Not applicable)
  - "Is the white patch raised or has an irregular border?" (Yes / No / Unsure)
- The app generates a risk classification based on these answers using WHO VIA interpretation guidelines (stored as a decision tree in `fallback-logic.json` within the module package, cached offline)
- The result screen clearly shows: "RULE-BASED RESULT — No image analysis performed" in addition to the standard confidence label (MODERATE CONFIDENCE)
- The case log entry records `inference_method: 'rule-based'` and `quality_override: false`
- The rule-based fallback is also available as a manual option on the image capture screen via a "Use text-based assessment instead" link, for situations where the camera cannot be used (e.g. device camera hardware failure)

---

### 3.5 User Roles

| Role | Permissions |
|---|---|
| CHW (Community Health Worker) | Perform screenings, view own case log, access demo mode, device-level AI/sync toggles |
| Supervisor | All CHW permissions + view all case logs for their facility, flag/review cases, run facility reports, BYOK API key management, cost tracker view |
| Programme Manager | All Supervisor permissions + cross-facility reporting, CHW management, facility management |
| Admin | Full platform access, all configuration, module management, user management, system configuration, platform-wide AI provider management, cost dashboards |

**Implementation notes:**
- Role is stored in the database `users` table, not in the JWT or session token alone. Every server-side API route that requires a minimum role must verify the role by querying the database, not by reading the session token. A compromised or forged token that contains an elevated role claim must not grant elevated access.
- Role checks must be enforced at the API route level, not just the UI level. A CHW who manually calls a supervisor API endpoint must receive a 403 response.
- The `is_admin` check specifically must always query the database. Never derive admin status from session data alone.

---

### 3.6 Authentication

- Google OAuth (primary) via Supabase Auth
- Telegram Login Widget (secondary) via Supabase Auth
- Both toggleable independently in admin panel (both enabled by default). Admin can disable either provider globally. If both are disabled, the app falls back to email+password only.
- After onboarding, users are periodically prompted (not forced, and not on every login — maximum once every 14 days) to add an email address and set a password for account recovery. This prompt is dismissible.
- Optional 4-digit PIN for protecting sensitive operations: accessing the BYOK API key settings screen, overriding a quality check failure, and any result override. The PIN is stored as a bcrypt hash in the `users` table — never in plaintext, never in IndexedDB, never in the JWT. PIN verification must happen server-side.
- 2FA via authenticator app (Google Authenticator / Authy) available for Supervisor and above roles. Admin can make 2FA mandatory for specific roles via admin config.
- **Facility-linked mode:** CHW users can operate without a personal account. The device is registered to a facility using a facility code. Screenings are attributed to the facility, not to an individual. This mode is designed for shared-device deployments where multiple CHWs use one phone. In facility-linked mode: no personal data is stored, no login is required, the sync queue is attributed to the facility ID. The facility code is stored in IndexedDB. Facility-linked mode sessions do not use JWT — they use a short-lived facility token issued by the server when the facility code is validated.
- JWT access tokens expire after 1 hour. Refresh tokens expire after 30 days. Refresh tokens are rotated on use (each use issues a new refresh token and invalidates the old one). Refresh token rotation must be implemented server-side — do not rely on Supabase default token behaviour without verifying it matches this spec.
- Sessions are stored in Redis (ioredis or Upstash, selected via `REDIS_PROVIDER` env var). Redis session records include: user ID, role (from DB at login time), facility ID, token version counter (incremented on password change or logout to invalidate all existing sessions for that user).

---

### 3.7 Case Log and Data Management

- All case data is written to IndexedDB first, synchronously, before any network operation is attempted. The local write is the primary record. The server sync is a secondary copy.
- Sync to Supabase / DigitalOcean PostgreSQL is background and non-blocking. It must never block the screening flow or make the user wait.
- Sync is idempotent: each encounter has a UUID generated client-side. If the same UUID is submitted to the server twice (e.g. due to a network failure and retry), the server must upsert by UUID, not create a duplicate. This must be enforced at the database level with a unique constraint on `encounters.id`, not just application-level logic.
- Images are held in memory only during the active screening session. When the user navigates away from the result screen or starts a new screening, the image reference is explicitly nulled and the object URL is explicitly revoked (URL.revokeObjectURL). Do not rely on garbage collection.
- Image hashes (SHA-256) are stored in the case log for audit and model improvement purposes. The hash is computed client-side before the image is discarded.
- If admin enables image upload (disabled by default): images are uploaded to a server-side storage bucket (Supabase Storage or DigitalOcean Spaces, matching the DB provider choice) over an encrypted connection. Images are stored server-side with the encounter UUID as the filename. No PII is in the filename. The consent screen before image capture must explain in plain language: "Your image will be securely stored to help improve the AI. It will not be shared without further consent." This screen must be shown in the user's selected language.
- Row Level Security (RLS) is enforced on all database tables. The RLS policies are:
  - CHWs: SELECT on `encounters` WHERE `facility_id = auth.facility_id()` AND `user_id = auth.uid()` (own records only)
  - Supervisors: SELECT on `encounters` WHERE `facility_id = auth.facility_id()` (whole facility)
  - Programme Managers: SELECT on `encounters` WHERE facility is in their managed set
  - Admin: full access via service role key (server-side only — the service role key is never exposed to the client)
- Cursor-based pagination must be used for all list views (case log, user list, facility list). Offset-based pagination is not acceptable — it performs poorly at scale and produces inconsistent results under concurrent writes. Only add offset pagination as a clearly labelled fallback if cursor pagination is technically blocked by a specific query requirement.
- Data retention: configurable by admin (default 5 years). Automated deletion of records older than the retention threshold runs via cron. Before deletion, records are soft-deleted (flagged `deleted_at`) for 30 days, then hard-deleted. The soft-delete window allows recovery if a retention setting is changed accidentally.
- GDPR and NDPR (Nigeria Data Protection Regulation) compliant. No PII is collected. If the product is extended in future to collect PII, a full DPIA (Data Protection Impact Assessment) must be completed before that feature is built.

---

### 3.8 Admin Panel

The admin panel is accessible only to users with the Admin role. All admin API endpoints must verify admin status by querying the database on every request — not from session data alone.

Features:

- **Module management:** Enable/disable condition modules per deployment. View module version, last updated, model version in use. Trigger module update.
- **User management:** Create, edit, deactivate users. Assign roles and facilities. View login history. Reset 2FA. Force password reset.
- **AI provider management:** Per-provider toggle (ON/OFF), central API key management, BYOK visibility (see Section 5.2.4). Cost dashboard.
- **AI model management:** View current TFLite model version per module. Trigger OTA model update. View update status per device (last check-in, current version). Roll back to previous model version.
- **Case log review:** Search and filter encounters by facility, date range, result, inference method, quality override flag. Export CSV / JSON.
- **Performance monitoring dashboard:** See Section 8.
- **Email settings:** Master toggle (ALL email ON/OFF), Non-Critical email toggle, granular per-notification-type toggles. Changes take effect immediately without redeployment.
- **Theme management:** Enable/disable light mode, dark mode. Create and manage custom themes (colour palette + font settings). Toggle custom themes on/off.
- **Captcha:** Toggle between Cloudflare Turnstile (default) and Google reCAPTCHA. Only one active at a time.
- **Footer scripts:** A text area where admin can paste analytics scripts, third-party scripts, tracker scripts, or simple HTML. These are injected into the page footer. Sanitise to prevent XSS from admin-injected scripts affecting other admin users — treat this as untrusted input even though it comes from an admin.
- **Cron job management:** View last run time and result for each cron job. View next scheduled run. Manually trigger any cron job. View cron job logs (last 100 runs per job).
- **System health:** Database connection status (Supabase / DigitalOcean), Redis connection status, TFLite model load status, Mailgun API status, last successful sync timestamp across all facilities.
- **Database backend:** Display current DB provider (read from env var). Switching provider requires an env var change and redeployment — the admin panel shows instructions for how to do this but does not do it in-app.
- **Seed data:** Button to re-run seed data (adds demo facility, demo users, demo encounters if not already present — does not overwrite existing production data).

---

### 3.9 Notifications and Email

Email is sent via Mailgun. Email is used sparingly — the default posture is minimal email.

**All roles — critical only (cannot be turned off by admin):**
- Account created confirmation (sent once on first login)
- Password reset link
- Account recovery instructions

**Supervisor and above — opt-in, admin-toggleable:**
- Weekly facility screening summary (sent every Monday, 08:00 local time)
- Flagged case alerts (when a CHW flags a case for supervisor review)
- AI model update notifications (when a new TFLite model version is available)

**Admin — opt-in, admin-toggleable:**
- System alerts: database connection failure, Redis failure, Mailgun delivery failure, model update failure
- Daily spend alert (when AI API cost exceeds configured threshold)
- New user registration notifications (off by default)
- All Supervisor notifications (if desired)

**Admin email settings behaviour:**
- "Turn off ALL email" toggle: disables all email including critical notifications. Admin must explicitly acknowledge the risk before enabling this ("This will disable password reset emails. Users who lose access will be unable to recover their accounts without contacting you directly.").
- "Turn off Non-Critical email" toggle: disables everything except the three critical notifications listed above.
- Granular toggles: each notification type has an individual on/off toggle where Mailgun plan supports it.
- All email setting changes are logged in the audit log.

No SMS. No push notifications in v1.0 (planned for v1.1 via Web Push API).

---

### 3.10 Multilingual Support (i18n)

All UI strings, result labels, recommended action text, confidence label explanations, clinical guidance, consent screens, error messages, and onboarding copy are fully internationalised. Hard-coded English strings in the UI are not acceptable — every user-visible string must go through the i18n system.

**Languages supported (19 — full parity with the Asibi platform):**

| Code | Language | Code | Language |
|---|---|---|---|
| `en` | English | `om` | Oromo |
| `ha` | Hausa | `ln` | Lingala |
| `yo` | Yoruba | `tw` | Twi |
| `ig` | Igbo | `ee` | Ewe |
| `fr` | French | `gaa` | Ga |
| `ar` | Arabic | `dag` | Dagbani |
| `sw` | Swahili | `ff` | Fula |
| `am` | Amharic | `wo` | Wolof |
| `zu` | Zulu | `xh` | Xhosa |
| `af` | Afrikaans | | |

All 19 language codes are present in `i18n.ts`. English is the reference translation. Professional clinical translations for new screening-specific strings (e.g. VIA result explanations, capture guide instructions) are being validated by clinical partners. All non-English strings that have not yet received clinical validation are flagged with a translator note and default to the English value. This is not a blocker for v1.0 — the core app UX strings are fully translated in all 19 languages.

**RTL support:** Not required for v1.0. All CSS uses logical properties (`margin-inline-start`, `padding-block`, etc.) so RTL layout for Arabic, Amharic, and other RTL scripts can be enabled without a layout rewrite.

Language selection persists in IndexedDB per device. Admin can configure which languages are available per deployment (e.g. a deployment in Senegal might enable French and Wolof, disable Igbo).

The language selector is the first screen on onboarding. It must show each language's name written in that language (e.g. "Hausa" in Hausa script, "Yorùbá" in Yoruba script), not the English name of the language.

Right-to-left (RTL) layout support is not required for v1.0 but the CSS must use logical properties (e.g. `margin-inline-start` not `margin-left`) so that RTL support can be added without a layout rewrite when Arabic or other RTL languages are added.

---

## 4. Non-Functional Requirements

### 4.1 Performance

- Initial page load (first visit, cold cache): under 3 seconds on a 3G connection (tested at 1.5 Mbps, 300ms RTT)
- Initial page load (warm cache / offline): under 1 second
- TFLite inference time: under 3 seconds on a mid-range Android device (2GB RAM, Snapdragon 450 equivalent or better)
- Sync operation: background, non-blocking — must not freeze or delay the UI under any circumstances
- All external API calls (cloud AI, Mailgun, etc.) must implement retries with exponential backoff and jitter. Base delay: 500ms. Max delay: 30 seconds. Max retries: 3 for user-triggered operations, 5 for background operations.
- App must handle 10,000+ concurrent users without degradation. Use Vercel edge functions and stateless API routes. Do not use global in-memory state in API routes.
- Bundle size: total JS bundle (excluding TFLite models) must not exceed 500KB gzipped. Use code splitting aggressively — the TFLite inference module must be dynamically imported and not included in the initial bundle.
- TFLite model files are large (10–50MB each). They must be downloaded in the background after first app load, not blocking the initial render. Show a progress indicator for model download. The app must be fully usable (with rule-based fallback) before the model download completes.

### 4.2 Security

Full defence-in-depth. Every item below is a requirement, not a recommendation:

- **OWASP Top 10:** All items must be mitigated. Run OWASP ZAP scan before production release and resolve all High and Medium findings.
- **XSS:** All user-controlled content rendered in the UI must be escaped. React's default JSX escaping provides baseline protection — do not use `dangerouslySetInnerHTML` anywhere except the admin footer script injection field, and even there, run the content through DOMPurify before injection.
- **CSRF:** All state-changing API routes must validate the origin header and use CSRF tokens where applicable. Supabase Auth handles CSRF for auth routes — verify this is configured correctly.
- **SSRF:** Server-side API routes that make outbound HTTP requests (e.g. calling AI provider APIs) must validate that the target URL matches a whitelist of known provider domains. Do not pass user-controlled URLs to server-side HTTP clients.
- **AI prompt injection:** All user-supplied input that is included in prompts sent to AI providers (e.g. the notes field, screening context) must be sanitised and wrapped in delimiters that clearly separate user content from system instructions. Test that a user cannot alter the AI's instructions by including prompt-injection strings in the notes field.
- **Bot detection:** Rate limiting on all API routes via Vercel middleware or Upstash Ratelimit. Cloudflare Turnstile (default) or Google reCAPTCHA on all forms. Block requests with no User-Agent. Flag and soft-block IPs that exceed rate limits.
- **Role verification:** Every server-side API route that requires a minimum role must verify role by database query, not session token alone. See Section 3.5.
- **API key security:**
  - NG44 central API keys (Gemini, GPT-4o, DeepSeek) are stored as environment variables only. They are never in the database, never in client-side code, never in logs.
  - Supervisor BYOK keys are stored encrypted in the database `user_api_keys` table using AES-256-GCM encryption. The encryption key is stored as an environment variable (`BYOK_ENCRYPTION_KEY`), not in the database. BYOK keys must never be stored in IndexedDB, localStorage, sessionStorage, or any client-side storage. They must never appear in API responses in plaintext. The only operations allowed on a stored BYOK key are: use it server-side to make an API call, or delete it. The user can see that a key is stored (masked: `●●●●●●●●●●`) but can never retrieve the plaintext key after saving it.
  - When a BYOK key is submitted by a supervisor, it is immediately sent to the server over HTTPS, validated with a lightweight test API call, encrypted, and stored. The plaintext key must not be stored anywhere — not even briefly in Redis — after the validation call completes.
- **Connection pooling:** Use Supabase's built-in connection pooler (PgBouncer) for Supabase deployments. For DigitalOcean PostgreSQL, configure PgBouncer or use a connection pool in the application layer (pg-pool, max 10 connections per serverless function instance). Serverless functions must not open unbounded database connections.
- **RLS:** Every table in the database must have Row Level Security enabled. The service role key (which bypasses RLS) must only be used in server-side API routes, never in client-side code or in the Supabase anon key context.
- **Secrets never in client-side code:** Use `NEXT_PUBLIC_` prefix only for variables that are genuinely safe to expose publicly (e.g. Supabase anon key, Turnstile site key). All other secrets are server-side only. Do a pre-commit check that no secret patterns (key-like strings) appear in client-side bundles.
- **Security headers:** Set the following headers on all responses via Next.js middleware:
  - `Content-Security-Policy` (restrictive — allow only known trusted origins)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(), geolocation=()`
- **HTTPS:** Enforced by Vercel. Ensure no HTTP endpoints exist and all redirects are to HTTPS.
- **Input validation:** Validate and sanitise all inputs at the API boundary using a schema validation library (Zod recommended). Do not trust client-side validation alone.
- **Dependency security:** Run `npm audit` as part of the CI pipeline. Block deployment if High severity vulnerabilities are present.

### 4.3 Reliability and Resilience

- Every network-dependent feature must have a defined offline or degraded fallback. There is no acceptable "feature unavailable" response — always provide the best available answer with an appropriate confidence label.
- No single point of failure for the core screening function. The full screening flow must work with zero network connectivity.
- Retries with exponential backoff and jitter on all external API calls (AI providers, Mailgun, sync). See 4.1 for parameters.
- Sync failures must be queued in IndexedDB and retried automatically on next connectivity. The sync queue must survive app restarts.
- Thundering herd prevention: when a device comes back online, sync is not immediate but staggered with a random delay (0–30 seconds) to prevent all devices in a facility syncing simultaneously. This is especially important for large-scale deployments.
- Database backup: automated daily backups configured at the infrastructure level (Supabase handles this; for DigitalOcean, configure managed backups). Backup restoration procedure must be documented in SETUP.md and tested at least once before production launch.
- If the database becomes unavailable, the app must continue to function in read-from-cache / write-to-IndexedDB mode. The user must be informed of the degraded state ("Data sync paused — your screenings are saved locally and will sync when the connection is restored").

### 4.4 Data Integrity

- Use Decimal.js for all numerical calculations involving token counts, costs, and any financial-adjacent figures. Do not use native JavaScript floating-point arithmetic for these.
- All sync operations are idempotent. Duplicate submissions are safe and produce no side effects.
- Multi-step database writes (e.g. writing an encounter and updating a facility aggregate) must be wrapped in a database transaction. Partial writes must never leave the database in an inconsistent state.
- Race conditions on concurrent case log writes: use database-level locking or optimistic concurrency control (version column + conditional update) for any record that can be written by multiple clients simultaneously.
- No PII must appear in application logs, error messages, stack traces, Sentry reports, or any external monitoring service. Audit all logging statements before production release. Facility IDs and encounter UUIDs in logs are acceptable; age bands in logs are acceptable; anything more specific than this requires review.
- Data leakage between facilities: RLS policies must be tested as part of the test suite. Write tests that attempt to read another facility's data using a valid CHW token from a different facility — these tests must fail at the API level.

### 4.5 Accessibility

- WCAG 2.1 AA compliance
- All interactive elements have accessible labels (aria-label or visible text)
- High contrast mode is the default — do not require users to opt into it
- Minimum touch target: 44x44px for all interactive elements
- Minimum font size: 16px for body text, 20px for result screen critical text
- No colour-only information conveyance — every colour-coded state (POSITIVE/NEGATIVE/REFER, confidence bands) must also be communicated by text, icon, or pattern
- Screen reader compatible — test with TalkBack (Android) before release
- Focus management: after a modal closes or a screen transition completes, focus must be set to a logical next element, not left floating

### 4.6 Privacy

- No patient names, national IDs, phone numbers, or any personally identifiable information is collected, stored, or transmitted at any point in the application
- Images are processed on-device (in-memory) only. Images are never stored on-device after the screening session ends. Images are never transmitted to any server unless admin has explicitly enabled image upload AND per-patient consent has been collected.
- All consent screens are displayed in the user's selected language. Consent must be a positive action (a tap of "I agree") — pre-ticked or implicit consent is not acceptable.
- NDPR (Nigeria Data Protection Regulation) compliant: no personal data processed, so formal NDPR registration is not required at launch, but the app's data handling must be consistent with NDPR principles in anticipation of future features.
- GDPR-aligned for international deployments
- Anonymised aggregate data (screening volumes, result distributions by facility) may be used for platform improvement and reporting to CHAI. This must be documented in the app's privacy notice.
- The privacy notice must be accessible from the settings screen at all times, in the user's selected language.

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js (latest stable) + TypeScript | App Router preferred |
| Styling | Tailwind CSS | No gradients; no purple hues |
| Database | Supabase (default) or DigitalOcean Managed PostgreSQL | Toggled via env var — see Section 5.3 |
| Auth | Supabase Auth | Google OAuth + Telegram Login Widget |
| On-device AI | TensorFlow.js TFJS-tflite, WASM backend | Runs in browser, offline. NOT tflite-node. |
| Online AI — Vision | Gemini Flash (primary) → GPT-4o (fallback) | DeepSeek must NOT handle vision tasks |
| Online AI — Text | DeepSeek (primary) → Gemini Flash (fallback) | |
| Offline storage | IndexedDB via Dexie.js | |
| PWA / Cache | Service Workers + Cache API | |
| Sessions | JWT + Redis (ioredis or Upstash) | Toggled via `REDIS_PROVIDER` env var |
| Email | Mailgun | |
| Captcha | Cloudflare Turnstile (default) or Google reCAPTCHA | Admin toggle, one active at a time |
| Payments | Paystack (Nigeria) + Dodopayments (global) | Not active in v1.0 — scaffold only |
| Deployment | Vercel Hobby plan (MVP) | Auto-deploy via GitHub Actions on push to main |
| Cron | Vercel Cron (once daily, Hobby plan limit) + cron-jobs.org | See Section 5.9 |

### 5.2 Full AI Provider Architecture

#### 5.2.1 Provider Roles

| Task Type | Primary | Fallback | Hard Constraint |
|---|---|---|---|
| Vision inference (image analysis) | Gemini Flash | GPT-4o | DeepSeek must NEVER be used for vision tasks |
| Text tasks (reports, clinical guidance, admin) | DeepSeek | Gemini Flash | |
| On-device inference (offline, always first) | TFLite via TFJS-tflite WASM | Rule-based JSON fallback | Always attempted before any cloud provider |

#### 5.2.2 Full Inference Fallback Chain

**Vision tasks (image analysis):**
```
1. On-device TFLite (always first — offline, zero cost)
   CONFIDENCE: HIGH — validated model, purpose-built for task

2. Gemini Flash (if: online AND provider enabled by admin AND key available)
   CONFIDENCE: HIGH — live vision model, full image context
   UI NOTE: "Online AI used. API costs apply."

3. GPT-4o (if: Gemini fails AND provider enabled by admin AND key available)
   CONFIDENCE: HIGH — live vision model, full image context
   UI NOTE: "Fallback AI used. API costs apply."

4. Rule-based offline fallback (if all cloud AI unavailable)
   CONFIDENCE: MODERATE
   UI NOTE: "Offline decision support only. No image analysis performed.
   Result based on your visual observations. Verify with supervisor."

5. Cached clinical reference text (last resort — should almost never be reached)
   CONFIDENCE: REFERENCE ONLY
   UI NOTE: "No analysis available. Clinical reference shown.
   Escalate to your supervisor immediately."
```

**Text tasks (report generation, clinical guidance, admin functions):**
```
1. DeepSeek (if: online AND enabled AND key available)
   CONFIDENCE: HIGH

2. Gemini Flash (if DeepSeek fails AND enabled AND key available)
   CONFIDENCE: HIGH

3. Cached AI response matching similar context (from Redis or IndexedDB)
   CONFIDENCE: MODERATE
   UI NOTE: "Saved response shown — may not reflect your exact case. Review carefully."

4. Offline decision tree (pre-built logic, JSON cached by service worker)
   CONFIDENCE: MODERATE-LOW
   UI NOTE: "Offline guidance only. Pre-built logic — not tailored to this case.
   Confirm with supervisor before acting."

5. Cached clinical reference text
   CONFIDENCE: REFERENCE ONLY
   UI NOTE: "Reference material only. No personalised guidance available.
   Escalate to your supervisor."
```

**Critical rule:** The system must ALWAYS produce a result at some step in the chain. A blank screen, an unhandled error, or a generic "something went wrong" message in place of a clinical result is a critical bug. Every step must have explicit error handling. Step 5 (cached reference text) must always be available — it must be bundled with the app and cached by the service worker at install time.

**Critical rule:** A LOW CONFIDENCE result or a REFERENCE ONLY result must always set the output classification to REFER. It is clinically unsafe to show POSITIVE or NEGATIVE alongside a low-confidence label. Override the classification at the result rendering layer if confidence is LOW or REFERENCE ONLY.

#### 5.2.3 Confidence Label System

Every result screen — regardless of inference method — displays a confidence band. The confidence band is:
- Always visible without any tap or scroll
- Colour-coded AND text-labelled (never colour alone — accessibility requirement)
- Accompanied by exactly one plain-language sentence explaining why that confidence level applies

| Label | Colour | Background | Inference Method | Guidance Sentence Example |
|---|---|---|---|---|
| HIGH CONFIDENCE | Green | Green band | TFLite or live cloud AI | "Result from on-device AI model trained on cervical screening images." |
| MODERATE CONFIDENCE | Amber | Amber band | Rule-based / cached AI | "Result based on clinical guidelines, not image analysis." |
| LOW CONFIDENCE | Orange | Orange band | Offline decision tree | "Estimated result — pre-built logic only. Confirm with supervisor." |
| REFERENCE ONLY | Red | Red band | Cached reference text | "No analysis available. Reference material only. Escalate now." |

The guidance sentence must be localised into the user's selected language.

#### 5.2.4 Admin Provider Toggle System

Each provider has an independent toggle with three states. Implement these as a database-backed config (`admin_config` table), not hardcoded or env-var-only, so admin can change them at runtime without redeployment.

**State A — Provider OFF:**
- Provider completely unavailable platform-wide
- No key entry field shown anywhere in UI
- No BYOK option shown for this provider
- Provider is skipped in the fallback chain as if it does not exist

**State B — Provider ON, central key configured:**
- All eligible users use NG44's central API key
- Central key is stored as an env var (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`) — NOT in the database
- Cost tracked against the central account and shown in admin dashboard
- No BYOK prompt shown — central key takes precedence over any BYOK key

**State C — Provider ON, no central key configured:**
- BYOK offered to Supervisors and above only
- CHWs: this provider is skipped; next fallback in chain is attempted; CHW sees "Enhanced AI unavailable — using offline mode" with no option to add a key
- Each supervisor's BYOK key is tracked and costs attributed separately

Admin panel UI per provider:
```
[ Gemini Flash ]  [ON ●] / [OFF ○]
  Central key:  [●●●●●●●●●●●●] [Edit] [Clear]
  Usage today:  12,450 tokens in / 3,210 tokens out (~$0.04 estimated)

[ GPT-4o ]  [ON ●] / [OFF ○]
  Central key:  — not set — [Add key]
  Status: BYOK offered to supervisors (0 active BYOK users)

[ DeepSeek ]  [ON ●] / [OFF ○]
  Central key:  [●●●●●●●●●●●●] [Edit] [Clear]
  Usage today:  8,100 tokens in / 2,050 tokens out (~$0.002 estimated)
  Note: Text tasks only — not used for image analysis
```

#### 5.2.5 BYOK System (Supervisor and Above Only)

When a provider is in State C (ON, no central key):

1. Supervisor opens Settings → AI Providers
2. Provider shown as: "Available — add your API key to enable"
3. Supervisor enters their API key in a password-type input field (masked, not shown in plaintext)
4. On submit, the plaintext key is sent over HTTPS to a server-side API route immediately
5. Server performs a lightweight validation call to the provider API (e.g. a minimal token completion) to confirm the key works
6. If validation succeeds: the key is encrypted server-side using AES-256-GCM with `BYOK_ENCRYPTION_KEY` (env var, never in DB) and stored in the `user_api_keys` table associated with the user's ID. The plaintext key is explicitly cleared from all server-side variables after encryption. It is not cached in Redis. It does not appear in logs.
7. If validation fails: the user sees a specific error ("Key validation failed — please check the key is correct and has the required permissions") and the key is not stored
8. After saving, the UI shows the key as masked (●●●●●●●●●●) with a "Remove key" button. There is no "View key" button — the plaintext key is never retrievable after saving. This is by design.
9. Cost messaging shown persistently after BYOK activation: "You are using your own API key for [Provider]. Costs are charged directly to your [Provider] account. Daghe tracks estimated usage below."
10. CHWs never see any BYOK UI element. This is enforced at the API level (role check) and at the UI level (conditional rendering based on role from server-side session).

#### 5.2.6 Cost Messaging

- Result screen: when cloud AI (step 2 or 3) was used, show below the confidence band: "Online AI used: [Provider] — estimated cost $[X.XXX]". Use Decimal.js for cost calculation.
- Settings → AI Providers (supervisor+): running totals for current session, today, this month, broken down by provider. Refresh on page load; do not poll.
- Admin dashboard: platform-wide cost dashboard. See Section 8.

#### 5.2.7 Token and Cost Tracker

Every cloud AI API call must log the following to the `ai_usage_log` table:

- `id` (UUID)
- `user_id` (or null for facility-linked mode)
- `facility_id`
- `provider` (gemini / gpt4o / deepseek)
- `task_type` (vision / text)
- `key_type` (central / byok)
- `input_tokens` (integer)
- `output_tokens` (integer)
- `estimated_cost_usd` (Decimal, 8 decimal places)
- `encounter_id` (UUID, if associated with a screening encounter)
- `created_at` (timestamp with timezone)

Cost per token is read from admin config (stored in `admin_config` table, not hardcoded), so it can be updated when providers change their pricing without a code deployment. Default values are seeded from env vars on first run.

Supervisor view: aggregate of their own usage. Cannot see other users' usage.
Programme Manager view: aggregate per facility in their managed set.
Admin view: full platform aggregate + per-facility + per-user breakdown. Export CSV.

Cost estimates carry a label: "Estimated based on provider rates set in admin config. Actual billing may vary."

#### 5.2.8 Device-Level AI and Feature Toggles (All Roles)

Users can adjust their device preferences in Settings → Device Preferences. Settings are stored in IndexedDB and persist across app restarts.

Device settings override global admin settings only in the direction of more restriction — a user can turn OFF a feature the admin has ON, but cannot turn ON a feature the admin has OFF.

Toggle UI:
```
Online AI — Image Analysis    [ON/OFF]   Uses API — costs apply to account
Online AI — Text Assistance   [ON/OFF]   Uses API — costs apply to account
Data Sync                     [ON/OFF]   Pause syncing case log to server
Case Log Upload               [ON/OFF]   Stop uploading new cases to server
Model Updates                 [ON/OFF]   Pause downloading AI model updates
```

Each toggle has a one-line explanation of what disabling it does. Disabling all online AI inference does not disable sync, case log upload, or model updates. These are independent features with independent toggles.

When online AI inference is disabled, the app proceeds directly to step 4 (rule-based fallback) for all inference requests, skipping steps 2 and 3 entirely.

#### 5.2.9 Central AI Configuration (env vars and constants)

All model version identifiers and provider configuration are defined in a single central constants file (`/lib/ai/constants.ts`) and in env vars. Changing a deprecated model version requires editing one location only — not searching across the codebase.

```bash
# AI provider toggles — these set the initial default; admin can override at runtime
GEMINI_ENABLED=true
GEMINI_API_KEY=                          # blank = BYOK only
GEMINI_MODEL=gemini-2.0-flash            # update here when version changes

OPENAI_ENABLED=true
OPENAI_API_KEY=                          # blank = BYOK only
OPENAI_MODEL=gpt-4o                      # update here when version changes

DEEPSEEK_ENABLED=true
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat             # update here when version changes

# TFLite model filenames — update here when new models are deployed
TFLITE_CERVICAL_DETECTION_MODEL=efficientdet-lite3-cervical-v1.2.tflite
TFLITE_CERVICAL_CLASSIFICATION_MODEL=mobilenetv2-cervical-via-v1.2.tflite

# Cost rates — update here when providers change pricing, no code change needed
GEMINI_FLASH_COST_PER_1K_INPUT_TOKENS=0.000075
GEMINI_FLASH_COST_PER_1K_OUTPUT_TOKENS=0.0003
OPENAI_GPT4O_COST_PER_1K_INPUT_TOKENS=0.005
OPENAI_GPT4O_COST_PER_1K_OUTPUT_TOKENS=0.015
DEEPSEEK_COST_PER_1K_INPUT_TOKENS=0.00014
DEEPSEEK_COST_PER_1K_OUTPUT_TOKENS=0.00028

# BYOK encryption — never store this in the database
BYOK_ENCRYPTION_KEY=                     # 32-byte hex string, generated at setup

# Redis provider
REDIS_PROVIDER=upstash                   # or: ioredis
```

### 5.3 Database Backend Toggle

```bash
DB_PROVIDER=supabase     # or: digitalocean

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=       # safe for client-side — used for RLS-enforced queries only
SUPABASE_SERVICE_ROLE_KEY=   # server-side ONLY — bypasses RLS — never expose to client

# DigitalOcean Managed PostgreSQL
DO_DATABASE_URL=
DO_DATABASE_SSL=true
DO_DATABASE_POOL_MAX=10  # max connections per function instance
```

Implement a thin database adapter layer at `/lib/db/index.ts` that exports a single `db` object. Application code imports from this adapter and is never directly coupled to Supabase or pg client libraries. Switching DB_PROVIDER requires only an env var change and redeployment — no application code changes.

The Supabase anon key is safe to use in client-side code for RLS-enforced queries. The service role key bypasses RLS and must only ever be used in server-side API routes (`/app/api/` or `/pages/api/`). If a code review finds the service role key referenced in any client-side file, that is a critical security bug.

### 5.4 Three-Layer Storage Architecture

```
Layer 1: Service Worker Cache (browser cache)
  Purpose: Offline-first app shell and static assets
  Contents:
    - App shell (HTML, CSS, JS bundles)
    - TFLite model files (downloaded after first launch, cached permanently until updated)
    - Offline fallback logic JSON files for all enabled modules
    - Cached clinical reference text for all enabled modules
    - Demo images (3 images for demo mode, bundled at build time)
    - i18n string files for all enabled languages
  Strategy: Cache-first for app shell and models; stale-while-revalidate for clinical content
  Update: Service worker update check on every app launch (when online)

Layer 2: IndexedDB via Dexie.js (client-side structured storage)
  Purpose: Local data that persists between sessions
  Contents:
    - Case log (pending sync queue + local history)
    - User preferences (language, theme, device toggle states)
    - Facility code (for facility-linked mode)
    - AI response cache (for text tasks — used in fallback step 3)
    - Sync metadata (last sync timestamp, pending queue depth)
  Durability: Survives app reload, browser restart, device restart
  Clearing: Never automatically cleared; user can manually clear via Settings → Clear local data (with confirmation warning)

Layer 3: Supabase / DigitalOcean PostgreSQL (server-side persistent storage)
  Purpose: Authoritative master record; shared data; cross-device sync
  Contents:
    - All synced encounters (case log)
    - User accounts, roles, facility assignments
    - Facility records
    - Module registry and configuration
    - Model version records
    - Admin configuration
    - AI usage log
    - Audit log
  Access: Always via server-side API routes (never direct from client except via Supabase anon key with RLS)
```

### 5.5 Full Inference Pipeline (Vision Tasks)

```
Image Capture (camera via MediaDevices API, or gallery upload)
  ↓
Image Quality Check (runs on-device, synchronous, before any inference)
  - Blur detection (Laplacian variance)
  - Exposure check (mean pixel brightness)
  - ROI pre-check (lightweight EfficientDet pass)
  → FAIL: specific feedback + recapture prompt (max 3 attempts, then override option)
  → PASS: proceed
  ↓
STEP 1: TFLite inference (TFJS-tflite, WASM, always attempted first)
  EfficientDet-Lite3 → ROI crop → MobileNetV2 → classification + confidence score
  → SUCCESS: Result screen (CONFIDENCE: HIGH) → Case log entry → Done
  → FAIL (model not loaded / WASM unavailable): proceed to STEP 2
  ↓
STEP 2: Gemini Flash vision API (server-side proxy — image sent to server, then to Gemini)
  Conditions: online AND Gemini enabled by admin AND key available (central or BYOK)
  Image is base64-encoded and sent to /api/ai/vision endpoint (server-side only)
  Server calls Gemini API, returns classification + reasoning
  → SUCCESS: Result screen (CONFIDENCE: HIGH) + cost note → Case log entry → Done
  → FAIL (API error / timeout / no key): proceed to STEP 3
  ↓
STEP 3: GPT-4o vision API (server-side proxy)
  Conditions: online AND GPT-4o enabled by admin AND key available (central or BYOK)
  Same proxy pattern as Gemini
  → SUCCESS: Result screen (CONFIDENCE: HIGH) + cost note → Case log entry → Done
  → FAIL: proceed to STEP 4
  ↓
STEP 4: Rule-based offline fallback
  Structured observation question flow → WHO VIA decision tree (from cached JSON)
  → Result screen (CONFIDENCE: MODERATE) + offline note → Case log entry → Done
  ↓
STEP 5: Cached clinical reference text (absolute last resort)
  Static text from service worker cache — always available
  → Result screen (CONFIDENCE: REFERENCE ONLY) + escalation prompt → Done
```

**Important implementation note on cloud AI image handling:** Images sent to cloud providers (steps 2 and 3) must go through a server-side proxy (`/api/ai/vision`). The client sends the image to Daghe's own server, and the server makes the API call to the provider. This means: (a) the provider API key is never exposed to the client, (b) the image transmission can be audited server-side, and (c) rate limiting and cost controls can be enforced server-side. The client must never call provider APIs directly.

### 5.6 OTA Model Update System

- TFLite model files are hosted on a CDN (Supabase Storage or DigitalOcean Spaces, matching the DB provider)
- On every app launch (when online), the app checks the `model_versions` table for newer model versions for each enabled module
- If a newer version exists: download begins in the background. The user is not interrupted. A subtle progress indicator is shown in the Settings screen.
- Download integrity: each model file has a SHA-256 hash stored in `model_versions`. After download, the file hash is verified client-side before the model is staged for use. If the hash does not match, the download is discarded and retried.
- Staging: the new model is written to a "pending" slot in the service worker cache. It is not activated immediately.
- Activation: on the next app launch after a successful download and hash verification, the pending model is promoted to active. The previous model is kept in a "rollback" slot for 30 days.
- Rollback: if a newly activated model produces a significantly different result distribution (detected by the performance monitoring system), admin can trigger a rollback to the previous model version from the admin panel. Rollback activates the model in the rollback slot immediately and clears the failed model.
- Admin panel shows: current active model version per module, last update check time, pending download status, rollback slot version.

### 5.7 Module Registry

Each condition module is a self-contained directory:

```
/modules/
  cervical-via/
    manifest.json              — module ID, name, version, TFLite model filenames,
                                 fallback-logic version, required languages,
                                 quality check thresholds (blur, exposure, framing)
    fallback-logic.json        — WHO VIA decision tree for rule-based fallback
    strings/
      en.json                  — English UI strings
      ha.json                  — Hausa
      yo.json                  — Yoruba
      ig.json                  — Igbo
      fr.json                  — French
    demo/
      positive.jpg             — demo image (positive case)
      negative.jpg             — demo image (negative case)
      indeterminate.jpg        — demo image (indeterminate case)
      annotations.json         — expected results and explanatory text for demo images
    clinical-guide/
      en.md                    — clinical reference text (English)
      ha.md                    — clinical reference text (Hausa)
      [etc.]
```

The module registry in the database (`modules` table) lists enabled modules and their current versions. The app loads only enabled modules. Adding a new module requires: (1) adding the module directory to the codebase, (2) adding a row to the `modules` table, (3) deploying. No application logic changes are required.

Module-specific quality check thresholds (blur variance threshold, exposure bounds, framing confidence threshold) are stored in `manifest.json`, not hardcoded. Different modules may need different thresholds — a skin lesion module has different image requirements than a VIA module.

### 5.8 Security Implementation Notes (Expanded)

These notes expand on Section 4.2 with specific implementation guidance:

- **BYOK key storage:** BYOK keys are stored in a dedicated `user_api_keys` table, one row per user per provider. Columns: `user_id`, `provider`, `encrypted_key` (bytea), `iv` (bytea), `created_at`, `last_used_at`. The encryption key (`BYOK_ENCRYPTION_KEY`) is an env var. Encryption uses AES-256-GCM. The IV is randomly generated per encryption operation and stored alongside the ciphertext. Key rotation procedure (changing `BYOK_ENCRYPTION_KEY`) must be documented in SETUP.md and involves re-encrypting all stored keys — provide a migration script for this.

- **Admin footer scripts:** Scripts entered by admin in the footer script field are stored in `admin_config`. When rendered on the client, they are processed through DOMPurify with a strict config that strips `<script>` tags before rendering. Legitimate analytics and tracker scripts that require `<script>` tags must be entered as raw script tag HTML — DOMPurify must be configured to allow `<script>` tags but strip event handlers and `javascript:` URLs. Document this behaviour clearly in HOW-IT-WORKS.md so admin understands what is and is not allowed.

- **PIN storage:** The 4-digit PIN is hashed with bcrypt (cost factor 10) and stored in `users.pin_hash`. PIN verification is a server-side API call that compares the submitted PIN against the stored hash. The plaintext PIN must never appear in server logs or API responses.

- **Facility code validation:** Facility codes are validated server-side before a device is registered in facility-linked mode. A facility code is a 8-character alphanumeric string generated by admin and stored in `facilities.facility_code`. Rate-limit facility code validation attempts to 5 per IP per hour to prevent enumeration attacks.

- **Image transmission security:** When images are sent to the server for cloud AI inference (steps 2 and 3), they are transmitted as multipart form data over HTTPS. Server-side, they are held in memory only for the duration of the API call to the provider. They are not written to disk, not stored in Redis, and not logged. After the provider call returns, the image data is explicitly cleared. Implement this as a streaming proxy where possible to avoid holding the full image in server memory.

### 5.9 Cron Jobs

```javascript
/* IMPORTANT — Vercel Hobby plan supports once-daily cron maximum.
   For all cron jobs that need to run more frequently than once daily:
   1. Configure the job at cron-jobs.org pointing to the same Next.js API route
   2. The API route must validate a shared secret header (CRON_SECRET env var) to
      reject unauthorised external calls
   3. See SETUP.md for step-by-step cron-jobs.org configuration instructions
   Vercel's once-daily cron is used as a fallback only. */
```

| Job | Frequency | Route | Notes |
|---|---|---|---|
| Sync health check | Every 6 hours | `/api/cron/sync-health` | Check for facilities with stale sync (>24h); alert admin |
| Performance metrics aggregation | Daily | `/api/cron/aggregate-metrics` | Aggregate screening stats for dashboard |
| Model update check | Every 6 hours | `/api/cron/model-check` | Check CDN for new model versions; update `model_versions` table |
| AI cost aggregation | Hourly | `/api/cron/cost-aggregate` | Roll up `ai_usage_log` into daily summaries |
| Facility screening summary emails | Weekly (Monday 08:00) | `/api/cron/weekly-summary` | Sends summary emails to supervisors (if enabled) |
| Data retention cleanup | Daily | `/api/cron/retention-cleanup` | Soft-delete records past retention threshold |
| Hard-delete sweep | Daily | `/api/cron/hard-delete` | Hard-delete records soft-deleted >30 days ago |

All cron routes must: (1) verify `Authorization: Bearer ${CRON_SECRET}` header, (2) return 401 if header is missing or incorrect, (3) be idempotent (safe to run multiple times without side effects), (4) log start time, end time, and result to the `cron_log` table.

---

## 6. UI / UX Requirements

### 6.1 General

- Mobile-first. The primary design target is a 390px wide phone screen (iPhone 14 / Pixel 7 width). Desktop layout must not break but is secondary.
- Fixed bottom navigation toolbar on mobile: 4 items with icon + label. Suggested items: Home / Scan / Case Log / Settings. Admin sees an additional Admin item or the Settings item expands to include admin functions.
- No gradients anywhere in the UI colour system
- No purple hues anywhere in the UI colour system
- Light mode and dark mode. User selects on first launch. Selection persists in IndexedDB. Admin can restrict deployments to light-only or dark-only if needed for specific clinical environments.
- Admin-configurable custom themes: admin can define additional colour palettes in the admin panel (stored in `admin_config`). Custom themes can be toggled on/off. Custom themes must not override the high-contrast requirement for result screens.
- Default to high contrast. High contrast is not an accessibility mode — it is the default appearance, optimised for sunlight readability.
- Minimum touch target: 44x44px on all interactive elements. Use padding to increase tap area where the visible element is smaller.
- Minimum font size: 16px body text, 20px result text, 24px critical result classification (POSITIVE / NEGATIVE / REFER).
- Use CSS logical properties throughout (`margin-inline-start`, `padding-block`, etc.) to enable future RTL language support without layout rewrites.
- Use JSDoc comments on all exported functions and components.
- Generous but not verbose inline code comments — explain why, not what.

### 6.2 Result Screens

Result screens are the most clinically critical screens in the app. They must be instantly readable at arm's length in bright sunlight.

- **NEGATIVE:** Full-screen solid green background (#16A34A or equivalent), white text. Large checkmark icon (minimum 80px). Classification text "NEGATIVE" in 28px bold. Recommended action in 18px. Confidence band below recommended action.
- **POSITIVE:** Full-screen solid red background (#DC2626 or equivalent), white text. Large warning icon. Classification text "POSITIVE" in 28px bold. Recommended action in 18px. Confidence band below.
- **REFER:** Full-screen solid amber background (#D97706 or equivalent), dark text (#1C1917). Large escalation icon. Classification text "REFER — SEE SUPERVISOR" in 28px bold. Recommended action in 18px. Confidence band below.

All result screens include below the confidence band:
- Which inference method was used (plain language: "On-device AI" / "Online AI (Gemini)" / "Online AI (GPT-4o)" / "Offline guidelines" / "Reference only")
- If cloud AI was used: estimated cost
- Two action buttons: "Save to case log" (primary, large) and "Start new screening" (secondary)
- For POSITIVE and REFER: a third button "View clinical guidance" that opens the cached clinical reference for this module in a full-screen modal

The result screen must display fully before the "Save to case log" button becomes active. Do not auto-save without user confirmation — the CHW records the action taken (treated / referred / monitored / declined) before saving.

### 6.3 Demo Mode UI

- A persistent yellow banner at the top of every screen in demo mode: "DEMO MODE — Results are not saved". This banner is not dismissible. It does not disappear on scroll. This is a clinical safety requirement.
- Demo case selector: cards for 3 pre-loaded cases labelled "Positive example", "Negative example", "Uncertain example"
- The full inference pipeline runs on demo images exactly as it would in live mode, including quality check and TFLite inference. The user experiences the real pipeline.
- Result screen in demo mode is identical to live mode except: (a) "Save to case log" button is replaced with "Back to demo selector", and (b) an annotation box below the result explains what the model detected and why (stored in `demo/annotations.json`)
- Demo mode is accessible from the home screen without login — no account, no facility code required
- When demo mode is exited, no data is written to IndexedDB or the server

### 6.4 CHW Onboarding Flow

1. **Language selector** (full screen): flag icons + language name written in that language. No English label for non-English languages. Covers all enabled languages for the deployment.
2. **Facility code entry**: large input field, numeric keyboard. Instruction text in selected language. The facility code links the device to a facility. Validation is server-side (rate-limited). Error message if code is invalid or unrecognised.
3. **Role selection**: CHW / Nurse / Midwife / Other. Tap to select. Role is stored locally and associated with the facility-linked session.
4. **Walkthrough** (3 screens, swipeable): (a) What Daghe does and what it does not do (not a replacement for clinical judgment), (b) How to capture a good image (distance, lighting, positioning), (c) How to read a result and confidence label
5. **Demo prompt**: "Try a practice scan before your first real screening" with a large "Open demo mode" button and a smaller "Skip for now" link
6. **Optional account creation**: "Create a personal account for cross-device access" — Google / Telegram buttons. "Skip — continue without account" is equally prominent. Do not pressure users to create accounts. Facility-linked mode is a full first-class experience, not a degraded one.

---

## 7. Database Schema (Core Tables)

```sql
-- Facilities
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,        -- primary / secondary / tertiary
  state TEXT,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  facility_code VARCHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  auth_provider TEXT NOT NULL,  -- google / telegram / email
  email TEXT,
  role TEXT NOT NULL DEFAULT 'chw',  -- chw / supervisor / programme_manager / admin
  facility_id UUID REFERENCES facilities(id),
  language VARCHAR(10) DEFAULT 'en',
  pin_hash TEXT,               -- bcrypt hash of 4-digit PIN; NULL if not set
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

-- Screening Encounters (case log)
CREATE TABLE encounters (
  id UUID PRIMARY KEY,          -- generated client-side (UUID v4), NOT server-generated
  facility_id UUID NOT NULL REFERENCES facilities(id),
  user_id UUID REFERENCES users(id),  -- NULL for facility-linked mode
  module_id TEXT NOT NULL,      -- e.g. 'cervical-via'
  patient_age_band TEXT NOT NULL,
  screening_context TEXT NOT NULL,
  ai_result TEXT NOT NULL,      -- POSITIVE / NEGATIVE / REFER
  ai_confidence_band TEXT NOT NULL,  -- HIGH / MODERATE / LOW / REFERENCE_ONLY
  inference_method TEXT NOT NULL,    -- tflite / gemini / gpt4o / rule-based / reference
  quality_override BOOLEAN DEFAULT FALSE,
  action_taken TEXT,            -- treated / referred / monitored / declined
  notes_local_only BOOLEAN DEFAULT TRUE,  -- notes are local only, never synced
  image_hash TEXT,              -- SHA-256 of image bytes; NULL if no image
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT encounters_id_unique UNIQUE (id)  -- enforces idempotent sync
);

-- Module Registry
CREATE TABLE modules (
  id TEXT PRIMARY KEY,          -- e.g. 'cervical-via'
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  config_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model Versions
CREATE TABLE model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id TEXT NOT NULL REFERENCES modules(id),
  model_type TEXT NOT NULL,     -- detection / classification
  version TEXT NOT NULL,
  file_hash TEXT NOT NULL,      -- SHA-256 for download integrity check
  cdn_url TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  rollback_slot BOOLEAN DEFAULT FALSE,
  deployed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Configuration
CREATE TABLE admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage Log
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  facility_id UUID REFERENCES facilities(id),
  provider TEXT NOT NULL,       -- gemini / gpt4o / deepseek
  task_type TEXT NOT NULL,      -- vision / text
  key_type TEXT NOT NULL,       -- central / byok
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost_usd NUMERIC(12, 8) NOT NULL,  -- Decimal precision
  encounter_id UUID REFERENCES encounters(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BYOK API Keys (encrypted)
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  encrypted_key BYTEA NOT NULL,
  iv BYTEA NOT NULL,            -- AES-GCM initialisation vector
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  UNIQUE (user_id, provider)
);

-- Audit Log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron Job Log
CREATE TABLE cron_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT,                  -- running / success / failed
  result_summary JSONB
);
```

**RLS policies must be created for every table.** The service role key (which bypasses RLS) is used only in server-side API routes. The anon key always operates under RLS. Write explicit tests that verify RLS is enforced — see Section 9.2.

---

## 8. Performance Monitoring Dashboard

The admin panel includes a monitoring dashboard with the following panels:

- **Screening volume:** Total screenings by facility, date range, module. Trend chart (daily/weekly/monthly).
- **Result distribution:** % POSITIVE / % NEGATIVE / % REFER over time, broken down by facility and inference method. Statistical process control chart — flag if result distribution deviates >2 standard deviations from the baseline (potential model drift indicator).
- **Confidence band distribution:** % HIGH / % MODERATE / % LOW / % REFERENCE ONLY — broken down by inference method. A rising proportion of MODERATE or LOW results may indicate TFLite model degradation or network issues.
- **Inference method breakdown:** How often each inference method (TFLite / Gemini / GPT-4o / rule-based / reference) is used. Useful for diagnosing connectivity issues across facilities.
- **Quality override rate:** % of screenings where quality check was overridden. A high rate may indicate poor image capture training or equipment issues.
- **Flagged cases:** Cases where a CHW recorded a different action than the AI recommended. Useful for identifying systematic disagreements.
- **Model versions:** Current TFLite model version in use across active devices. Useful for confirming OTA updates have propagated.
- **Sync health:** Last sync timestamp per facility. Facilities with sync age >24 hours are flagged.
- **AI cost dashboard:** Daily / monthly spend by provider (central key and BYOK separately). Per-facility and per-user breakdown. Configurable alert threshold.
- **Export:** All dashboard data exportable as CSV and JSON.

---

## 9. Testing Requirements

### 9.1 Priority Order

1. E2E tests (Playwright) — full user flows
2. Security tests — RLS, role enforcement, BYOK key handling
3. Load tests (k6) — concurrent users
4. Unit tests — inference pipeline, cost calculations, sync idempotency
5. Payment integrity tests — when payment features are activated

### 9.2 Key E2E and Security Test Scenarios

**Core screening flow:**
- Full cervical VIA screening flow — online (TFLite succeeds)
- Full cervical VIA screening flow — offline (TFLite from cache)
- Image quality failure → recapture → override → result with quality_override flag
- Cloud AI fallback: TFLite fails → Gemini succeeds (mock Gemini response)
- Cloud AI fallback: TFLite fails → Gemini fails → GPT-4o succeeds
- Full fallback to rule-based (all AI unavailable)
- Full fallback to reference text (rule-based also disabled — simulate module fault)
- Confidence label is correct for each inference method
- LOW CONFIDENCE result always produces REFER output, never POSITIVE or NEGATIVE
- REFERENCE ONLY result always produces REFER output
- Demo mode: results not written to case log
- Demo DEMO banner present on all demo screens and non-dismissible

**Auth and roles:**
- CHW cannot access supervisor API endpoints (expect 403)
- Supervisor cannot access admin API endpoints (expect 403)
- Role from session token is verified against database on each request
- Facility-linked mode: no personal account required, screenings attributed to facility
- BYOK screen not accessible to CHW role (expect 403 on API + not rendered in UI)

**RLS and data isolation:**
- CHW from Facility A cannot read encounters from Facility B (expect empty result, not 403)
- Supervisor from Facility A cannot read encounters from Facility B
- Service role key is not present in any client-side bundle (grep check)

**BYOK key security:**
- Submitted BYOK key is not stored in plaintext anywhere (database, Redis, logs)
- BYOK key is not returned in any API response after saving (masked only)
- BYOK key validation failure: invalid key is not stored, user shown specific error
- BYOK key encryption: verify encrypted_key column contains ciphertext, not plaintext

**Sync and data integrity:**
- Duplicate encounter UUID submitted twice: only one record created in database
- Sync queue survives app restart and retries automatically on reconnection
- Image is not stored in IndexedDB after session ends (verify via Dexie query)
- Image reference is explicitly null after session ends (verify via memory inspection)

**Cost tracking:**
- Cost calculation uses Decimal.js, not native float (verify with known token counts)
- Cost rates are read from admin_config table, not hardcoded
- Supervisor can see their own AI usage, not other users' usage

**Cron jobs:**
- All cron endpoints return 401 without CRON_SECRET header
- All cron endpoints are idempotent (run twice, verify no duplicate side effects)

---

## 10. Documentation Requirements

All documentation lives in `/docs`:

**`SETUP.md`** — Written for a developer new to the project. Assumes no prior context. Includes:
- Prerequisites (Node version, accounts required, env vars needed)
- Step-by-step environment setup (no CLI shortcuts — every step spelled out)
- Where to put env vars and how to protect them
- How to run locally
- How to deploy to Vercel (GitHub Actions setup)
- Database setup (Supabase or DigitalOcean)
- Redis setup (Upstash or ioredis)
- Mailgun setup
- Cloudflare Turnstile setup
- cron-jobs.org setup for high-frequency cron jobs (step-by-step with screenshots if possible)
- Database provider switching instructions (Supabase ↔ DigitalOcean): what to change, what to migrate, how to test
- Secret rotation runbook: how to rotate each secret (Supabase keys, AI provider keys, BYOK_ENCRYPTION_KEY, CRON_SECRET) with step-by-step instructions including re-encryption of BYOK keys when BYOK_ENCRYPTION_KEY is rotated
- Backup and restore runbook: how to trigger a manual backup, how to restore from backup, how to verify backup integrity
- Deployment and update runbook: how to deploy a new version, how to roll back a deployment, how to check deployment health after deploy
- How to seed demo data
- How to add a new language
- How to add a new condition module

**`HOW-IT-WORKS.md`** — Comprehensive feature and architecture documentation. Includes:
- All user-facing features by role (CHW, Supervisor, Programme Manager, Admin)
- All admin panel features
- The full AI inference fallback chain with explanation of each step
- The confidence label system and what each level means clinically
- BYOK system: how it works, security model, what happens to keys
- Cost tracking: how costs are calculated, why they are estimates, how to update rates
- OTA model update system
- Three-layer storage architecture
- Sync system: how it works, what happens offline, what happens on reconnect
- Module system: how to add a new module
- Security architecture: why each security decision was made
- Regulatory context: why certain design choices exist (e.g. no PII, confidence labels, demo mode banner) and their clinical/regulatory significance

---

## 11. MVP Build Sequence

### Phase 1 — Foundation (Weeks 1–2)

- Fork and adapt Asibi codebase
- Remove Asibi-specific illness triage flows; keep and extend: PWA shell, service worker, offline architecture, multilingual i18n framework, auth (Google + Telegram), admin scaffold, IndexedDB base
- Set up module registry (database schema + admin UI stub)
- Implement database adapter layer (`/lib/db/index.ts`) supporting both Supabase and DigitalOcean
- Implement all database tables and RLS policies per Section 7
- Add `cervical-via` module stub (manifest.json, empty strings files, placeholder demo images)
- Set up GitHub Actions CI with `npm audit` check and lint
- Deploy to Vercel Hobby plan
- Implement CRON_SECRET validation on all cron routes

**Deliverable:** Running app shell with offline capability, auth working, module registry scaffold, database adapter toggle verified, RLS tests passing

---

### Phase 2 — AI Pipeline + Provider System (Weeks 3–4)

- Integrate TFLite runtime: TensorFlow.js TFJS-tflite with WASM backend, dynamically imported
- Implement EfficientDet-Lite3 ROI detection
- Implement MobileNetV2 classification
- Implement image quality check (blur, exposure, framing)
- Wire full 5-step vision inference fallback chain
- Implement server-side AI proxy routes (`/api/ai/vision`, `/api/ai/text`) with provider switching logic
- Implement cloud AI provider adapter (Gemini Flash vision + text; GPT-4o vision; DeepSeek text)
- Implement admin provider toggle system (3-state per provider, database-backed)
- Implement BYOK key submission, validation, AES-256-GCM encryption, storage (server-side only)
- Implement device-level AI and feature toggles (IndexedDB persistence)
- Implement full confidence label system (5 levels, localised sentences)
- Implement cost tracking (ai_usage_log writes, Decimal.js calculations, rate config from admin_config)
- Implement rule-based offline fallback (WHO VIA decision tree from fallback-logic.json)
- OTA model update system (version check, background download, SHA-256 verify, staging, activation)
- Demo mode (preloaded images, full pipeline, persistent DEMO banner, no case log writes)
- Image memory management (explicit null + revokeObjectURL on session end)

**Deliverable:** Full end-to-end cervical screening flow on-device and via cloud fallback; BYOK working; cost tracking working; demo mode working; all security requirements for AI layer passing

---

### Phase 3 — Case Log, Sync, and UX (Week 5)

- Dexie.js IndexedDB case log with full schema
- Background sync engine (retry with backoff, idempotent upsert, thundering herd prevention)
- CHW onboarding flow (language → facility code → role → walkthrough → demo prompt → optional account)
- Result screens (full spec per Section 6.2 — colour, icons, confidence band, cost note, action buttons)
- Fixed bottom navigation toolbar (mobile)
- Light / dark mode (user-selectable, persists in IndexedDB)
- Multilingual string files: English, Hausa, Yoruba, Igbo, French for all UI elements including result screens, confidence labels, onboarding, and clinical guidance
- Language selector with language names in their own language
- Facility-linked mode (facility code → server validation → short-lived facility token → session without personal account)

**Deliverable:** Case log working; sync working and idempotent; onboarding complete; UI accessible and multilingual; facility-linked mode working

---

### Phase 4 — Admin Panel, Monitoring, and Security Hardening (Weeks 6–7)

- Admin panel: all features per Section 3.8
- Performance monitoring dashboard: all panels per Section 8
- Email notification system (Mailgun, admin-toggleable per Section 3.9)
- OWASP hardening: rate limiting, bot detection, CSP headers, XSS/CSRF/SSRF mitigations, input validation (Zod), DOMPurify for admin footer scripts
- AI prompt injection prevention on all AI-bound inputs
- Security headers via Next.js middleware (CSP, HSTS, X-Frame-Options, etc.)
- OWASP ZAP scan — resolve all High and Medium findings before Phase 5
- Captcha integration (Turnstile default, reCAPTCHA admin toggle)
- Footer script injection with DOMPurify
- All cron jobs (verify CRON_SECRET, idempotency, cron_log writes)
- Audit log writes for all sensitive operations (role changes, key storage, admin config changes, email setting changes)

**Deliverable:** Admin panel complete; monitoring live; security hardened; OWASP ZAP clean; audit log working

---

### Phase 5 — Testing, Documentation, and Regulatory Prep (Week 8)

- Playwright E2E tests: all scenarios in Section 9.2
- k6 load test: 1,000 concurrent users baseline; 10,000 target
- Security regression tests: RLS, role enforcement, BYOK key security (all scenarios in Section 9.2)
- Unit tests: cost calculation (Decimal.js), sync idempotency, inference fallback chain
- `SETUP.md` (complete, per Section 10)
- `HOW-IT-WORKS.md` (complete, per Section 10)
- Seed data script (demo facility, 3 demo users, 20 demo encounters, demo images)
- NAFDAC regulatory documentation starter pack: Intended Use Statement, software description, risk classification rationale, intended user profile
- Performance monitoring export for clinical validation baseline

**Deliverable:** Tested, documented, production-ready MVP. All E2E tests passing. Regulatory documentation pack ready.

---

## 12. Seed Content

- 1 demo facility: name "Daghe Demo Health Centre", facility_code "DEMO0001"
- 3 demo users with pre-set credentials:
  - CHW: demo-chw@daghe.demo / role: chw / facility: DEMO0001
  - Supervisor: demo-supervisor@daghe.demo / role: supervisor / facility: DEMO0001
  - Admin: demo-admin@daghe.demo / role: admin
- 20 demo encounters: mix of POSITIVE (6), NEGATIVE (10), REFER (4) — various inference methods represented, various age bands, various screening contexts
- 3 demo VIA images (positive, negative, indeterminate) for demo mode — bundled with the app, cached by service worker
- `cervical-via` module pre-loaded and enabled
- Seed script must be idempotent — running it multiple times on a production database must not overwrite real data. Check for existence before inserting.

---

## 13. Future Roadmap (Post-v1.0)

- Additional condition modules in priority order: TB chest X-ray (`chest-xray-tb`), skin lesion (`skin-lesion`), malaria slide (`malaria-slide`), retinal screening (`retinal`), then CT/MRI/X-ray/ultrasound scan interpretation modules
- Web push notifications (v1.1)
- Supervisor live dashboard with real-time sync (Supabase Realtime)
- Referral integration: generate structured referral letter from screening result
- FHIR / DHIS2 export for Ministry of Health system integration
- Offline model fine-tuning pipeline (federated learning, privacy-preserving)
- Daghe / Asibi integration module
- EU MDR regulatory submission package generation
- RTL layout support (Arabic, Amharic) — CSS logical properties already in place
- DICOM viewer integration for CT/MRI/X-ray modules

---

## 14. Open Questions / Decisions Pending

- Global Health Labs model access: confirm timeline for receiving AI-ACVT source via CHAI partnership. Until confirmed, use a placeholder MobileNetV2 (ImageNet-pretrained) to keep the inference pipeline demonstrable.
- Nigerian teaching hospital clinical validation site partnerships: confirm before Phase 2 clinical testing
- DigitalOcean Managed PostgreSQL tier: confirm plan and region before production deployment
- Pricing model activation: Daghe is free for all partners during the pilot phase. Payment scaffolding (Paystack + Dodopayments) is in the stack but not activated in v1.0.
- Image upload feature: disabled by default. Before enabling in any deployment, a clinical ethics review and updated consent process must be completed.

---

*Built by NG44 Consulting Ltd, Nigeria. Daghe: "to see" in Esan. Built for Africa, by Africa.*
