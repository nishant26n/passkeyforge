# Passkey Forge

A self-hosted WebAuthn/FIDO2 authentication service, built to understand the passkey protocol from the wire up rather than integrate an SDK and move on. Password + passkey + TOTP + recovery codes, real rate limiting, session rotation with reuse detection, and a test suite that drives an actual WebAuthn ceremony through Chrome's CDP virtual authenticator instead of mocking it.

**Live demo:** https://passkeyforge.vercel.app
**Demo account:** `demo@passkeyforge.dev` / `PasskeyForge!Demo1` — sign in with the password first (passkeys are bound to the device that created them, so none can be pre-seeded), then add a passkey from the home page to try the passwordless flows.

---

## What this actually defends against — and what it doesn't

This is the part most WebAuthn demos skip. Read it before trusting anything above it.

**Defends against:**

- **Phishing.** A WebAuthn assertion is cryptographically bound to the origin that requested it (`expectedOrigin`/`expectedRPID`, checked server-side on every login). A credential registered for `passkeyforge.vercel.app` cannot be replayed against a look-alike domain — the browser won't even produce a signature for the wrong origin.
- **Challenge replay.** Every registration and login challenge is single-use: stored server-side, looked up by its own value (not by which user requested it — see [Usernameless login](#usernameless-login)), and deleted the moment it's consumed. A captured request replayed later fails with `Challenge expired, please try again`.
- **Credential stuffing / brute force.** Every auth-adjacent endpoint (login, passkey options/verify, TOTP verify, recovery) is rate-limited by email *and* IP independently (Upstash Redis, sliding window). Passwords are hashed with Argon2, not a fast hash.
- **XSS token theft.** Sessions live in an `httpOnly`, `Secure`, `SameSite=Lax` cookie — client-side JavaScript, including an injected script, cannot read it.
- **Session fixation / stolen-cookie replay.** Refreshing a session rotates its token and invalidates the old one; presenting a rotated-out token is treated as a signal (not silently ignored) and destroys the session record outright.
- **Signature counter regression / cloned authenticators.** `@simplewebauthn/server` checks the authenticator's signature counter on every assertion; a counter that goes backwards (a hallmark of a cloned credential) fails verification.
- **Malformed / oversized input reaching business logic.** Every POST route validates its body with Zod before touching the database.

**Does not defend against:**

- **A compromised device.** If the device itself is compromised (malware with control of the browser, OS-level keylogging), WebAuthn's phishing-resistance doesn't help — the attacker is inside the trust boundary the passkey lives in.
- **Account recovery social-engineering.** Recovery codes and TOTP are real fallbacks, not vestigial — losing them *and* your passkey means losing the account, by design. But if an attacker convinces a user to hand over a recovery code, this system can't tell that from the real owner using it.
- **The demo account.** `demo@passkeyforge.dev` is public and shared. Don't put anything you care about behind it — it gets reset by the seed script and isn't a security boundary for anything.
- **Infrastructure-level attacks.** No WAF, no DDoS protection, no dependency-supply-chain verification beyond what npm/GitHub provide. Database and Redis security is Neon's and Upstash's respectively — this app trusts them.
- **Email verification.** Registration doesn't confirm the email address is real or owned by the registrant. Anyone can sign up with any syntactically valid email.
- **CSRF beyond `SameSite=Lax`.** State-changing routes rely on the cookie's `SameSite` attribute rather than a dedicated CSRF token. `Lax` blocks the common cross-site `<form>`/`<img>` forgery vectors but is not a full CSRF framework.

---

## Architecture

```mermaid
flowchart LR
    subgraph Client["Browser"]
        UI["Next.js pages<br/>(App Router)"]
        WA["WebAuthn API<br/>(navigator.credentials)"]
    end

    subgraph Server["Next.js API routes (Vercel)"]
        Auth["/api/auth/*<br/>password · TOTP · recovery"]
        Web["/api/webauthn/*<br/>registration · authentication"]
    end

    DB[("Postgres (Neon)<br/>via Prisma")]
    Redis[("Upstash Redis<br/>rate limiting")]

    UI -->|fetch| Auth
    UI -->|fetch| Web
    WA <-->|ceremony| Web

    Auth --> DB
    Web --> DB
    Auth --> Redis
    Web --> Redis
```

Server and client components both live in `app/`; API routes under `app/api/**/route.ts` are the actual auth surface. Business logic that needs to be independently unit-testable (session handling, password hashing, recovery codes, rate limiting) lives in `app/lib/`.

## The two WebAuthn ceremonies

### Registration (attestation) — enrolling a new passkey

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server
    participant DB as Postgres

    B->>S: POST /api/webauthn/register/options
    S->>DB: store challenge (5 min TTL, tied to this user)
    S-->>B: PublicKeyCredentialCreationOptions (challenge, rpID, excludeCredentials)
    B->>B: navigator.credentials.create()<br/>(authenticator generates a keypair,<br/>signs the challenge with the new private key)
    B->>S: POST /api/webauthn/register/verify<br/>{ credential: attestation, name }
    S->>DB: look up + delete the challenge (single use)
    S->>S: verifyRegistrationResponse()<br/>checks origin, RP ID, challenge, signature
    S->>DB: store credential ID + public key + counter + aaguid
    S-->>B: 201 { verified: true }
```

The private key never leaves the authenticator — the server only ever receives and stores a public key.

### Authentication (assertion) — signing in with a passkey

```mermaid
sequenceDiagram
    participant B as Browser
    participant S as Server
    participant DB as Postgres

    alt email-first
        B->>S: POST /api/webauthn/auth/options { email }
        S->>DB: look up the user's credential IDs
    else usernameless
        B->>S: POST /api/webauthn/auth/options { usernameless: true }
        Note over S: no allowCredentials — the authenticator<br/>offers its own resident credentials
    end
    S->>DB: store challenge (user-scoped, or unscoped for usernameless)
    S-->>B: PublicKeyCredentialRequestOptions
    B->>B: navigator.credentials.get()<br/>(authenticator signs the challenge<br/>with the stored private key)
    B->>S: POST /api/webauthn/auth/verify { id, response, ... }
    S->>DB: find credential by id, find challenge by its value
    S->>S: verifyAuthenticationResponse()<br/>checks signature, counter, origin, RP ID
    S->>DB: bump counter, set lastUsedAt, create session
    S-->>B: Set-Cookie: session=... (httpOnly, Secure, SameSite=Lax)
```

### Usernameless login

The email-first and usernameless flows share one `/api/webauthn/auth/verify` implementation. The server doesn't know which user is authenticating until the assertion's credential ID resolves it — so the challenge is looked up by its own value (decoded from `clientDataJSON`), not by a pre-known user ID. A challenge issued for a known email is still scoped to that user server-side; a usernameless challenge is scoped to none, and is redeemable by whichever resident credential the authenticator offers.

---

## Features

- Email + password auth (Argon2 hashing, session cookies)
- WebAuthn/passkey registration and login, including usernameless (discoverable-credential) sign-in
- TOTP as a second factor / fallback, with QR-code setup
- One-time recovery codes for full account recovery
- Multi-passkey management: nickname, device-type label (AAGUID lookup against the [public passkeydeveloper registry](https://github.com/passkeydeveloper/passkey-authenticator-aaguids)), last-used tracking, revoke
- Rate limiting on every auth-adjacent endpoint, scoped by email and IP independently
- Session rotation with reuse detection on refresh
- Security headers: CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy
- Zod validation on every route that accepts a body

## Tech stack

Next.js (App Router) + TypeScript · PostgreSQL ([Neon](https://neon.tech)) + Prisma · Redis ([Upstash](https://upstash.com)) · [`@simplewebauthn`](https://simplewebauthn.dev) · Argon2 · Vitest · Playwright (with Chrome's CDP virtual authenticator) · GitHub Actions · Vercel

---

## Running it locally

```bash
git clone https://github.com/nishant26n/passkeyforge.git
cd passkeyforge
npm install
```

Create `.env` in the project root:

```bash
DATABASE_URL="postgresql://user:password@host/db?sslmode=require"

# Optional in development — app/lib/webauthn/config.ts falls back to
# localhost / http://localhost:3000 automatically when NODE_ENV isn't
# "production". Only required for a production deployment.
WEBAUTHN_RP_ID="yourdomain.com"
WEBAUTHN_ORIGIN="https://yourdomain.com"

UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

`DATABASE_URL` and the two `UPSTASH_*` variables are required even in development — there's no local fallback for Postgres or Redis. A free [Neon](https://neon.tech) project and a free [Upstash](https://upstash.com) Redis instance both cover this comfortably.

```bash
npx prisma migrate deploy   # apply the schema
npx prisma generate         # generate the Prisma client
npm run db:seed             # optional — creates the demo account locally too
npm run dev                 # http://localhost:3000
```

WebAuthn requires a secure context. `localhost` is exempt from the HTTPS requirement, so plain `http://localhost:3000` works for passkeys in development — a LAN IP or a non-localhost hostname will not, without HTTPS.

### Testing

```bash
npm run test          # vitest, watch mode
npm run test:run       # vitest, single run
npm run test:coverage  # vitest with coverage (app/lib/** — see note below)
npm run test:e2e       # Playwright, full browser suite
```

Unit tests (`tests/*.test.ts`, Vitest) cover `app/lib/`: session lifecycle, password hashing, recovery codes, rate limiting. Coverage is currently **75% statements/lines, 60% branches, 86% functions** on that layer — scoped there deliberately, since routes/pages are exercised by the Playwright suite instead, which a Vitest coverage report can't see.

End-to-end tests (`tests/e2e/*.spec.ts`, Playwright) drive the real app in headless Chrome, including real WebAuthn ceremonies via [`WebAuthn.addVirtualAuthenticator`](https://chromedevtools.github.io/devtools-protocol/tot/WebAuthn/) — a genuine authenticator implementation inside the browser that generates real key pairs and produces real signatures, verified by the app's normal `verifyRegistrationResponse`/`verifyAuthenticationResponse` calls. Nothing about WebAuthn verification is stubbed for tests. 155 e2e tests as of this writing, including negative paths: replayed challenges, cross-origin assertions, revoked credentials, expired sessions, rotated-token reuse, cross-user authorization.

> If `coverage/lcov-report`/`coverage/coverage-summary.json` disagree with the printed `text` table on Windows, trust the file — the default text reporter has a display bug (backslash paths break its tree grouping) that silently drops some files from the printed table even though their numbers are correctly folded into the totals.

### CI

`.github/workflows/ci.yml` runs on every push to `main`/`dev` and every pull request: lint → typecheck → (unit tests + e2e tests, in parallel, both gated on lint+typecheck passing). The unit and e2e jobs need `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` configured as repository secrets. Deployment isn't part of the workflow — Vercel's own GitHub integration deploys on push to `main` independently.

---

## Project layout

```
app/
  api/                  # the actual auth surface — every route.ts is a REST-ish endpoint
    auth/                 password login/logout/register, TOTP, recovery
    webauthn/             passkey registration + authentication ceremonies
  lib/                  # framework-agnostic logic, unit-tested in isolation
    auth/                 sessions, password hashing, recovery codes
    webauthn/             RP ID / origin config, AAGUID → device name lookup
    rate-limit.ts
  (auth)/               # login, register, recovery, TOTP pages (shared visual shell)
  settings/passkeys/    # TOTP + recovery-code management
  page.tsx              # signed-in home — passkey list lives here
prisma/
  schema.prisma
  migrations/
  seed.ts               # creates/resets the demo account
tests/
  auth/*.test.ts        # Vitest — app/lib unit tests
  e2e/*.spec.ts         # Playwright — full browser + real WebAuthn ceremonies
.github/workflows/ci.yml
```

## License

No license file yet — treat this as source-available portfolio code, not licensed for reuse.
