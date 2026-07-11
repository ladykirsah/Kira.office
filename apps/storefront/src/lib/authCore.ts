/**
 * Pure auth primitives (no D1, no cookies — testable in plain vitest).
 * Security posture (pressure-tested before build):
 *  - OTP: 6 digits, 5-min TTL, max 5 verify attempts, single-use, one live code per phone.
 *    Salted SHA-256 is deliberate — key-stretching is theater on a 10^6 space; the caps are
 *    the real control.
 *  - Sessions: 256-bit random token in the cookie; ONLY its SHA-256 lives in D1.
 */

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const OTP_SENDS_PER_WINDOW = 3;
export const OTP_SEND_DAY_MS = 24 * 60 * 60 * 1000;
export const OTP_SENDS_PER_DAY = 10;
export const IP_SEND_WINDOW_MS = 10 * 60 * 1000;
export const IP_SENDS_PER_WINDOW = 10;
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const SESSION_ROLL_AFTER_MS = 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "ap_session";

/** 6-digit code via rejection sampling (no modulo bias). */
export function generateOtpCode(): string {
  const buf = new Uint32Array(1);
  // 4_294_000_000 is the largest multiple of 1_000_000 below 2^32.
  do {
    crypto.getRandomValues(buf);
  } while (buf[0]! >= 4_294_000_000);
  return String(buf[0]! % 1_000_000).padStart(6, "0");
}

/** 256-bit random token as 64 hex chars — the raw cookie value. */
export function randomSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashOtp(code: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${code}`);
}

/** Fixed-window bucketing for the auth_throttle table. */
export function throttleWindowStart(now: number, windowMs: number): number {
  return now - (now % windowMs);
}
