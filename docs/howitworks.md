# How Daghe Works

This guide explains the product for users and administrators — no technical background required.

Daghe is a **multi-modal medical imaging screening platform** for community health workers. It is designed to support any clinical imaging modality — starting with cervical cancer VIA screening, and expanding to chest X-ray (TB), skin lesions, retinal imaging, MRI, CT, ultrasound, and more — through a pluggable module system.

## 1) Main User Types

- **CHW (Community Health Worker):** Performs AI-assisted screening using enabled imaging modules (e.g. cervical VIA, chest X-ray). Captures images, receives AI-assisted classifications, saves encounters.
- **Supervisor:** Reviews encounter history, manages BYOK API keys, monitors AI costs.
- **Admin:** Full access — manages users, clinics, modules, AI providers, cost dashboard.

## 2) The Screening Flow

A complete screening session has 8 steps:

```
Module select → Patient context → Capture guide → Image capture
      ↓
Quality check → AI inference → Result display → Action taken + Save
```

**Module select:** Choose the screening type from the list of modules enabled for your facility. The v1.0 platform launches with `Cervical Cancer Screening (VIA)`. Additional modules (chest X-ray TB screening, skin lesion assessment, retinal screening, and more) are added through the admin panel as they become available.

**Patient context:** Select patient age band (anonymous) and screening reason (routine / referral / HPV-positive triage). No names or identifiers are collected.

**Capture guide:** On-screen tips for good image quality — lighting, focus, acetic acid timing.

**Image capture:** Camera opens using the rear-facing camera (`facingMode: environment`). CHW can also upload a gallery image. The image is held in browser memory only — never written to disk or transmitted.

**Quality check:** Automatic quality validation:
- Blur detection (Laplacian variance algorithm)
- Exposure check (mean pixel brightness)
- If 3 consecutive failures: "Continue anyway" override appears

**AI inference (5-step chain):**
1. On-device TFLite model (WASM) — instant, works offline, no cost
2. Gemini Flash (cloud) — if TFLite unavailable
3. GPT-4o (cloud) — if Gemini fails
4. Module-specific offline rule-based questions (WHO-sourced per module) — if device is offline
5. Reference only — reserved for future use

After inference, the image is immediately deleted from memory.

**Result display:**
- Classification badge: POSITIVE / NEGATIVE / REFER (colour + icon + text — never colour alone)
- Confidence band: always visible, never hidden in a tooltip
  - HIGH (green) — model is confident
  - MODERATE (amber) — use clinical judgment
  - LOW (red) — AUTOMATICALLY overrides to REFER regardless of classification
  - REFERENCE ONLY (grey) — AUTOMATICALLY overrides to REFER
- Inference method chip (on-device AI / online AI / offline guidance)
- Cost chip (online AI calls only)
- Recommended action text

**Action taken + Save:** CHW selects what was done (treated / referred / monitored / declined), optionally adds notes (stored on device only, never synced), then saves the encounter.

## 3) AI Safety Rules

**The most important rule:** LOW or REFERENCE_ONLY confidence always overrides the classification to REFER — unconditionally. This cannot be turned off. A missed positive is more dangerous than a false referral.

## 4) Offline-First Behaviour

- Daghe installs as a PWA and works offline after first visit.
- AI models download in the background and cache in browser storage (`daghe-models-v1`).
- Encounters save locally in IndexedDB (Dexie.js, database `daghe`).
- When connectivity returns, a background sync agent uploads pending encounters automatically.
- Failed sync retries with exponential backoff: 30s → 1min → 2min → ...
- Demo encounters (`isDemoEncounter: true`) are **never** synced to the server.

## 5) Data Privacy

- **No PII collected:** No patient names, phone numbers, IDs, or locations.
- **Images never stored:** After inference, the image buffer is explicitly nulled in memory.
- **Encounter data:** age band + screening context + result + action taken — fully anonymous.
- **Notes field:** Stored on the device only, never uploaded.
- **BYOK keys:** Encrypted with AES-256-GCM before storage — the server never sees the plaintext key again.

