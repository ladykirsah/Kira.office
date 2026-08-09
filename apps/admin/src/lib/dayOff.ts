/**
 * How a day off's date reads on screen.
 *
 * Days off are stored as a plain "YYYY-MM-DD" Bangkok day, not a timestamp — deliberately, so a
 * date can never shift under a timezone. That means formatting must NOT go through `new Date(iso)`,
 * which parses a date-only string as UTC and, rendered in a browser west of Greenwich, would show
 * the day before. These read the parts directly instead.
 */

const MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];

const MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

/** Buddhist era — what every date on a Thai bill is written in. */
const toBE = (ce: number) => ce + 543;

/** "2026-08-14" → "14 ส.ค. 69". An em dash for anything unparseable, never partial debris. */
export function thaiShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "—";
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "—";
  return `${day} ${MONTHS_SHORT[month - 1]} ${String(toBE(Number(m[1])) % 100).padStart(2, "0")}`;
}

/** "2026-08" → "สิงหาคม 2569", for the heading above a month's list. */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  if (!m) return "—";
  const n = Number(m[2]);
  if (n < 1 || n > 12) return "—";
  return `${MONTHS_FULL[n - 1]} ${toBE(Number(m[1]))}`;
}
