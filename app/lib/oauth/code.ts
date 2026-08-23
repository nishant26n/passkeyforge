import { createHash, randomBytes } from "node:crypto";

export function generateAuthorizationCode() {
  return randomBytes(32).toString("base64url");
}

export function hashAuthorizationCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export function generateAccessToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
