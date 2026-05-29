import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const hex = process.env.BYOK_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("BYOK_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export interface EncryptedKey {
  iv: string;       // hex
  ciphertext: string; // hex
  tag: string;      // hex
}

export function encryptKey(plaintextApiKey: string): EncryptedKey {
  const masterKey = getMasterKey();
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

export function decryptKey(encrypted: EncryptedKey): string {
  const masterKey = getMasterKey();
  const iv = Buffer.from(encrypted.iv, "hex");
  const ciphertext = Buffer.from(encrypted.ciphertext, "hex");
  const tag = Buffer.from(encrypted.tag, "hex");
  if (tag.length !== TAG_LENGTH) throw new Error("Invalid auth tag length");
  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

// Returns a masked preview like "sk-...abcd" — never the full key
export function maskKey(plaintextApiKey: string): string {
  if (plaintextApiKey.length <= 8) return "****";
  return plaintextApiKey.slice(0, 4) + "..." + plaintextApiKey.slice(-4);
}
