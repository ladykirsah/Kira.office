/**
 * The line the dashboard shows when the Shopee worklist can't be loaded.
 *
 * The owner asked for the real problem, not a shrug (2026-08-03): a 404 should say 404, so a broken
 * API is recognisable as a broken API. The alternative — treating a failed fetch as an empty list —
 * would print "No updates." and quietly claim the Shopee stock is in sync when nobody actually
 * checked. Only when the thrown value carries no usable message do we fall back to a generic line.
 */
/**
 * What a fetch throws when the host simply isn't there. The wording is the runtime's, not ours
 * ("fetch failed" on the Worker/Node side, "Failed to fetch" in a browser), and on its own it names
 * no subject — so we say what couldn't be reached and keep the reason in brackets.
 */
const NETWORK_FAILURES = new Set(["fetch failed", "failed to fetch", "network error"]);

export function shopeeWorklistErrorText(thrown: unknown): string {
  const message = thrown instanceof Error ? thrown.message.trim() : "";
  if (!message) return "Something went wrong.";
  if (NETWORK_FAILURES.has(message.toLowerCase()))
    return `Couldn't reach the stock API (${message})`;
  return message;
}
