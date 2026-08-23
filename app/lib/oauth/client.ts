import { createHash, randomBytes } from "node:crypto";

export function generateClientId() {
  return `pf_client_${randomBytes(24).toString("base64url")}`;
}

export function generateClientSecret() {
  return `pf_secret_${randomBytes(32).toString("base64url")}`;
}

export function hashClientSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}
