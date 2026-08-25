"use client";

import { useState } from "react";
import { salaryDueDate } from "@l-shopee/core";
import { Icon } from "../../../Icon";
import { Modal } from "../../../Modal";
import { MonthYearPicker } from "../../../MonthYearPicker";
import { CopyButton } from "../../../products/CopyButton";

/** One advance, as the ledger shows it. The slip key never leaves the API — only whether one exists. */
export interface StaffAdvance {
  id: string;
  /** The day the money was actually handed over, 'YYYY-MM-DD'. */
  givenOn: string;
  amountSatang: number;
  method: string;
  hasSlip: boolean;
  note: string | null;
}

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
  /** Every advance taken out of this month, newest first. */
  advances: StaffAdvance[];
}

export interface StaffBank {
  name: string | null;
  accountNo: string | null;
  accountName: string | null;
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US")}`;
/** Halves as days: 58 → "29", 59 → "29½". */
const days = (halves: number) => {
  const whole = Math.floor(halves / 2);
  return halves % 2 ? `${whole || ""}½` : String(whole);
};

/** The private routes that serve a slip — owner or the person it paid, nobody else. */
const salarySlipUrl = (userId: string, period: string) =>
  `/api/worker/staff/${userId}/salary-slip?period=${period}`;
const advanceSlipUrl = (id: string) => `/api/worker/staff/advances/${id}/slip`;

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-09-05" → "5 Sep 2026". Split, never parsed — a plain Bangkok day cannot be allowed to shift. */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const methodLabel = (method: string | null) =>
  method === "cash" ? "เงินสด" : method === "transfer" ? "โอน" : null;

/**
 * One person's wage for ONE month, as a ledger (owner, 2026-08-25).
 *
 * It used to be one row per month, side by side. The owner asked for "real calculation that include
 * both of salary and advance paid" — which is the difference between a summary and a statement. Now
 * the month is opened out: the salary it earned, every advance that came out of it, and a Total
 * that is simply the column added up.
 *
 *   Salary   5 Sep 2026   ฿500 × 31      ฿15,500   Unpaid
 *   Advance  14 Aug 2026  ค่าเทอมลูก    −฿2,000   Paid · เงินสด
 *   Total                                ฿13,500
 *
 * THE TOTAL IS WHAT IS STILL TO HAND OVER, and it is the owner's call (asked directly, 25 Aug).
 * The alternative was a total of the whole month's wage with the salary row showing the net — both
 * add up, but this one keeps the salary row honest: ฿500 × 31 is right there and equals the amount
 * beside it, so the arithmetic can be checked by eye without knowing what an advance is.
 *
 * The bank account sits under the Total, read-only with a copy button, because that is the moment
 * you need it — you have just read what to pay and are reaching for the banking app. Editing stays
 * in the Pay card (owner's choice): two places to change one field is exactly what was removed from
 * the วันหยุด card, and re-adding it here would repeat the mistake.
 */
export function PaymentsTable({
  userId,
  payments,
  currentYear,
  bank,
}: {
  userId: string;
  payments: StaffPayment[];
  currentYear: number;
  /** Omitted on any page that is not the owner's HRM view — see the note above. */
  bank?: StaffBank;
}) {
  // Which slip is open in the popup, or null. One at a time, like the order page.
  const [open, setOpen] = useState<{ url: string; title: string; file: string } | null>(null);
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
  const month = payments.find((p) => p.period === showMonth) ?? null;

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

  const bankBlock = bank && (bank.name || bank.accountNo || bank.accountName) && (
    /* Under the Total, because that is the order you do it in: read what to pay, then pay it. */
    <div
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "baseline",
      }}
    >
      <span className="muted" style={{ fontSize: 13 }}>
        Pay into
      </span>
      <span style={{ fontSize: 14 }}>
        {[bank.name, bank.accountName].filter(Boolean).join(" · ")}
      </span>
      {bank.accountNo && (
        /* Shown in full and never masked: a masked number cannot be paid into, which is the only
           reason this field exists. The copy button is here because reading ten digits off a screen
           is where transfers go wrong. */
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 14,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {bank.accountNo}
          <CopyButton value={bank.accountNo} label="account number" />
        </span>
      )}
    </div>
  );

  // A month with nothing against it is the normal case once any month can be picked, so it says so
  // rather than drawing an empty table — and it names the month, so it reads as an answer rather
  // than as something being broken.
  if (!month) {
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

  const due = salaryDueDate(month.period);
  const paidPill = (paid: boolean) => (
    <span className="role-pill" style={{ color: paid ? "var(--ok)" : "var(--warn)" }}>
      {paid ? "Paid" : "Unpaid"}
    </span>
  );

  /**
   * The method, and the slip when there is one. The popup title and the download name are separate
   * strings on purpose: the title is read by a person and the filename is read by a filesystem, and
   * deriving one from the other gave a popup headed "ADVANCE 20 AUG 2026".
   */
  const slipCell = (
    method: string | null,
    slip: { url: string; title: string; file: string } | null,
  ) => (
    <span
      style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}
    >
      {/* THE SLIP SPEAKS FOR ITSELF (owner, 2026-08-25: "remove โอน, the icon action enough"). A
          slip only ever exists for a transfer, so printing the word beside it said the same thing
          twice. The word is still shown when there is NO slip — a cash payment has no icon to carry
          it, and neither does a transfer whose image has passed its three months and been swept, and
          "how was this paid" is a real question in both cases. */}
      {slip ? (
        // Behaves exactly like the order Documents row (owner, 2026-08-04): View opens the slip in
        // the shared popup — it never leaves the page — and Save downloads it.
        <>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen(slip)}
            aria-label={`ดูสลิป ${slip.title}`}
            title="View"
          >
            <Icon name="view" />
          </button>
          <a
            className="icon-btn"
            href={slip.url}
            download={slip.file}
            aria-label={`บันทึกสลิป ${slip.title}`}
            title="Save"
          >
            <Icon name="save" />
          </a>
        </>
      ) : (
        (methodLabel(method) ?? <span className="faint">—</span>)
      )}
    </span>
  );

  return (
    <>
      {header}

      <div className="products-scroll">
        <table className="products-table">
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: "right" }}>Day rate</th>
              <th style={{ textAlign: "right" }}>Working days</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th style={{ textAlign: "right" }}>Status</th>
              <th style={{ textAlign: "right" }}>Paid by</th>
            </tr>
          </thead>
          <tbody>
            {/* THE SALARY — always the 5th of the following month (owner, 25 Aug). A rule, not a
                record: the row reads 5 Sep whether the money moved on the 5th, the 8th, or not yet.
                Day rate × working days equals the amount beside them, so the month can be checked
                by eye. */}
            <tr>
              <td>
                {due ? dayLabel(due) : "—"}
                <span className="muted" style={{ display: "block", fontSize: 12 }}>
                  Salary · {monthLabel(month.period)}
                </span>
              </td>
              <td className="num">{baht(month.dayRateSatang)}</td>
              <td className="num">{days(month.workingHalves)}</td>
              <td className="num">{baht(month.earnedSatang)}</td>
              <td style={{ textAlign: "right" }}>{paidPill(month.paidAt !== null)}</td>
              <td style={{ textAlign: "right" }}>
                {month.paidAt === null ? (
                  <span className="faint">—</span>
                ) : (
                  slipCell(
                    month.method,
                    month.hasSlip
                      ? {
                          url: salarySlipUrl(userId, month.period),
                          title: `เงินเดือน · ${monthLabel(month.period)}`,
                          file: `wage-slip-${month.period}.jpg`,
                        }
                      : null,
                  )
                )}
              </td>
            </tr>

            {/* EVERY ADVANCE that came out of this month, each its own payment with its own date,
                status and slip. The note takes the two columns the salary row uses for its working —
                an advance has no day rate and no working days, and leaving them blank read as
                missing data rather than as not applicable. */}
            {month.advances.map((a) => (
              <tr key={a.id}>
                <td>
                  {dayLabel(a.givenOn)}
                  <span className="muted" style={{ display: "block", fontSize: 12 }}>
                    เบิกล่วงหน้า
                  </span>
                </td>
                <td colSpan={2} className="muted" style={{ fontSize: 13, textAlign: "center" }}>
                  {a.note || <span className="faint">—</span>}
                </td>
                <td className="num">−{baht(a.amountSatang)}</td>
                <td style={{ textAlign: "right" }}>{paidPill(true)}</td>
                <td style={{ textAlign: "right" }}>
                  {slipCell(
                    a.method,
                    a.hasSlip
                      ? {
                          url: advanceSlipUrl(a.id),
                          title: `เบิกล่วงหน้า · ${dayLabel(a.givenOn)}`,
                          file: `advance-slip-${a.givenOn}.jpg`,
                        }
                      : null,
                  )}
                </td>
              </tr>
            ))}

            {/* The column, added up. Nothing clever: Salary − advances is what is still to hand
                over on the 5th, which is the number you came to this table for. */}
            <tr>
              <td colSpan={3} style={{ fontWeight: 700 }}>
                Total
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                {baht(month.dueSatang)}
                {/* Over-advanced: the month pays ฿0 and the excess is owed back. Red, because it is
                    the one figure on this table that means money is missing (owner's rule —
                    allowed, shown, never carried forward automatically). */}
                {month.owedSatang > 0 && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      color: "var(--danger)",
                      fontWeight: 600,
                    }}
                  >
                    ค้าง {baht(month.owedSatang)}
                  </span>
                )}
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {bankBlock}

      {open && (
        <Modal title={`สลิป${open.title}`} onClose={() => setOpen(null)}>
          <img
            src={open.url}
            alt={`สลิป ${open.title}`}
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </Modal>
      )}
    </>
  );
}
