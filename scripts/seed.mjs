#!/usr/bin/env node
/**
 * Seed script — creates demo facility, users, and encounters for development/demo.
 * Safe to re-run: uses ON CONFLICT DO NOTHING to avoid duplicating data.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs
 *
 * Or with .env.local loaded:
 *   node -r dotenv/config scripts/seed.mjs dotenv_config_path=apps/web/.env.local
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars are required.");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: "resolution=ignore-duplicates,return=representation",
};

async function post(path, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  ⚠ ${path}: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }
  return res.json();
}

async function createAuthUser(email, password, role, name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, name },
    }),
  });
  if (res.status === 422) {
    // User already exists — fetch existing
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    if (listRes.ok) {
      const list = await listRes.json();
      const existing = (list.users ?? list).find((u) => u.email === email);
      if (existing) return existing;
    }
    return null;
  }
  if (!res.ok) {
    const text = await res.text();
    console.warn(`  ⚠ auth user ${email}: ${res.status} ${text.slice(0, 200)}`);
    return null;
  }
  return res.json();
}

// ─── Seed data ─────────────────────────────────────────────────────────────

const DEMO_REGION_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_CLINIC_ID = "00000000-0000-0000-0000-000000000002";
const DEMO_FACILITY_CODE_ID = "00000000-0000-0000-0000-000000000003";

const DEMO_USERS = [
  { email: "demo-chw@daghe.demo", password: "demo-chw-2024", name: "Demo CHW", role: "chw" },
  { email: "demo-supervisor@daghe.demo", password: "demo-supervisor-2024", name: "Demo Supervisor", role: "supervisor" },
  { email: "demo-admin@daghe.demo", password: "demo-admin-2024", name: "Demo Admin", role: "admin" },
];

// 20 demo encounters: 6 POSITIVE, 10 NEGATIVE, 4 REFER
const ENCOUNTER_TEMPLATES = [
  ...Array.from({ length: 6 }, (_, i) => ({
    classification: "POSITIVE", confidenceBand: i < 4 ? "HIGH" : "MODERATE",
    inferenceMethod: i < 2 ? "tflite" : i < 4 ? "gemini" : "rule-based",
    ageBand: ["30–34", "35–39", "40–44", "45–49", "25–29", "50+"][i],
    context: ["routine", "referral", "hpv-positive-triage", "routine", "referral", "routine"][i],
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    classification: "NEGATIVE", confidenceBand: i < 7 ? "HIGH" : "MODERATE",
    inferenceMethod: i < 3 ? "tflite" : i < 6 ? "gemini" : i < 8 ? "gpt4o" : "rule-based",
    ageBand: ["25–29", "30–34", "35–39", "40–44", "45–49", "50+", "30–34", "35–39", "40–44", "45–49"][i],
    context: ["routine", "routine", "referral", "routine", "routine", "routine", "hpv-positive-triage", "referral", "routine", "routine"][i],
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    classification: "REFER", confidenceBand: i < 2 ? "MODERATE" : "LOW",
    inferenceMethod: i < 2 ? "rule-based" : "reference",
    ageBand: ["35–39", "40–44", "45–49", "50+"][i],
    context: ["referral", "hpv-positive-triage", "referral", "routine"][i],
  })),
];

async function run() {
  console.log("Seeding Daghe demo data…\n");

  // 1. Seed region
  console.log("1. Creating demo region…");
  await post("regions", {
    id: DEMO_REGION_ID,
    name: "Demo Region",
    country: "NG",
    created_at: new Date().toISOString(),
  });

  // 2. Seed clinic
  console.log("2. Creating demo clinic…");
  await post("clinics", {
    id: DEMO_CLINIC_ID,
    name: "Daghe Demo Health Centre",
    region_id: DEMO_REGION_ID,
    created_at: new Date().toISOString(),
  });

  // 3. Seed facility code
  console.log("3. Creating demo facility code…");
  await post("facility_codes", {
    id: DEMO_FACILITY_CODE_ID,
    code: "DEMO0001",
    facility_name: "Daghe Demo Health Centre",
    clinic_id: DEMO_CLINIC_ID,
    active: true,
    created_at: new Date().toISOString(),
  });

  // 4. Seed users
  console.log("4. Creating demo users…");
  const userIds = {};
  for (const user of DEMO_USERS) {
    process.stdout.write(`  ${user.email}… `);
    const authUser = await createAuthUser(user.email, user.password, user.role, user.name);
    if (!authUser?.id) { console.log("skipped (no auth user)"); continue; }
    const userId = authUser.id;
    userIds[user.role] = userId;
    await post("users", {
      id: userId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: "active",
      clinic_id: DEMO_CLINIC_ID,
      region_id: DEMO_REGION_ID,
    });
    console.log(`✓ ${userId}`);
  }

  // 5. Seed encounters
  console.log("\n5. Creating 20 demo encounters…");
  const chwId = userIds["chw"];
  if (!chwId) {
    console.warn("  ⚠ No CHW user — skipping encounters");
  } else {
    for (let i = 0; i < ENCOUNTER_TEMPLATES.length; i++) {
      const t = ENCOUNTER_TEMPLATES[i];
      const daysAgo = ENCOUNTER_TEMPLATES.length - i;
      const ts = new Date(Date.now() - daysAgo * 86400_000).toISOString();
      const encId = `00000000-dead-beef-0000-${String(i + 1).padStart(12, "0")}`;

      await post("encounters", {
        id: encId,
        facility_id: DEMO_CLINIC_ID,
        user_id: chwId,
        module_id: "cervical-via",
        patient_age_band: t.ageBand,
        screening_context: t.context,
        classification: t.classification,
        confidence_band: t.confidenceBand,
        inference_method: t.inferenceMethod,
        confidence_score: t.confidenceBand === "HIGH" ? 0.88 : t.confidenceBand === "MODERATE" ? 0.71 : 0.55,
        confidence_sentence: `${t.confidenceBand} confidence result from ${t.inferenceMethod} inference.`,
        recommended_action: t.classification === "NEGATIVE" ? "Routine rescreening in 3 years." : "Refer for clinical assessment.",
        referral_required: t.classification !== "NEGATIVE",
        action_taken: t.classification === "NEGATIVE" ? "monitored" : "referred",
        quality_override: false,
        image_hash: null,
        app_version: "0.1.0",
        module_version: "1.0.0",
        device_local_time: ts,
        utc_time: ts,
        sync_status: "synced",
        retry_count: 0,
        idempotency_key: encId,
        is_demo: true,
      });
      process.stdout.write(".");
    }
    console.log(" ✓ 20 encounters created");
  }

  console.log("\n✅ Seed complete!");
  console.log("\nDemo credentials:");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.role}: ${u.email} / ${u.password}`);
  }
  console.log("  Facility code: DEMO0001");
}

run().catch((err) => { console.error(err); process.exit(1); });
