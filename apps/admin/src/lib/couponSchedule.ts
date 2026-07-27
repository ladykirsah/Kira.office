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

/**
 * A coupon is expired once its end bound has passed (inclusive, matching validateCoupon's
 * `now >= endsAt`). No end bound → never expires. Drives the off+disabled Active toggle.
 */
export function isCouponExpired(endsAt: number | null, now: number): boolean {
  return endsAt != null && now >= endsAt;
}
