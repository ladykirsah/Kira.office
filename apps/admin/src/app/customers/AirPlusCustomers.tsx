"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "../PageHeader";
import { BackLink } from "../BackLink";
import { TableFrame } from "../TableFrame";
import {
  searchStorefrontCustomers,
  getStorefrontCustomerDetail,
  setStorefrontMarketingConsent,
  anonymizeStorefrontCustomer,
  recalcAllCustomerCredit,
  type StorefrontCustomerListItem,
  type StorefrontCustomerDetail,
} from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { inputS } from "@/lib/inputStyles";
import { tableText } from "@/lib/tableText";
import { useToast } from "../ToastProvider";
import { useT, useLang } from "../LangProvider";
import type { Lang } from "@/lib/lang";

const frame = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 18,
  background: "var(--surface)",
} as const;

/**
 * Dates follow the reader, like every other word on the page. A Thai reader gets 2569, the Buddhist
 * year they expect; an English reader gets 2026, because 2569 is simply the wrong number to them.
 */
const date = (ms: number | null | undefined, lang: Lang) =>
  ms ? new Date(ms).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB") : "—";
const dateTime = (ms: number | null | undefined, lang: Lang) =>
  ms ? new Date(ms).toLocaleString(lang === "th" ? "th-TH" : "en-GB") : "—";

/** The typed phrase that arms erasure — a click alone must never be enough for an irreversible act. */
const ERASE_CONFIRM = "ERASE";

function ConsentPill({ at, label }: { at: number | null; label: string }) {
  const t = useT();
  const lang = useLang();
  const given = at != null;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        border: "1px solid var(--border)",
        background: given ? "color-mix(in srgb, var(--ok) 16%, transparent)" : "transparent",
        color: given ? "var(--ok)" : "var(--text-muted)",
      }}
      title={
        given
          ? `${label}: ${dateTime(at, lang)}`
          : `${label}: ${t({ th: "ไม่มีบันทึก", en: "no record" })}`
      }
    >
      {label} {given ? `· ${date(at, lang)}` : "· —"}
    </span>
  );
}

