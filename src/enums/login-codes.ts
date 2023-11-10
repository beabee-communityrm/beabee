/**
 * Login codes
 * TODO: Move to common
 */
export enum LOGIN_CODES {
  LOCKED = "account-locked",
  LOGGED_IN = "logged-in",
  LOGIN_FAILED = "login-failed",
  REQUIRES_2FA = "requires-2fa",
  UNSUPPORTED_2FA = "unsupported-2fa",
  INVALID_TOKEN = "invalid-token",
  MISSING_TOKEN = "missing-token"
}
