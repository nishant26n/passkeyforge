export const rpName = "PasskeyForge";

export const rpID =
  process.env.NODE_ENV === "production"
    ? process.env.WEBAUTHN_RP_ID!
    : "localhost";

export const origin =
  process.env.NODE_ENV === "production"
    ? process.env.WEBAUTHN_ORIGIN!
    : "http://localhost:3000";
