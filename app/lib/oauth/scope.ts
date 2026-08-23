export const ALLOWED_SCOPES = ["openid", "profile", "email"] as const;

export type OAuthScope = (typeof ALLOWED_SCOPES)[number];

const ALLOWED_SCOPE_SET = new Set<string>(ALLOWED_SCOPES);

/** Splits a space-delimited scope string into its individual scope tokens. */
export function parseScope(scope: string | null | undefined): string[] {
  if (!scope) return [];
  return scope.split(/\s+/).filter(Boolean);
}

/** Rejects any scope string containing a token outside ALLOWED_SCOPES. */
export function isValidScope(scope: string | null | undefined): boolean {
  return parseScope(scope).every((token) => ALLOWED_SCOPE_SET.has(token));
}

/** Whether a granted scope string includes the given scope. */
export function hasScope(
  grantedScope: string | null | undefined,
  required: OAuthScope,
): boolean {
  return parseScope(grantedScope).includes(required);
}
