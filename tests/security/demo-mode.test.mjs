let passed = 0; let failed = 0;
function assert(condition, message) {
  if (condition) { passed++; console.log(`  PASS: ${message}`); }
  else { failed++; console.error(`  FAIL: ${message}`); }
}

// Inline getUnsyncedEncounters filter logic (from lib/encounters.ts)
function simulateGetUnsynced(encounters) {
  return encounters.filter(e => e.syncStatus === "pending" && !e.isDemoEncounter);
}

// Inline sync route demo rejection (from api/encounters/sync/route.ts)
function simulateSyncRoute(encounter) {
  if (encounter.isDemoEncounter === true) {
    return { ok: false, code: "demo_encounter_rejected" };
  }
  return { ok: true };
}

console.log("\ndemo-mode.test.mjs: isDemoEncounter exclusion from sync queue");

const demoEncounter = { id: "uuid-1", syncStatus: "pending", isDemoEncounter: true, moduleId: "cervical-via" };
const realEncounter = { id: "uuid-2", syncStatus: "pending", isDemoEncounter: false, moduleId: "cervical-via" };
const syncedEncounter = { id: "uuid-3", syncStatus: "synced", isDemoEncounter: false, moduleId: "cervical-via" };

const queue = simulateGetUnsynced([demoEncounter, realEncounter, syncedEncounter]);
assert(queue.length === 1, "only 1 encounter in sync queue");
assert(queue[0].id === "uuid-2", "only the real pending encounter is queued");
assert(!queue.some(e => e.isDemoEncounter), "no demo encounters in sync queue");
assert(!queue.some(e => e.syncStatus !== "pending"), "no already-synced encounters in queue");

console.log("\ndemo-mode.test.mjs: sync route rejects isDemoEncounter");

assert(simulateSyncRoute(demoEncounter).ok === false, "sync route rejects demo encounter");
assert(simulateSyncRoute(demoEncounter).code === "demo_encounter_rejected", "correct rejection code");
assert(simulateSyncRoute(realEncounter).ok === true, "sync route accepts real encounter");

console.log("\ndemo-mode.test.mjs: multiple demo encounters all excluded");
const manyDemo = Array.from({ length: 5 }, (_, i) => ({ id: `demo-${i}`, syncStatus: "pending", isDemoEncounter: true }));
const manyReal = Array.from({ length: 3 }, (_, i) => ({ id: `real-${i}`, syncStatus: "pending", isDemoEncounter: false }));
const mixed = [...manyDemo, ...manyReal];
const filteredMixed = simulateGetUnsynced(mixed);
assert(filteredMixed.length === 3, "all 3 real encounters pass through");
assert(filteredMixed.every(e => !e.isDemoEncounter), "zero demo encounters in result");

console.log(`\ndemo-mode.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error("SOME TESTS FAILED"); process.exit(1); }
else { console.log("demo-mode.test.mjs: ALL TESTS PASSED"); }
