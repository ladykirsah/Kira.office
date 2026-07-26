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
