"use client";

import { say } from "@/lib/lang";
import {
  splitPeriod,
  joinPeriod,
  monthNames,
  displayYear,
  yearChoices,
  type DateLang,
} from "@/lib/monthYear";

/**
 * Two dropdowns — month, then year — in place of `<input type="month">`.
 *
 * THE COMPLAINT THAT CAUSED IT (owner, 2026-08-24): "the time setting is un-clickable". The native
 * control is one field with two invisible halves you have to know to click, and a calendar button a
 * few pixels wide. It also renders however the browser feels like: on this machine "August 2026",
 * in English and the western year, sitting directly beside a heading that reads สิงหาคม 2569. Two
 * plain selects are obviously clickable, keyboard-reachable, and say what the surrounding page says.
 *
 * `lang` follows the words around it rather than a global setting: the วันหยุด card is Thai, so it
 * gets สิงหาคม / 2569, and the Payments table's own headings are English, so it gets August / 2026.
 * Everything crossing a URL or an API stays "YYYY-MM" in the western calendar — see lib/monthYear.
 */
export function MonthYearPicker({
  value,
  onChange,
  lang,
  label,
  currentYear,
  disabled,
}: {
  /** "YYYY-MM". A malformed value falls back to the current year and January rather than blanking. */
  value: string;
  onChange: (period: string) => void;
  lang: DateLang;
  /** Names the pair for screen readers, e.g. "เดือนของวันหยุด". */
  label: string;
  /** Passed in, not read from a clock, so a render is never a moving target. */
  currentYear: number;
  disabled?: boolean;
}) {
  const parts = splitPeriod(value) ?? { year: currentYear, month: 1 };
  const months = monthNames(lang);
  // The chosen year is always offered, even when it is older than the window — otherwise opening an
  // archived month would silently jump the box to a year nobody picked.
  const years = yearChoices(currentYear);
  const options = years.includes(parts.year) ? years : [...years, parts.year].sort((a, b) => b - a);

  return (
    <span
      role="group"
      aria-label={label}
      style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}
    >
      <select
        aria-label={`${label} — ${say(lang, { th: "เดือน", en: "month" })}`}
        value={parts.month}
        disabled={disabled}
        onChange={(e) => onChange(joinPeriod(parts.year, Number(e.target.value)))}
      >
        {months.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label} — ${say(lang, { th: "ปี", en: "year" })}`}
        value={parts.year}
        disabled={disabled}
        onChange={(e) => onChange(joinPeriod(Number(e.target.value), parts.month))}
      >
        {options.map((y) => (
          <option key={y} value={y}>
            {displayYear(y, lang)}
          </option>
        ))}
      </select>
    </span>
  );
}
