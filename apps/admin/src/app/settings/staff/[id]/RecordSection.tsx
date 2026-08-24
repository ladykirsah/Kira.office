"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LEAVE_MODES, type LeaveHalves, type PayMethod } from "@l-shopee/core";
import { useToast } from "../../../ToastProvider";
import { FilePickButton } from "../../../FilePickButton";
import { monthLabel } from "@/lib/dayOff";

/**
 * "Record" — the one place you write anything down about a person (owner, 2026-08-24).
 *
 * Built on the car-fitment page's **Add new**, which the owner picked as the working flow: pick
 * what you are recording, fill it in, Save. Three things go in — วันหยุด, เบิกล่วงหน้า and
 * จ่ายเงินเดือน — and it replaces the add form that used to sit *underneath* the วันหยุด table,
 * where you had to scroll past the data to reach the input.
 *
 * WHY MONEY LOOKS DIFFERENT (design B, chosen from three). Car brands and car models are the same
 * kind of thing, so equal tabs are honest there. A day off and a cash advance are not: one is
 * attendance, the other is money leaving the shop. Given no distinction at all they would earn equal
 * weight and equal muscle memory, and a mis-tap would record ฿3,000 instead of a half day. So a
 * divider separates them, the form sits on an amber panel, and the Save button is amber and always
 * ENDS WITH THE AMOUNT — the last thing read before pressing is the number.
 *
 * The tabs themselves are plain coral like any other, and there is no warning line above the form:
 * both were tried and the owner removed them (2026-08-24). The panel and the button are where the
 * colour does work; on the tab row it only made three tabs look like two different controls, and
 * the warning repeated what the panel had already said.
 *
 * The slip rule is the API's (`payoutProblem` in core): cash needs nothing, a transfer needs its
 * slip. This mirrors it for the person filling the form — the field appears, and Save stays
 * disabled — but the refusal that matters happens on the server either way.
 */

type Tab = "off" | "advance" | "salary";

const baht = (satang: number) => `฿${(satang / 100).toLocaleString("en-US")}`;
/** "1,250.50" → 125050. Commas and spaces tolerated, because people type money the way they say it. */
const toSatang = (thb: string): number =>
  Math.round((parseFloat(thb.replace(/[, ]/g, "")) || 0) * 100);

const label: Record<Tab, string> = {
  off: "วันหยุด",
  advance: "เบิกล่วงหน้า",
  salary: "จ่ายเงินเดือน",
};

