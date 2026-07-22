/**
 * Retry wrapper for idempotent storage reads (R2 `get`, KV `get`, D1 `SELECT`).
 *
 * WHY THIS EXISTS (2026-07-22): roughly one in eight image requests on the live storefront returned
 * HTTP 500 — visibly broken product photos, category tiles and brand logos. The cause was in the
 * Worker log the whole time:
 *
 *   [api] GET /img/taxonomy/car-brand-….png failed:
 *   Error: get: We encountered an internal error. Please try again. (10001)
 *
 * R2 throws a transient internal error and, in its own message, asks the caller to try again. We
 * never did: the throw reached the top-level boundary, which turned it into a 500.
 *
 * It stayed hidden for months because that boundary CATCHES the error and returns a Response. The
 * Worker never throws, so the dashboard's "Errors" metric — which counts uncaught exceptions —
 * reads 0 while customers see broken images. Never trust that number alone; read the logs.
 *
 * READS ONLY. Do not wrap a write in this. A write that appears to fail may still have been
 * applied, so retrying it can double-apply an order, a payment or a stock movement.
 */

/** Substrings that mark a storage error as worth another attempt. */
const RETRYABLE_PATTERNS = [
  "10001", // R2/KV internal error code
  "internal error",
  "please try again",
  "network connection lost",
  "connection reset",
  "timed out",
  "service unavailable",
];

/**
 * Whether an error looks transient rather than like a bug on our side.
 *
 * Matching on message text is unlovely, but the Workers runtime gives us a plain `Error` with no
 * structured code, so the string is genuinely all there is. The patterns are deliberately narrow:
 * a `TypeError` from our own mistake must fail fast and loudly rather than be retried three times.
 */
export function isRetryableStorageError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return RETRYABLE_PATTERNS.some((p) => msg.includes(p));
}

/** How many total attempts a read gets, including the first. */
const MAX_ATTEMPTS = 3;

/** Backoff before attempts 2 and 3. Short: this is in the path of a user waiting on an image. */
const BACKOFF_MS = [50, 150];

/**
 * Run an idempotent read, retrying only transient storage failures.
 *
 * A `null` result is returned as-is and never retried — for R2 and KV, null means "no such key",
 * which is a real answer, and retrying it would turn every 404 into three round trips.
 */
export async function retryRead<T>(
  read: () => Promise<T>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await read();
    } catch (err) {
      if (!isRetryableStorageError(err)) throw err;
      lastError = err;
      const backoff = BACKOFF_MS[attempt];
      if (backoff !== undefined) await sleep(backoff);
    }
  }
  throw lastError;
}
