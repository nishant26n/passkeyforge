import { createHash, randomBytes } from "node:crypto";

export function generateRecoveryCode() {
  const value = randomBytes(6).toString("hex").toUpperCase();
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
}

// Trims and uppercases before hashing so a code copy-pasted with stray
// whitespace or typed in lowercase still hashes to the value that was stored
// at generation time.
export function hashRecoveryCode(code: string) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}
