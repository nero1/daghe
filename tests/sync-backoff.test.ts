import assert from "node:assert/strict";
import { calculateBackoffDelayMs } from "../apps/web/lib/sync";

assert.equal(calculateBackoffDelayMs(0), 1000);
assert.equal(calculateBackoffDelayMs(1), 2000);
assert.equal(calculateBackoffDelayMs(10), 60000);
console.log("sync-backoff.test.ts passed");

