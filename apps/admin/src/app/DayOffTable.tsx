"use client";

import { useState } from "react";
import { LEAVE_MODES, leaveModeLabel, type LeaveHalves } from "@l-shopee/core";
import { thaiShortDate } from "@/lib/dayOff";
import { inputS } from "@/lib/inputStyles";
import { Icon } from "./Icon";
import { useT } from "./LangProvider";

/**
 * The day-off list, edited in place (owner, 5 Aug 2026).
 *
 * One component for both screens — the staff member's own list on /me and the owner's team list
 * under Staff — because teaching one editing habit on one page and a different one on the other
 * would make whichever you learned second feel broken. The two differ only in what they're allowed
 * to do: `canDelete` is the owner's, `showWho` adds the person's name.
 *
 * Editing happens in the row rather than in a form above it, so the number you are changing never
 * leaves the screen while you change it.
 */

export interface DayOffRow {
  id: string;
  day: string;
  halves: number;
  reason: string | null;
  /** Team view only. */
  name?: string;
  nameTh?: string | null;
  role?: string;
}

export interface DayOffEdit {
  day: string;
  halves: LeaveHalves;
  reason: string;
}

/** Weighted by what the mode COSTS, so a glance down the column shows how much of the month went. */
function ModePill({ halves }: { halves: number }) {
  const style =
    halves === 2
      ? { background: "var(--primary-soft)", color: "var(--primary)" }
      : halves === 1
        ? { background: "var(--code-bg)", color: "var(--text-muted)" }
        : { border: "1px solid var(--border)", color: "var(--text-muted)" };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 12,
        fontWeight: 600,
        padding: "2px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {leaveModeLabel(halves as LeaveHalves)}
    </span>
  );
}

export function DayOffTable({
  rows,
  showWho = false,
  canDelete = false,
  busy,
  onSave,
  onDelete,
}: {
  rows: readonly DayOffRow[];
  showWho?: boolean;
  canDelete?: boolean;
  /** Id of the row currently being written, so its buttons can say so and not be pressed twice. */
  busy?: string | null;
  onSave: (row: DayOffRow, next: DayOffEdit) => void | Promise<void>;
  onDelete?: (row: DayOffRow) => void | Promise<void>;
}) {
  // Only ever one row open: two would put two unsaved versions on screen with no way to tell which
  // one the reader should believe.
  const t = useT();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<DayOffEdit>({ day: "", halves: 2, reason: "" });

  function open(row: DayOffRow) {
    setEditing(row.id);
    setDraft({ day: row.day, halves: row.halves as LeaveHalves, reason: row.reason ?? "" });
  }

  const cols = showWho ? 5 : 4;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%" }}>
        <thead>
          <tr>
            {showWho && <th>{t({ th: "พนักงาน", en: "Who" })}</th>}
            <th>{t({ th: "วันที่", en: "Date" })}</th>
            <th>{t({ th: "ลาแบบ", en: "Type" })}</th>
            <th>{t({ th: "เหตุผล", en: "Reason" })}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="muted">
                {t({ th: "ยังไม่มีวันหยุดในเดือนนี้", en: "No days off this month." })}
              </td>
            </tr>
          )}

          {rows.map((row) =>
            editing === row.id ? (
              <tr key={row.id} style={{ background: "var(--primary-faint)" }}>
                {showWho && <td>{row.nameTh || row.name}</td>}
                <td>
                  <input
                    type="date"
                    aria-label={t({ th: "วันที่", en: "Date" })}
                    style={{ ...inputS, width: "100%" }}
                    value={draft.day}
                    onChange={(e) => setDraft({ ...draft, day: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label={t({ th: "ลาแบบ", en: "Type" })}
                    style={{ ...inputS, width: "100%" }}
                    value={draft.halves}
                    onChange={(e) =>
                      setDraft({ ...draft, halves: Number(e.target.value) as LeaveHalves })
                    }
                  >
                    {LEAVE_MODES.map((m) => (
                      <option key={m.halves} value={m.halves}>
                        {m.th}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    aria-label={t({ th: "เหตุผล", en: "Reason" })}
                    placeholder={t({ th: "เหตุผล", en: "Reason" })}
                    style={{ ...inputS, width: "100%" }}
                    value={draft.reason}
                    onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
                  />
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      disabled={!draft.day || busy === row.id}
                      onClick={async () => {
                        await onSave(row, draft);
                        setEditing(null);
                      }}
                    >
                      {busy === row.id
                        ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                        : t({ th: "บันทึก", en: "Save" })}
                    </button>
                    <button type="button" className="btn-sm" onClick={() => setEditing(null)}>
                      {t({ th: "ยกเลิก", en: "Cancel" })}
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={row.id}>
                {showWho && (
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600 }}>{row.nameTh || row.name}</span>
                      <span className="faint" style={{ fontSize: 12 }}>
                        {row.role}
                      </span>
                    </div>
                  </td>
                )}
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{thaiShortDate(row.day)}</td>
                <td>
                  <ModePill halves={row.halves} />
                </td>
                <td>{row.reason || <span className="faint">—</span>}</td>
                <td>
                  {/* Icon buttons, matching the Services table (owner, 2026-08-24) — a hairline,
                      then bare `.icon-btn` glyphs. A row action should look the same wherever it
                      appears, and two Thai words per row was a lot of ink for something you do
                      rarely. The label still exists for screen readers and as the hover title. */}
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 1,
                        alignSelf: "stretch",
                        background: "var(--border)",
                        margin: "0 8px",
                      }}
                    />
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={t({
                        th: `แก้ไขวันหยุด ${thaiShortDate(row.day)}`,
                        en: `Edit the day off on ${thaiShortDate(row.day)}`,
                      })}
                      title={t({ th: "แก้ไข", en: "Edit" })}
                      onClick={() => open(row)}
                    >
                      <Icon name="edit" />
                    </button>
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t({
                          th: `ลบวันหยุด ${thaiShortDate(row.day)}`,
                          en: `Delete the day off on ${thaiShortDate(row.day)}`,
                        })}
                        title={t({ th: "ลบ", en: "Delete" })}
                        disabled={busy === row.id}
                        onClick={() => onDelete(row)}
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
