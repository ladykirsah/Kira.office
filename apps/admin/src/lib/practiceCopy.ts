import { isLocalHost } from "./devApiMismatch";

/**
 * Says out loud which copy of the shop this is.
 *
 * WHY (2026-08-24): the owner could not sign in and concluded their password was wrong. It was
 * not. They were on a LOCAL practice copy, which carries its own database and its own staff rows;
 * the password they typed belonged to production. Four working copies existed on the machine at
 * that point, each with a separate database and a different password for the SAME email address,
 * behind an identical-looking login screen.
 *
 * This is a different question from `describeApiMismatch`, which asks "is this setup broken". A
 * practice copy is not broken — it is working exactly as intended, on data that is not real. The
 * failure mode is not an error, it is a confident wrong belief, so the answer has to be on screen
 * before anything goes wrong rather than after.
 *
 * Deliberately keyed on the PAGE's hostname alone: whatever it talks to, a page served from this
 * machine is never the real shop. Returns null on an empty hostname — a banner must never be the
 * thing that breaks the page it wraps.
 */
export function describePracticeCopy(pageHostname: string): string | null {
  if (!pageHostname || !isLocalHost(pageHostname)) return null;

  return (
    `PRACTICE COPY — this is not the real shop. It runs on this computer with its own ` +
    `separate database, so its products, orders and staff passwords are its own and do not ` +
    `match the real ones. The real back office is at admin.airplusauto.com.`
  );
}
