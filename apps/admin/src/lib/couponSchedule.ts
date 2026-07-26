/**
 * Combine a coupon-window date (yyyy-mm-dd from <input type="date">) and time (HH:mm from
 * <input type="time">) into epoch ms in LOCAL time — matching the old datetime-local behaviour.
 * No date → null (no bound). A date with no time defaults to midnight. Unparseable → null.
 */
export function dateTimeToMs(date: string, time: string): number | null {
  const d = date.trim();
  if (!d) return null;
  const t = time.trim() || "00:00";
  const ms = new Date(`${d}T${t}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Epoch ms → "yyyy-mm-dd" (local) to seed a <input type="date">; null → "" (unbounded). */
export function msToDateInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Epoch ms → "HH:mm" (local) to seed a <input type="time">; null → "" (unbounded). */
export function msToTimeInput(ms: number | null): string {
  if (ms == null) return "";
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Apr 2026" (local, locale-independent) for the compact collapsed-row period. */
function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Compact validity period for the collapsed coupon row: Always / From … / Until … / … → …. */
export function compactWindow(startsAt: number | null, endsAt: number | null): string {
  if (startsAt == null && endsAt == null) return "Always";
  if (startsAt != null && endsAt == null) return `From ${shortDate(startsAt)}`;
  if (startsAt == null && endsAt != null) return `Until ${shortDate(endsAt)}`;
  return `${shortDate(startsAt!)} → ${shortDate(endsAt!)}`;
}
