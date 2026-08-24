/**
 * The month and year behind the two dropdowns that replaced `<input type="month">`.
 *
 * WHY IT WAS REPLACED (owner, 2026-08-24): "the time setting is un-clickable". The native control is
 * one field with two invisible halves, its calendar button is a few pixels wide, and it renders
 * however the browser likes — on this machine "August 2026", in English and the western year,
 * directly beside a heading reading สิงหาคม 2569. Two plain dropdowns are obviously clickable, and
 * they can say what the rest of the shop says.
 *
 * พ.ศ. IS A DISPLAY CONCERN ONLY. Everything stored, passed in a URL or sent to the API stays
 * "YYYY-MM" in the western calendar. 2569 must never reach the database — a year that is 543 out
 * would be silent and total.
 */

export type DateLang = "th" | "en";

const TH = [
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

const EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-08" → { year: 2026, month: 8 }. Null for anything malformed — never a half-read date. */
export function splitPeriod(p: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(p ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

/** { 2026, 8 } → "2026-08". Zero-padded, western year, the shape every caller already expects. */
export function joinPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthNames(lang: DateLang): string[] {
  return lang === "th" ? TH : EN;
}

/** Buddhist era for Thai, unchanged for English. Display only — see the note at the top. */
export function displayYear(year: number, lang: DateLang): string {
  return String(lang === "th" ? year + 543 : year);
}

/**
 * The years the dropdown offers: four back and one ahead, newest first.
 *
 * Back far enough to correct or read an old month, one ahead because a December advance can be taken
 * against January. Not a century of scrolling — a shop that opened this year has no use for 1990.
 */
export function yearChoices(currentYear: number): number[] {
  return [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
}
