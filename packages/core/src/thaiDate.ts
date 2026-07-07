/**
 * Thai legacy-date parsing for the customer-history import. The shop's per-car Excel files write
 * bill dates as "31 มีค 68" (abbreviated Thai month + 2-digit Buddhist year); tolerate dots, full
 * month names, numeric d/m/y and ISO. All dates anchor to Asia/Bangkok midnight.
 */

const THAI_MONTHS: [names: string[], month: number][] = [
  [["มค", "มกราคม"], 1],
  [["กพ", "กุมภาพันธ์"], 2],
  [["มีค", "มีนาคม"], 3],
  [["เมย", "เมษายน"], 4],
  [["พค", "พฤษภาคม"], 5],
  [["มิย", "มิถุนายน"], 6],
  [["กค", "กรกฎาคม"], 7],
  [["สค", "สิงหาคม"], 8],
  [["กย", "กันยายน"], 9],
  [["ตค", "ตุลาคม"], 10],
  [["พย", "พฤศจิกายน"], 11],
  [["ธค", "ธันวาคม"], 12],
];

/** "68" → 2568 BE → 2025 CE; 4-digit ≥ 2400 is BE; anything else is already CE. */
function ceYear(y: number): number {
  if (y < 100) return y + 2500 - 543;
  if (y >= 2400) return y - 543;
  return y;
}

function toMs(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const t = Date.parse(`${year}-${mm}-${dd}T00:00:00+07:00`);
  if (!Number.isFinite(t)) return null;
  // Date.parse ROLLS impossible calendar dates over (Apr 31 → May 1) instead of rejecting them —
  // a transcription typo must become a row error, not a silently shifted date. Round-trip check:
  // shift by +07:00 so the UTC getters read Bangkok wall-clock, and demand the same y/m/d back.
  const rt = new Date(t + 7 * 3600 * 1000);
  if (rt.getUTCFullYear() !== year || rt.getUTCMonth() + 1 !== month || rt.getUTCDate() !== day) {
    return null;
  }
  return t;
}

export function parseThaiDateMs(s: string): number | null {
  const str = (s ?? "").trim();
  if (!str) return null;

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(str);
  if (m) return toMs(ceYear(Number(m[1])), Number(m[2]), Number(m[3]));

  // "31 มีค 68" / "31 มี.ค. 68" / "9 พฤษภาคม 2565" — full Thai block for the month token
  // (the consonant range ก-ฮ misses vowels like ี and เ).
  m = /^(\d{1,2})\s*([฀-๿.]+)\s*(\d{2,4})$/.exec(str);
  if (m) {
    const token = m[2]!.replace(/\./g, "");
    const month = THAI_MONTHS.find(([names]) => names.includes(token))?.[1];
    if (month == null) return null;
    return toMs(ceYear(Number(m[3])), month, Number(m[1]));
  }

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(str);
  if (m) return toMs(ceYear(Number(m[3])), Number(m[2]), Number(m[1]));

  return null;
}
