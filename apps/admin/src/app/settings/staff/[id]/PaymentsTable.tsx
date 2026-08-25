"use client";

import { useState } from "react";
import { Icon } from "../../../Icon";
import { Modal } from "../../../Modal";
import { MonthYearPicker } from "../../../MonthYearPicker";

export interface StaffPayment {
  period: string;
  /** What the month's work came to, before anything taken early. */
  earnedSatang: number;
  /** Salary already handed over before payday. Frozen onto the payslip once the month is paid. */
  advanceSatang: number;
  /** earned − advance, floored at zero. What actually changes hands on the 5th. */
  dueSatang: number;
  /** Advance beyond the whole month's wage. Shown in red; never carried forward on its own. */
  owedSatang: number;
  dayRateSatang: number;
  workingHalves: number;
  offHalves: number;
  /** Null for a month not yet paid — the running month is always listed (2026-08-24). */
  paidAt: number | null;
  /** "cash" | "transfer" | null for rows written before the method was recorded. */
  method: string | null;
  /** False before a slip exists, once the image is swept at three months, and for cash. */
  hasSlip: boolean;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US")}`;
/** Halves as days: 58 → "29", 59 → "29½". */
const days = (halves: number) => {
  const whole = Math.floor(halves / 2);
  return halves % 2 ? `${whole || ""}½` : String(whole);
};

/** The private route that serves one month's slip — owner or the person it paid, nobody else. */
const slipUrl = (userId: string, period: string) =>
  `/api/worker/staff/${userId}/salary-slip?period=${period}`;

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One person's wage history, on their own page (owner, 2026-08-04).
 *
 * The Salary tab answers "who do I still owe this month"; this answers "what has this person been
 * paid" — a question about them, so it lives with them. The transfer slip is here rather than on
 * the salary run for the same reason.
 *
 * A month with no slip link is a month whose image has passed its three months and been deleted.
 * That reads as a plain gap on purpose (owner): the payment itself is still on the row, and every
 * payment required a slip to be recorded in the first place.
 */
export function PaymentsTable({
  userId,
  payments,
  currentYear,
}: {
  userId: string;
  payments: StaffPayment[];
  currentYear: number;
}) {
  // Which month's slip is open in the popup, or null. One at a time, like the order page.
  const [open, setOpen] = useState<string | null>(null);
  /**
   * This table's OWN month setting, independent of the วันหยุด card's (owner, 2026-08-24).
   *
   * It FILTERS: pick July and the table shows July. It jumped-and-highlighted for a few hours first
   * — my argument was that a wage history is read by comparing one month against the one before, so
   * hiding the rest takes away the reason you opened it. The owner used it and asked for filtering
   * (25 Aug), which settles it: the question people bring to this table is "what about that month",
   * not "how do the months compare".
   */
  const [showMonth, setShowMonth] = useState<string>(payments[0]?.period ?? "");
  const shown = payments.filter((p) => p.period === showMonth);

  /**
   * Heading and picker on one row, the same shape the วันหยุด card uses (owner, 2026-08-24). The
   * `<h2>` lives here rather than in the page above, because a control that belongs to a table has
   * to be able to sit beside that table's title — it was floating alone over the columns before.
   */
  const header = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 12,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 16 }}>Payments</h2>
      {/* English names and the western year, matching this table's own month headings. The วันหยุด
          card above is Thai and carries its own — each says what its neighbours say rather than
          following one global setting. */}
      <MonthYearPicker
        value={showMonth}
        lang="en"
        label="Month shown"
        currentYear={currentYear}
        onChange={setShowMonth}
      />
    </div>
  );

  // A month with nothing against it is the normal case once any month can be picked, so it says so
  // rather than drawing an empty table — and it names the month, so it reads as an answer rather
  // than as something being broken.
  if (shown.length === 0) {
    return (
      <>
        {header}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {payments.length === 0
            ? "No wages recorded yet."
            : `Nothing recorded for ${showMonth ? monthLabel(showMonth) : "that month"}.`}
        </p>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="products-scroll">
        <table className="products-table">
          <thead>
            {/* The same columns as the Salary run (owner, 2026-08-04) — one person down the page
                instead of one month across it, so a row means the same thing on both screens. */}
            <tr>
              <th>Month</th>
              <th style={{ textAlign: "right" }}>Day rate</th>
              <th style={{ textAlign: "right" }}>Days off</th>
              <th style={{ textAlign: "right" }}>Working days</th>
              <th style={{ textAlign: "right" }}>Salary</th>
              <th style={{ textAlign: "right" }}>Advance</th>
              <th style={{ textAlign: "right" }}>Still due</th>
              <th style={{ textAlign: "right" }}>Paid</th>
              <th style={{ textAlign: "right" }}>Slip</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.period}>
                <td style={{ fontWeight: 600 }}>{monthLabel(p.period)}</td>
                <td className="num">{baht(p.dayRateSatang)}</td>
                <td className="num">{p.offHalves ? days(p.offHalves) : "0"}</td>
                <td className="num">{days(p.workingHalves)}</td>
                <td className="num">{baht(p.earnedSatang)}</td>
                {/* One sum across the row: Salary − Advance = Still due. The advance is signed so
                    it reads as a subtraction rather than as a second amount owed. */}
                <td className="num">
                  {p.advanceSatang ? `−${baht(p.advanceSatang)}` : <span className="faint">—</span>}
                </td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {baht(p.dueSatang)}
                  {/* Over-advanced: the month pays ฿0 and the excess is owed back. Red, because it
                      is the one figure on this table that means money is missing (owner's rule —
                      allowed, shown, never carried forward automatically). */}
                  {p.owedSatang > 0 && (
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: "var(--danger)",
                        fontWeight: 600,
                      }}
                    >
                      ค้าง {baht(p.owedSatang)}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {/* The state, not the date (owner, 2026-08-04) — green for settled, amber for
                      still owed. The date lives on the slip, which is one click away. */}
                  <span
                    className="role-pill"
                    style={{ color: p.paidAt ? "var(--ok)" : "var(--warn)" }}
                  >
                    {p.paidAt ? "Paid" : "Unpaid"}
                  </span>
                  {p.paidAt && p.method && (
                    <span className="faint" style={{ display: "block", fontSize: 12 }}>
                      {p.method === "cash" ? "เงินสด" : "โอน"}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: "right" }}>
                  {p.hasSlip ? (
                    // Behaves exactly like the order Documents row (owner, 2026-08-04): View opens
                    // the slip in the shared popup — it never leaves the page — and Save downloads
                    // it. Same two bare icon buttons, same Modal.
                    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => setOpen(p.period)}
                        aria-label={`View the slip for ${monthLabel(p.period)}`}
                        title="View"
                      >
                        <Icon name="view" />
                      </button>
                      <a
                        className="icon-btn"
                        href={slipUrl(userId, p.period)}
                        download={`wage-slip-${p.period}.jpg`}
                        aria-label={`Save the slip for ${monthLabel(p.period)}`}
                        title="Save"
                      >
                        <Icon name="save" />
                      </a>
                    </span>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal title={`สลิปเงินเดือน · ${monthLabel(open)}`} onClose={() => setOpen(null)}>
          <img
            src={slipUrl(userId, open)}
            alt={`Wage slip for ${monthLabel(open)}`}
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </Modal>
      )}
    </>
  );
}
