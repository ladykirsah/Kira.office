"use client";

import { inputS } from "@/lib/inputStyles";
import { useT } from "./LangProvider";
import type { Phrase } from "@/lib/lang";

const fieldCol = { display: "flex", flexDirection: "column", gap: 4 } as const;
const fieldLabel = { fontSize: 12, color: "var(--text-muted)" } as const;

/**
 * Shared "date pattern": a date box + a time box for one window bound. The time box is DISABLED until
 * a date is chosen — so you can't leave a time with no date (which would silently drop the bound). The
 * time VALUE is preserved when the date is cleared (only greyed), so re-picking a date keeps the time.
 *
 * Combine on save with dateTimeToMs(date, time); seed from an epoch with msToDateInput / msToTimeInput
 * (all in @/lib/dateTime).
 */
export function DateTimeField({
  label,
  base,
  date,
  time,
  onDate,
  onTime,
}: {
  label: string;
  /**
   * Name of the bound this field sets, in both languages ("Start" → "Start date" / "Start time").
   * A PHRASE rather than a string: the two halves are glued together here, so a Thai name with an
   * English "date" stapled on would read as neither language. Keep unique per field on a page.
   */
  base: Phrase;
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  const t = useT();
  return (
    <div style={fieldCol}>
      <span style={fieldLabel}>{label}</span>
      <span style={{ display: "flex", gap: 6 }}>
        <input
          type="date"
          aria-label={`${t(base)}${t({ th: " วันที่", en: " date" })}`}
          value={date}
          onChange={(e) => onDate(e.target.value)}
          style={inputS}
        />
        <input
          type="time"
          aria-label={`${t(base)}${t({ th: " เวลา", en: " time" })}`}
          value={time}
          disabled={!date}
          title={date ? undefined : t({ th: "เลือกวันที่ก่อน", en: "Pick a date first" })}
          onChange={(e) => onTime(e.target.value)}
          style={{ ...inputS, opacity: date ? 1 : 0.55 }}
        />
      </span>
    </div>
  );
}
