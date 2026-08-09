"use client";

import { useState } from "react";
import { LEAVE_MODES, leaveModeLabel, type LeaveHalves } from "@l-shopee/core";
import { thaiShortDate } from "@/lib/dayOff";
import { inputS } from "@/lib/inputStyles";

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
            {showWho && <th>พนักงาน</th>}
            <th>วันที่</th>
            <th>ลาแบบ</th>
            <th>เหตุผล</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="muted">
                ยังไม่มีวันหยุดในเดือนนี้
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
                    aria-label="วันที่"
                    style={{ ...inputS, width: "100%" }}
                    value={draft.day}
                    onChange={(e) => setDraft({ ...draft, day: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label="ลาแบบ"
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
                    aria-label="เหตุผล"
                    placeholder="เหตุผล"
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
                      {busy === row.id ? "กำลังบันทึก…" : "บันทึก"}
                    </button>
                    <button type="button" className="btn-sm" onClick={() => setEditing(null)}>
                      ยกเลิก
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
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button type="button" className="btn-sm" onClick={() => open(row)}>
                      แก้ไข
                    </button>
                    {canDelete && onDelete && (
                      <button
                        type="button"
                        className="btn-danger btn-sm"
                        disabled={busy === row.id}
                        onClick={() => onDelete(row)}
                      >
                        {busy === row.id ? "…" : "ลบ"}
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
