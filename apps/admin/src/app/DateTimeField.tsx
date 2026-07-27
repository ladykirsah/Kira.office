"use client";

import { inputS } from "@/lib/inputStyles";

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
  /** aria-label prefix ("Start" → "Start date" / "Start time"). Keep unique per field on a page. */
  base: string;
  date: string;
  time: string;
  onDate: (v: string) => void;
  onTime: (v: string) => void;
}) {
  return (
    <div style={fieldCol}>
      <span style={fieldLabel}>{label}</span>
      <span style={{ display: "flex", gap: 6 }}>
        <input
          type="date"
          aria-label={`${base} date`}
          value={date}
          onChange={(e) => onDate(e.target.value)}
          style={inputS}
        />
        <input
          type="time"
          aria-label={`${base} time`}
          value={time}
          disabled={!date}
          title={date ? undefined : "Pick a date first"}
          onChange={(e) => onTime(e.target.value)}
          style={{ ...inputS, opacity: date ? 1 : 0.55 }}
        />
      </span>
    </div>
  );
}