function Detail({
  id,
  onBack,
  onChanged,
}: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const [data, setData] = useState<StorefrontCustomerDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [eraseText, setEraseText] = useState("");

  const load = useCallback(() => {
    getStorefrontCustomerDetail(id)
      .then(setData)
      .catch((e: unknown) =>
        toast(
          e instanceof Error ? e.message : t({ th: "โหลดข้อมูลไม่สำเร็จ", en: "Load failed" }),
          "error",
        ),
      );
  }, [id, toast, t]);
  useEffect(load, [load]);

  const c = data?.customer;
  const erased = c?.anonymizedAt != null;

  async function toggleMarketing(next: boolean) {
    setBusy(true);
    try {
      await setStorefrontMarketingConsent(id, next);
      toast(
        next
          ? t({ th: "บันทึกการยินยอมรับข่าวสารแล้ว", en: "Marketing consent recorded" })
          : t({ th: "ถอนการยินยอมรับข่าวสารแล้ว", en: "Marketing consent withdrawn" }),
        "success",
      );
      load();
      onChanged();
    } catch (e: unknown) {
      toast(
        e instanceof Error ? e.message : t({ th: "บันทึกไม่สำเร็จ", en: "Save failed" }),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  async function erase() {
    setBusy(true);
    try {
      await anonymizeStorefrontCustomer(id);
      toast(
        t({
          th: "ลบข้อมูลลูกค้าแล้ว — คำสั่งซื้อยังอยู่",
          en: "Customer data erased — their orders were kept",
        }),
        "success",
      );
      setEraseText("");
      load();
      onChanged();
    } catch (e: unknown) {
      toast(
        e instanceof Error ? e.message : t({ th: "ลบข้อมูลไม่สำเร็จ", en: "Erase failed" }),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!data || !c) {
    return (
      <main>
        <BackLink onClick={onBack}>
          {t({ th: "ลูกค้า AirPlus ทั้งหมด", en: "All AirPlus customers" })}
        </BackLink>
        <div className="muted" style={{ padding: 24 }}>
          {t({ th: "กำลังโหลด…", en: "Loading…" })}
        </div>
      </main>
    );
  }

  return (
    <main>
      <PageHeader
        title={c.name || t({ th: "(ยังไม่มีชื่อ)", en: "(no name yet)" })}
        subtitle={c.phone}
        below={
          <BackLink onClick={onBack}>
            {t({ th: "ลูกค้า AirPlus ทั้งหมด", en: "All AirPlus customers" })}
          </BackLink>
        }
      />

      <div style={{ ...frame, marginBottom: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          <Field
            label={t({ th: "รหัสผู้ใช้", en: "User ID" })}
            value={c.customerCode ?? "—"}
            mono
          />
          <Field
            label={t({ th: "สมัครเมื่อ", en: "Account created" })}
            value={dateTime(c.createdAt, lang)}
          />
          <Field
            label={t({ th: "เข้าใช้งานล่าสุด", en: "Last login" })}
            value={dateTime(c.lastLoginAt, lang)}
          />
          <Field
            label={t({ th: "ยืนยันเบอร์แล้ว", en: "Phone verified" })}
            value={date(c.phoneVerifiedAt, lang)}
          />
          <Field label={t({ th: "อีเมล", en: "Email" })} value={c.email ?? "—"} />
          <Field label="LINE" value={c.lineLinked ? t({ th: "เชื่อมแล้ว", en: "Linked" }) : "—"} />
          <Field label={t({ th: "สถานะ", en: "Status" })} value={c.status} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <ConsentPill
            at={c.pdpaConsentAt}
            label={t({ th: "ความเป็นส่วนตัว + เงื่อนไข", en: "Privacy + terms" })}
          />
          <ConsentPill at={c.marketingConsentAt} label={t({ th: "รับข่าวสาร", en: "Marketing" })} />
        </div>
      </div>

      {!erased && (
        <div style={{ ...frame, marginBottom: 16 }}>
          <strong style={tableText.body2}>
            {t({ th: "การยินยอมรับข่าวสาร", en: "Marketing consent" })}
          </strong>
          <p className="muted" style={{ margin: "6px 0 12px", fontSize: 13 }}>
            {t({
              th: "การส่ง LINE / SMS / อีเมลโปรโมชัน ต้องขอความยินยอมแยกต่างหากจากนโยบายความเป็นส่วนตัวที่เขากดตอนสมัคร · บันทึกตรงนี้เฉพาะเมื่อลูกค้ายินยอมจริง — หน้าร้านยังไม่ได้ถาม",
              en: "Promotional LINE / SMS / email needs its own opt-in, separate from the privacy notice they accepted at sign-up. Only record it here if the customer actually agreed — the storefront does not ask for it yet.",
            })}
          </p>
          <button
            type="button"
            className="btn-soft btn-sm"
            disabled={busy}
            onClick={() => toggleMarketing(c.marketingConsentAt == null)}
          >
            {c.marketingConsentAt == null
              ? t({ th: "บันทึกว่ายินยอม", en: "Record opt-in" })
              : t({ th: "ถอนการยินยอม", en: "Withdraw consent" })}
          </button>
        </div>
      )}

      <h3 style={{ margin: "20px 0 10px" }}>
        {t({ th: "ประวัติการใช้บริการ", en: "Purchase history" })}
      </h3>
      <TableFrame>
        {data.orders.length === 0 ? (
          <div className="muted" style={{ padding: 12 }}>
            {t({ th: "ยังไม่มีคำสั่งซื้อบน AirPlus", en: "No AirPlus orders yet." })}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t({ th: "วันที่", en: "Date" })}</th>
                <th>{t({ th: "คำสั่งซื้อ", en: "Order" })}</th>
                <th>{t({ th: "สถานะ", en: "Status" })}</th>
                <th>{t({ th: "การชำระเงิน", en: "Payment" })}</th>
                <th style={{ textAlign: "right" }}>{t({ th: "รวม", en: "Total" })}</th>
                <th>{t({ th: "เลขพัสดุ", en: "Tracking" })}</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{date(o.orderCreatedAt, lang)}</td>
                  <td style={{ fontFamily: "var(--font-mono, monospace)" }}>{o.externalOrderId}</td>
                  <td>{o.orderStatus ?? "—"}</td>
                  <td>{o.paymentStatus ?? "—"}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {formatBahtTrim(o.grandTotalSatang)}
                  </td>
                  <td>{o.trackingNo ? `${o.carrier ?? ""} ${o.trackingNo}`.trim() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableFrame>

      <h3 style={{ margin: "24px 0 10px" }}>{t({ th: "ลบข้อมูลตาม PDPA", en: "PDPA erasure" })}</h3>
      <div style={{ ...frame, borderColor: erased ? "var(--border)" : "var(--danger)" }}>
        {erased ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {t({
              th: `ลบข้อมูลเมื่อ ${dateTime(c.anonymizedAt, lang)} · คำสั่งซื้อยังอยู่ — กฎหมายกำหนดให้เก็บหลักฐานภาษีไว้`,
              en: `Erased on ${dateTime(c.anonymizedAt, lang)}. Their orders were kept — the law requires us to retain tax records.`,
            })}
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
              {t({
                th: "ใช้ตอนลูกค้าขอให้ลบข้อมูล — ล้างชื่อ เบอร์โทร อีเมล และการเชื่อม LINE แล้วปิดบัญชี · คำสั่งซื้อยังอยู่ เพราะกฎหมายกำหนดให้เก็บหลักฐานภาษี (นโยบายความเป็นส่วนตัว ข้อ 5) ",
                en: "Honours a “delete my data” request: blanks their name, phone, email and LINE link, and closes the account. Their orders stay, because tax records must be retained (Privacy Notice §5). ",
              })}
              <strong>{t({ th: "ทำแล้วย้อนกลับไม่ได้", en: "This cannot be undone." })}</strong>
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                style={{ ...inputS, width: 200 }}
                placeholder={t({
                  th: `พิมพ์ ${ERASE_CONFIRM} เพื่อยืนยัน`,
                  en: `Type ${ERASE_CONFIRM} to confirm`,
                })}
                value={eraseText}
                onChange={(e) => setEraseText(e.target.value)}
                aria-label={t({
                  th: `พิมพ์ ${ERASE_CONFIRM} เพื่อยืนยันการลบข้อมูล`,
                  en: `Type ${ERASE_CONFIRM} to confirm erasure`,
                })}
              />
              <button
                type="button"
                className="btn-soft btn-sm"
                disabled={busy || eraseText !== ERASE_CONFIRM}
                onClick={erase}
              >
                {t({ th: "ลบข้อมูลลูกค้า", en: "Erase customer data" })}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={tableText.subtitle}>{label}</div>
      <div
        style={
          mono ? { ...tableText.body2, fontFamily: "var(--font-mono, monospace)" } : tableText.body2
        }
      >
        {value}
      </div>
    </div>
  );
}

/** Written once: the `th` reads them wide, every `td` carries the matching one as `data-label`,
 *  which the phone prints beside the value once the table becomes cards. They cannot drift. */
const ACCOUNT_COLUMN = {
  userId: { th: "รหัสผู้ใช้", en: "User ID" },
  customer: { th: "ลูกค้า", en: "Customer" },
  signedUp: { th: "สมัครเมื่อ", en: "Signed up" },
  consent: { th: "การยินยอม", en: "Consent" },
  orders: { th: "คำสั่งซื้อ", en: "Orders" },
  spent: { th: "ยอดซื้อรวม", en: "Spent" },
  lastOrder: { th: "ซื้อล่าสุด", en: "Last order" },
};

export function AirPlusCustomers({ tabs }: { tabs: ReactNode }) {
  const toast = useToast();
  const t = useT();
  const lang = useLang();
  const [q, setQ] = useState("");
  const [list, setList] = useState<StorefrontCustomerListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalcing, setRecalcing] = useState(false);

  async function recalcAll() {
    setRecalcing(true);
    try {
      const n = await recalcAllCustomerCredit();
      toast(
        t({
          th: `อัปเดตเครดิตแล้ว ${n} ราย`,
          en: `Credit updated for ${n} customer${n === 1 ? "" : "s"}`,
        }),
        "success",
      );
      load(q);
    } catch (e) {
      toast(
        e instanceof Error
          ? e.message
          : t({ th: "คำนวณเครดิตใหม่ไม่สำเร็จ", en: "Recalculate failed" }),
        "error",
      );
    } finally {
      setRecalcing(false);
    }
  }

  const load = useCallback(
    (term: string) => {
      setLoading(true);
      searchStorefrontCustomers(term)
        .then(setList)
        .catch((e: unknown) =>
          toast(
            e instanceof Error ? e.message : t({ th: "โหลดข้อมูลไม่สำเร็จ", en: "Load failed" }),
            "error",
          ),
        )
        .finally(() => setLoading(false));
    },
    [toast, t],
  );

  // Debounced so typing a phone number doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => load(q), 250);
    return () => clearTimeout(timer);
  }, [q, load]);

  if (selected) {
    return <Detail id={selected} onBack={() => setSelected(null)} onChanged={() => load(q)} />;
  }

  return (
    <main>
      <PageHeader
        title={t({ th: "ลูกค้า AirPlus", en: "AirPlus customers" })}
        subtitle={t({
          th: "บัญชีลูกค้าหน้าร้านออนไลน์ — วันที่สมัคร การยินยอม และสิ่งที่เคยซื้อ",
          en: "Online shop accounts — sign-up date, consent, and what they've bought.",
        })}
      />
      {tabs}
      {/* 14px below the tabs — the same gap Shop info leaves between its switcher and the card. */}
      <div
        style={{
          marginTop: 14,
          marginBottom: 12,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          className="tbar-search"
          style={{ ...inputS, width: 320 }}
          placeholder={t({
            th: "ค้นหารหัสผู้ใช้ ชื่อ เบอร์โทร หรืออีเมล",
            en: "Search User ID, name, phone, or email",
          })}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t({
            th: "ค้นหาลูกค้า AirPlus จากรหัสผู้ใช้ ชื่อ เบอร์โทร หรืออีเมล",
            en: "Search AirPlus customers by User ID, name, phone, or email",
          })}
        />
        {/* One-shot backfill: recompute every customer's credit + tier with the current rules. */}
        <button
          type="button"
          className="btn-soft btn-sm"
          disabled={recalcing}
          onClick={() => void recalcAll()}
          title={t({
            th: "คำนวณเครดิตและระดับของลูกค้าทุกคนใหม่ด้วยกติกาปัจจุบัน",
            en: "Recompute every customer's credit + tier with the current rules",
          })}
        >
          {recalcing
            ? t({ th: "กำลังอัปเดต…", en: "Updating…" })
            : t({ th: "อัปเดตเครดิตทั้งหมด", en: "Update every credit" })}
        </button>
      </div>
      <TableFrame cards>
        {loading ? (
          <div className="muted" style={{ padding: 12 }}>
            {t({ th: "กำลังโหลด…", en: "Loading…" })}
          </div>
        ) : list.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div className="empty-icon">🛒</div>
            {q
              ? t({ th: "ไม่พบลูกค้าที่ตรงกับที่ค้นหา", en: "No matching customers." })
              : t({ th: "ยังไม่มีบัญชีลูกค้า AirPlus", en: "No AirPlus accounts yet." })}
          </div>
        ) : (
          <table className="list-cards">
            <thead>
              <tr>
                <th>{t(ACCOUNT_COLUMN.userId)}</th>
                <th>{t(ACCOUNT_COLUMN.customer)}</th>
                <th>{t(ACCOUNT_COLUMN.signedUp)}</th>
                <th>{t(ACCOUNT_COLUMN.consent)}</th>
                <th>{t(ACCOUNT_COLUMN.orders)}</th>
                <th style={{ textAlign: "right" }}>{t(ACCOUNT_COLUMN.spent)}</th>
                <th>{t(ACCOUNT_COLUMN.lastOrder)}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(c.id)}
                  title={t({ th: "เปิดข้อมูลลูกค้า", en: "Open customer" })}
                >
                  <td
                    data-label={t(ACCOUNT_COLUMN.userId)}
                    style={{ whiteSpace: "nowrap", fontFamily: "var(--font-mono, monospace)" }}
                  >
                    {c.customerCode ?? "—"}
                  </td>
                  {/* Nominated as the card's identity: on a phone this leads, not the account
                      code above it. A card headed "AP-0002" is a worse card than one headed with
                      the person's name (owner's screens, 2026-08-27). */}
                  <td className="list-identity">
                    <div style={tableText.body2}>
                      {c.name || t({ th: "(ยังไม่มีชื่อ)", en: "(no name yet)" })}
                    </div>
                    <div style={tableText.subtitle}>
                      {c.phone}
                      {c.lineLinked ? " · LINE" : ""}
                    </div>
                  </td>
                  <td data-label={t(ACCOUNT_COLUMN.signedUp)} style={{ whiteSpace: "nowrap" }}>
                    {date(c.createdAt, lang)}
                  </td>
                  <td data-label={t(ACCOUNT_COLUMN.consent)} style={{ whiteSpace: "nowrap" }}>
                    <ConsentPill
                      at={c.marketingConsentAt}
                      label={t({ th: "รับข่าวสาร", en: "Marketing" })}
                    />
                  </td>
                  <td data-label={t(ACCOUNT_COLUMN.orders)}>{c.orderCount}</td>
                  <td
                    data-label={t(ACCOUNT_COLUMN.spent)}
                    style={{ textAlign: "right", whiteSpace: "nowrap" }}
                  >
                    {formatBahtTrim(c.spentSatang)}
                  </td>
                  <td data-label={t(ACCOUNT_COLUMN.lastOrder)} style={{ whiteSpace: "nowrap" }}>
                    {date(c.lastOrderAt, lang)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableFrame>
    </main>
  );
}