function Field({
  label: text,
  children,
  wide,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div style={{ display: "grid", minWidth: 0, ...(wide ? { gridColumn: "1 / -1" } : {}) }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>{text}</span>
      {children}
    </div>
  );
}

export function RecordSection({
  userId,
  month,
  dueSatang,
  monthIsPaid,
}: {
  userId: string;
  /** The month the page is showing — what an advance is filed against, and what a wage pays for. */
  month: string;
  /** What this month still comes to after advances, so the จ่ายเงินเดือน tab can state the figure. */
  dueSatang: number;
  /** A paid month takes no more advances and no second payment — see recordAdvance. */
  monthIsPaid: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("off");
  const [busy, setBusy] = useState(false);

  // วันหยุด
  const [day, setDay] = useState("");
  const [halves, setHalves] = useState<LeaveHalves>(2);
  const [reason, setReason] = useState("");

  // shared by both money tabs
  const [method, setMethod] = useState<PayMethod>("cash");
  const [slip, setSlip] = useState<File | null>(null);

  // เบิกล่วงหน้า
  const [givenOn, setGivenOn] = useState("");
  const [amountThb, setAmountThb] = useState("");
  const [note, setNote] = useState("");

  // จ่ายเงินเดือน
  const [paidOn, setPaidOn] = useState("");

  const isMoney = tab !== "off";
  const amountSatang = toSatang(amountThb);
  const slipMissing = method === "transfer" && !slip;

  function resetAll() {
    setDay("");
    setHalves(2);
    setReason("");
    setGivenOn("");
    setAmountThb("");
    setNote("");
    setPaidOn("");
    setMethod("cash");
    setSlip(null);
  }

  async function send(url: string, init: RequestInit, ok: string) {
    setBusy(true);
    try {
      const res = await fetch(url, { credentials: "include", ...init });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(data.error || "ทำรายการไม่สำเร็จ", "error");
        return;
      }
      toast(ok, "success");
      resetAll();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const canSave =
    !busy &&
    (tab === "off"
      ? !!day
      : tab === "advance"
        ? !!givenOn && amountSatang > 0 && !slipMissing && !monthIsPaid
        : !!paidOn && !slipMissing && !monthIsPaid);

  const saveText =
    tab === "off"
      ? "บันทึกวันหยุด"
      : tab === "advance"
        ? `บันทึกการเบิก ${baht(amountSatang)}`
        : `บันทึกการจ่าย ${baht(dueSatang)}`;

  function submit() {
    if (tab === "off") {
      void send(
        `/api/worker/staff/${userId}/day-off`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ day, halves, reason: reason || undefined }),
        },
        "บันทึกวันหยุดแล้ว",
      );
      return;
    }
    if (tab === "advance") {
      // The slip travels as JSON here rather than a raw body, because the advance carries other
      // fields with it. A wage payment has no such fields, so that one keeps the raw-image shape
      // the route already had.
      const post = async () => {
        const slipKey = slip ? await uploadSlip(userId, month, slip) : null;
        if (slip && !slipKey) {
          toast("อัปโหลดสลิปไม่สำเร็จ", "error");
          return;
        }
        await send(
          `/api/worker/staff/${userId}/advances`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              period: month,
              givenOn,
              amountSatang,
              method,
              slipKey,
              note: note || undefined,
            }),
          },
          "บันทึกการเบิกแล้ว",
        );
      };
      setBusy(true);
      void post().finally(() => setBusy(false));
      return;
    }
    // จ่ายเงินเดือน — the slip IS the body for a transfer; cash sends none at all.
    const qs = new URLSearchParams({ period: month, method, paidOn });
    void send(
      `/api/worker/staff/${userId}/salary-paid?${qs}`,
      slip
        ? { method: "POST", headers: { "content-type": slip.type }, body: slip }
        : { method: "POST" },
      "บันทึกการจ่ายแล้ว",
    );
  }

  // Field for field, the same grid Add new uses on the car-fitment page. `.record-fields` gives the
  // controls inside it that page's SMALL size; the admin default is the larger 40px one.
  const fields = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
    gap: 12,
  } as const;

  const methodSwitch = (
    <>
      <Field label="จ่ายด้วย">
        <div className="pay-method">
          {(["cash", "transfer"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={method === m ? "on" : ""}
              onClick={() => {
                setMethod(m);
                if (m === "cash") setSlip(null);
              }}
            >
              {m === "cash" ? "เงินสด" : "โอน"}
            </button>
          ))}
        </div>
      </Field>
      {method === "transfer" && (
        <Field
          label={
            <>
              สลิป <b>(ต้องแนบ)</b>
            </>
          }
        >
          <FilePickButton file={slip} onPick={setSlip} label="สลิปการโอน" />
        </Field>
      )}
    </>
  );

  return (
    <section className="card">
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Record</div>

      <div className="record-tabs">
        {(["off", "advance", "salary"] as const).map((t, i) => (
          <span key={t} style={{ display: "contents" }}>
            {/* The line the owner asked for: time on one side, money on the other. */}
            {i === 1 && <span className="record-rule" aria-hidden />}
            <button
              type="button"
              className={`record-tab${t !== "off" ? " money" : ""}${tab === t ? " on" : ""}`}
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
            >
              {label[t]}
            </button>
          </span>
        ))}
      </div>

      <div className={isMoney ? "record-money" : undefined}>
        {tab === "off" && (
          <div className="record-fields" style={fields}>
            <Field label="วันที่">
              <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label="ลาแบบ">
              <select
                value={halves}
                onChange={(e) => setHalves(Number(e.target.value) as LeaveHalves)}
              >
                {LEAVE_MODES.map((m) => (
                  <option key={m.halves} value={m.halves}>
                    {m.th}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label={
                <>
                  เหตุผล <span className="faint">(ไม่บังคับ)</span>
                </>
              }
            >
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น พาแม่ไปหาหมอ"
              />
            </Field>
          </div>
        )}

        {tab === "advance" && (
          <div className="record-fields" style={fields}>
            <Field label="วันที่">
              <input type="date" value={givenOn} onChange={(e) => setGivenOn(e.target.value)} />
            </Field>
            <Field label="จำนวน (บาท)">
              <input
                inputMode="decimal"
                value={amountThb}
                onChange={(e) => setAmountThb(e.target.value)}
                placeholder="0.00"
              />
            </Field>
            {methodSwitch}
            <Field
              label={
                <>
                  หมายเหตุ <span className="faint">(ไม่บังคับ)</span>
                </>
              }
            >
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น ขอเบิกก่อนเปิดเทอม"
              />
            </Field>
          </div>
        )}

        {tab === "salary" && (
          <div className="record-fields" style={fields}>
            <Field label="เดือนที่จ่าย">
              <input value={monthLabel(month)} readOnly />
            </Field>
            <Field label="วันที่จ่าย">
              <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
            </Field>
            <Field label="ยอดจ่าย">
              <input value={baht(dueSatang)} readOnly />
            </Field>
            {methodSwitch}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <button
          type="button"
          className={isMoney ? "btn-money" : "btn-primary btn-sm"}
          disabled={!canSave}
          onClick={submit}
        >
          {busy ? "กำลังบันทึก…" : saveText}
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12.5, margin: "12px 0 0" }}>
        {tab === "off" ? (
          <>
            เต็มวันและครึ่งวันหักจากวันทำงานของเดือนนั้น ส่วน <b>เข้าสาย ไม่หักเงิน</b>
          </>
        ) : monthIsPaid ? (
          <>
            เดือนนี้จ่ายไปแล้ว — <b>บันทึกเพิ่มไม่ได้</b> เพราะสลิปที่ออกไปแล้วจะไม่ตรงกัน
          </>
        ) : method === "transfer" ? (
          <>
            โอน — <b>ต้องแนบสลิป</b> ถึงจะบันทึกได้
          </>
        ) : (
          <>เงินสด — ไม่ต้องแนบสลิป</>
        )}
      </p>
    </section>
  );
}

/**
 * Put a slip in R2 and hand back its key.
 *
 * Advances need this as a separate step because the record itself is JSON with several fields; the
 * wage payment has none, so that route keeps taking the image as its raw body. Returns null on
 * failure so the caller can refuse to write a record that would claim a slip it does not have.
 */
async function uploadSlip(userId: string, period: string, file: File): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/worker/staff/${userId}/advance-slip?period=${encodeURIComponent(period)}`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": file.type },
        body: file,
      },
    );
    if (!res.ok) return null;
    return ((await res.json()) as { key?: string }).key ?? null;
  } catch {
    return null;
  }
}
