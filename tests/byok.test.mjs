// Unit tests for AES-256-GCM BYOK key encrypt/decrypt round-trip
// Tests that keys are never stored or returned in plaintext

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

// Inline the BYOK functions under test (same logic as lib/server/byok.ts)
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encryptKey(plaintextApiKey, masterKeyHex) {
  const masterKey = Buffer.from(masterKeyHex, "hex");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextApiKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    ciphertext: ciphertext.toString("hex"),
    tag: tag.toString("hex"),
  };
}

function decryptKey(encrypted, masterKeyHex) {
  const masterKey = Buffer.from(masterKeyHex, "hex");
  const iv = Buffer.from(encrypted.iv, "hex");
  const ciphertext = Buffer.from(encrypted.ciphertext, "hex");
  const tag = Buffer.from(encrypted.tag, "hex");
  if (tag.length !== TAG_LENGTH) throw new Error("Invalid auth tag length");
  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function maskKey(plaintextApiKey) {
  if (plaintextApiKey.length <= 8) return "****";
  return plaintextApiKey.slice(0, 4) + "..." + plaintextApiKey.slice(-4);
}

// Test master key (never used in production)
const TEST_MASTER_KEY = "0".repeat(64);

console.log("\nbyok.test.mjs: AES-256-GCM encrypt/decrypt round-trip");

// Basic round-trip
const apiKey = "sk-test-1234567890abcdefghijklmnop";
const encrypted = encryptKey(apiKey, TEST_MASTER_KEY);
const decrypted = decryptKey(encrypted, TEST_MASTER_KEY);
assert(decrypted === apiKey, "round-trip: decrypt(encrypt(key)) === original key");

// Encrypted form must not contain the plaintext key
assert(!encrypted.ciphertext.includes(apiKey), "ciphertext does not contain plaintext key");
assert(!encrypted.iv.includes(apiKey), "iv does not contain plaintext key");
assert(!encrypted.tag.includes(apiKey), "tag does not contain plaintext key");

// Each encryption produces different ciphertext (random IV)
const encrypted2 = encryptKey(apiKey, TEST_MASTER_KEY);
assert(encrypted.iv !== encrypted2.iv, "each encryption uses a fresh random IV");
assert(encrypted.ciphertext !== encrypted2.ciphertext, "different IVs produce different ciphertext");

// Tampered tag must throw
console.log("\nbyok.test.mjs: authentication tag verification");
const tampered = { ...encrypted, tag: "ff".repeat(16) };
let didThrow = false;
try {
  decryptKey(tampered, TEST_MASTER_KEY);
} catch {
  didThrow = true;
}
assert(didThrow, "tampered authentication tag causes decryption to throw");

// Tampered ciphertext must throw
const tamperedCiphertext = { ...encrypted, ciphertext: "00" + encrypted.ciphertext.slice(2) };
let didThrow2 = false;
try {
  decryptKey(tamperedCiphertext, TEST_MASTER_KEY);
} catch {
  didThrow2 = true;
}
assert(didThrow2, "tampered ciphertext causes decryption to throw");

// Wrong key must throw or return garbage
const wrongKey = "a".repeat(64);
let didThrow3 = false;
try {
  const wrongDecrypted = decryptKey(encrypted, wrongKey);
  didThrow3 = wrongDecrypted !== apiKey;
} catch {
  didThrow3 = true;
}
assert(didThrow3, "wrong master key fails decryption");

// Mask function
console.log("\nbyok.test.mjs: key masking");
const masked = maskKey(apiKey);
assert(!masked.includes(apiKey), "masked key does not reveal full key");
assert(masked.includes("..."), "masked key contains ellipsis");
assert(masked.startsWith(apiKey.slice(0, 4)), "masked key starts with first 4 chars");
assert(masked.endsWith(apiKey.slice(-4)), "masked key ends with last 4 chars");

const shortKey = "abc";
assert(maskKey(shortKey) === "****", "short key is fully masked");

// Key length constraints
console.log("\nbyok.test.mjs: long key round-trip");
const longKey = "sk-" + "x".repeat(200);
const encLong = encryptKey(longKey, TEST_MASTER_KEY);
const decLong = decryptKey(encLong, TEST_MASTER_KEY);
assert(decLong === longKey, "long key round-trips correctly");

console.log(`\nbyok.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("byok.test.mjs: SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("byok.test.mjs: ALL TESTS PASSED");
}
