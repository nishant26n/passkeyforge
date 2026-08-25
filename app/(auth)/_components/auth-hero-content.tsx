import type { HeroContent } from "./auth-shell";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PasskeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c0-3 2.9-5 6.5-5" />
      <path d="M17 10.5a2.5 2.5 0 0 1 2.5 2.5v1M14.5 14h5v6h-5z" />
    </svg>
  );
}

function AuthenticatorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <rect x="4" y="3" width="16" height="18" rx="2.5" />
      <path d="M8 9h8M8 13h8M8 17h4" />
    </svg>
  );
}

function RecoveryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px]"
      aria-hidden
    >
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M7 7V5a5 5 0 0 1 10 0v2" />
    </svg>
  );
}

export const loginHero: HeroContent = {
  eyebrow: "WEBAUTHN / FIDO2",
  heading: "Sign in with the device you already trust.",
  body: "Passkeys replace the password with a key that never leaves your hardware. Authenticator codes and one-time recovery codes cover every fallback.",
  mobileBody:
    "Passkeys, authenticator codes and one-time recovery codes — all phishing-resistant.",
  features: [
    {
      icon: <CheckIcon />,
      title: "Phishing-resistant by design",
      body: "Credentials are bound to this origin, so they can't be replayed elsewhere.",
    },
    {
      icon: <CheckIcon />,
      title: "Recovery you control",
      body: "Twelve-character one-time codes, stored hashed and revocable at any time.",
    },
  ],
};

export const registerHero: HeroContent = {
  eyebrow: "MULTI-FACTOR BY DEFAULT",
  heading: "Three ways in. No shared secrets.",
  body: "Set up an account, then add the factors you want. Everything is manageable from one security page.",
  mobileBody:
    "Set up an account, then add passkeys, an authenticator app or recovery codes.",
  features: [
    {
      icon: <PasskeyIcon />,
      title: "Passkeys",
      body: "Face, fingerprint or security key.",
    },
    {
      icon: <AuthenticatorIcon />,
      title: "Authenticator app",
      body: "Time-based six-digit codes.",
    },
    {
      icon: <RecoveryIcon />,
      title: "Recovery codes",
      body: "One-time, offline, hashed at rest.",
    },
  ],
};

export const passkeyLoginHero: HeroContent = {
  eyebrow: "DISCOVERABLE CREDENTIAL",
  heading: "Your browser will ask for the device, not the password.",
  body: "Approve the prompt on the authenticator you registered. Nothing leaves it but a signature.",
};

export const authenticatorLoginHero: HeroContent = {
  eyebrow: "TIME-BASED CODES",
  heading: "A backup that works offline.",
  body: "Codes rotate every thirty seconds and are verified against the secret you scanned during setup.",
};

export const recoveryHero: HeroContent = {
  eyebrow: "LAST RESORT ACCESS",
  heading: "The last way back in.",
  body: "Recovery codes are stored hashed and spent on use. After signing in, generate a fresh set from your security settings.",
};