## 6) Security Model

- All users must log in (Supabase Auth).
- Roles (chw / supervisor / admin) are verified by database query on every API call — never from the session token alone.
- CSRF tokens protect all state-changing actions.
- Rate limiting prevents abuse: 20 AI calls/minute per user, 5 PIN attempts/minute per facility code.
- AI provider URLs are hardcoded — no user input can redirect outbound AI calls (SSRF guard).
- Prompt injection: all user fields are wrapped in delimiters that prevent escaping into the system prompt.

## 7) BYOK (Bring Your Own Key)

Supervisors can store their own AI provider API keys so that AI calls are billed to their account:
1. Go to Settings → API Keys.
2. Select provider (Gemini / OpenAI / DeepSeek) and enter the key.
3. The key is encrypted on the server and stored in the database.
4. GET responses only return a masked preview (`sk-...abcd`) — the plaintext is never returned.
5. AI costs appear in Admin → Cost Dashboard, attributed by provider and key type (platform/byok).

## 8) Admin Capabilities

- **Users tab:** Create, deactivate, and change roles for CHWs and supervisors.
- **Clinics/Regions tabs:** Manage facility hierarchy.
- **Modules tab:** Enable/disable screening modules (e.g., temporarily disable cervical-via for maintenance).
- **AI Providers tab:** Toggle Gemini / OpenAI / DeepSeek on or off centrally.
- **Cost Dashboard:** View total estimated AI spend by provider, number of calls, and total tokens.
- **Metrics tab:** Overall encounter counts.

## 9) Typical Day Workflow

1. CHW opens Daghe (loads from cache if offline).
2. Selects cervical-via module, enters patient context.
3. Captures image after applying acetic acid.
4. Receives AI-assisted classification in under 5 seconds (on-device).
5. Records action taken and saves encounter.
6. Returns to connectivity; encounters sync automatically in background.
7. Supervisor checks dashboard; reviews any REFER encounters with the team.

## 10) Limitations

- TFLite models require placement in `public/models/` — they are not bundled.
- Browser storage (IndexedDB + Cache API) can be cleared by OS or browser settings.
- Cloud AI fallback requires internet and a valid API key.
- The rule-based fallback uses 3 questions only — it is less precise than the AI models.
- Daghe supports 19 languages: English, Hausa, Yoruba, Igbo, French, Arabic, Swahili, Amharic, Oromo, Lingala, Twi, Ewe, Ga, Dagbani, Fula, Wolof, Zulu, Xhosa, and Afrikaans. Professional clinical translations for non-English languages are being validated by clinical partners. English is the reference translation.

## 11) Platform Roadmap — Planned Modules

Daghe is built as a pluggable module platform. Each new imaging modality is added as a self-contained module — no changes to core app code are required.

**Current (v1.0):**

| Module | Modality |
|---|---|
| `@daghe/cervical-via` | Cervical cancer screening via VIA |

**Planned post-v1.0:**

| Module | Modality |
|---|---|
| `chest-xray-tb` | Chest X-ray — TB screening |
| `skin-lesion` | Skin / wound assessment |
| `retinal` | Retinal / eye screening |
| `malaria-slide` | Malaria slide reading |
| `ct-brain` | Brain CT interpretation |
| `mri-spine` | Spine MRI interpretation |
| `xray-general` | General X-ray interpretation (fractures, pneumonia) |
| `ultrasound` | Ultrasound interpretation (obstetric, abdominal) |

Each module defines its own TFLite models, offline rule-based fallback, clinical reference text, demo images, and localised strings. Modules are enabled or disabled per deployment from the Admin panel — a facility in Nigeria focused on cervical screening can run only `cervical-via`, while a hospital radiology department can enable `ct-brain` and `mri-spine` alongside it.
