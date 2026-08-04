"use client";

import { useState } from "react";
import { Icon } from "../../../Icon";
import { Modal } from "../../../Modal";

export interface StaffPayment {
  period: string;
  amountSatang: number;
  dayRateSatang: number;
  workingHalves: number;
  offHalves: number;
  /** Null would mean a month still owed. Today the list only holds paid months — see the note
   *  on PaymentsTable — so this is always set; typed honestly for when that changes. */
  paidAt: number | null;
  /** False before a slip exists, and again once the image is swept at three months. */
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
export function PaymentsTable({ userId, payments }: { userId: string; payments: StaffPayment[] }) {
  // Which month's slip is open in the popup, or null. One at a time, like the order page.
  const [open, setOpen] = useState<string | null>(null);

  if (payments.length === 0) {
    return (
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        No wages paid yet.
      </p>
    );
  }

  return (
    <>
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
              <th style={{ textAlign: "right" }}>Paid</th>
              <th style={{ textAlign: "right" }}>Slip</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.period}>
                <td style={{ fontWeight: 600 }}>{monthLabel(p.period)}</td>
                <td className="num">{baht(p.dayRateSatang)}</td>
                <td className="num">{p.offHalves ? days(p.offHalves) : "0"}</td>
                <td className="num">{days(p.workingHalves)}</td>
                <td className="num" style={{ fontWeight: 700 }}>
                  {baht(p.amountSatang)}
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
