# Asibi

**Offline-first triage support for community health workers dealing with climate-related illness.**

Asibi is a multilingual Progressive Web App (PWA) that helps community health workers (CHWs) in Nigeria assess and respond to climate-sensitive illnesses — without needing an internet connection.

---

## The Problem

Nigeria has over 300,000 community health workers. Many operate in rural areas with no reliable internet, no diagnostic tools, and rising patient loads driven by extreme heat, flooding, and dust storms. When a child arrives with a fever after a flood, or collapses from heat exhaustion, the CHW has to make a judgment call with very little support.

Climate change is making this harder every year.

---

## What Asibi Does

- Guides CHWs through a structured triage flow for five climate-sensitive illnesses
- Works fully offline after first install — no internet needed at point of care
- Speaks four languages: English, Hausa, Yoruba, Igbo
- Saves every case locally and syncs to a dashboard when connectivity returns
- Gives clinic supervisors a live view of illness patterns across their CHW network

---

## Climate Illness Coverage

| Illness | Climate Trigger |
|---|---|
| Heatstroke / Heat Exhaustion | Extreme heat days |
| Malaria surge | Heavy rainfall / flooding |
| Dengue fever | Stagnant water post-flood |
| Respiratory illness | Dust storms / wildfire smoke |
| Waterborne illness | Post-flood contamination |
* Support for More to be added in the future
---

## How It Works

```
CHW opens app (one-time internet load)
→ Installs to home screen like a native app
→ Selects language
→ Taps "Start Triage"
→ Selects symptom cluster
→ Answers 3–5 guided follow-up questions
→ Gets a result: likely illness + recommended action
→ Case saved locally
→ Syncs to Supabase dashboard when online
```

No keyboard input during triage. No login required. Works on any Android or iOS device from 2018 onward.

---

## Tech Stack

- **Next.js 14** — app framework
- **Tailwind CSS** — mobile-first UI
- **Service Workers + Cache API** — offline capability
- **IndexedDB** — local case storage
- **Gemini Flash 2.0** — AI triage engine (live when online, cached decision trees when offline)
- **Supabase** — case sync and supervisor dashboard backend
- **i18n** — English, Hausa, Yoruba, Igbo

---

## Storage Architecture

```
Layer 1 — Service Worker Cache
  App shell, UI, fonts, icons
  Loaded once, never needs internet again

Layer 2 — Triage Logic Cache (JSON)
  Pre-built decision trees for all 5 illness types
  Gemini called live for edge cases when online

Layer 3 — IndexedDB
  Every triage session saved locally
  Auto-syncs to Supabase when internet returns
```

---

## UX Design Principles

- One thumb, one screen — all actions reachable without scrolling
- Tap-only inputs during triage — no keyboard
- High contrast — readable in direct sunlight
- Color + icon coded results — no reliance on text alone
- Under 3 minutes from open to result

---

## Data & Privacy

- No patient names stored anywhere
- Data collected: age range, sex, symptoms, result, location (optional), timestamp
- Consent screen shown on first use
- All sync to Supabase is encrypted in transit
- Designed to meet UNICEF consent-based data sharing standards

---

## Roadmap

- [x] Core triage flow (heatstroke, malaria pathways)
- [x] Offline PWA install and service worker caching
- [x] English and Hausa language support
- [ ] Support for more illnesses
- [ ] Yoruba and Igbo language strings
- [ ] Supervisor dashboard v1
- [ ] CHW pilot — 50 users across 2 Nigerian states
- [ ] Live outbreak alert integration
- [ ] v1.0 open-source release
- [ ] Expansion to additional UNICEF programme countries

---

## License

GNU General Public License v3.0. Fully open-source.

---
