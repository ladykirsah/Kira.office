"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  fetchCoupons,
  addCoupon,
  updateCoupon,
  deleteCoupon,
  type CouponWithUsage,
} from "@/lib/api";
import { formatBahtTrim, formatUpdatedAt } from "@/lib/format";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";
import { deleteRefusal, duplicateCodeRefusal } from "@/lib/couponRefusal";
import { ConfirmButton } from "../../ConfirmButton";
import { DateTimeField } from "../../DateTimeField";
import { inputS } from "@/lib/inputStyles";
import { dateTimeToMs, msToDateInput, msToTimeInput, isCouponExpired } from "@/lib/dateTime";

// Card frame shared by the sections (same look as the Service Setup page).
const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
} as const;
const cardLabel = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 12,
} as const;
const fieldCol = { display: "flex", flexDirection: "column", gap: 4 } as const;
const fieldLabel = { fontSize: 12, color: "var(--text-muted)" } as const;
// Small-caps label used inside the expanded coupon detail grid.
const detailLabel = {
  fontSize: 11,
  color: "var(--text-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
} as const;

/** "10%" for percent coupons (value = basis points), "฿50" for fixed ones (value = satang). */
function valueLabel(c: CouponWithUsage): string {
  return c.type === "percent" ? `${c.value / 100}%` : formatBahtTrim(c.value);
}

/** Full local date+time for the detail grid, or "—" when the bound is unset. */
function fullDate(ms: number | null): string {
  return ms != null ? formatUpdatedAt(ms) : "—";
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        flex: "none",
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform .15s",
      }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

/** Edit mode — everything except Code (the customer-facing identity stays fixed). */
function CouponEditor({
  coupon,
  onSaved,
  onCancel,
}: {
  coupon: CouponWithUsage;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const t = useT();
  const [name, setName] = useState(coupon.name ?? "");
  const [type, setType] = useState<"percent" | "fixed">(coupon.type);
  const [value, setValue] = useState(String(coupon.value / 100));
  const [minSubtotal, setMinSubtotal] = useState(
    coupon.minSubtotalSatang > 0 ? String(coupon.minSubtotalSatang / 100) : "",
  );
  const [maxCap, setMaxCap] = useState(
    coupon.maxDiscountSatang != null ? String(coupon.maxDiscountSatang / 100) : "",
  );
  const [startDate, setStartDate] = useState(msToDateInput(coupon.startsAt));
  const [startTime, setStartTime] = useState(msToTimeInput(coupon.startsAt));
  const [endDate, setEndDate] = useState(msToDateInput(coupon.endsAt));
  const [endTime, setEndTime] = useState(msToTimeInput(coupon.endsAt));
  const [maxUses, setMaxUses] = useState(coupon.maxUses != null ? String(coupon.maxUses) : "");
  const [perCustomer, setPerCustomer] = useState(String(coupon.maxUsesPerCustomer));
  const [busy, setBusy] = useState(false);

  const valueNum = Math.round((parseFloat(value) || 0) * 100);
  const canSave = name.trim() !== "" && valueNum > 0 && (type !== "percent" || valueNum <= 10000);

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await updateCoupon(coupon.id, {
        name: name.trim(),
        type,
        value: valueNum,
        minSubtotalSatang: Math.round((parseFloat(minSubtotal) || 0) * 100),
        maxDiscountSatang: maxCap.trim() ? Math.round((parseFloat(maxCap) || 0) * 100) : null,
        startsAt: dateTimeToMs(startDate, startTime),
        endsAt: dateTimeToMs(endDate, endTime),
        maxUses: maxUses.trim() ? Math.max(1, Math.round(parseFloat(maxUses))) : null,
        maxUsesPerCustomer: Math.max(1, Math.round(parseFloat(perCustomer) || 1)),
      });
      toast(t({ th: "แก้ไขคูปองแล้ว", en: "Coupon updated" }), "success");
      onSaved();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={fieldCol}>
          <span style={fieldLabel}>{t({ th: "ชื่อคูปอง", en: "Coupon name" })}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label={t({ th: "แก้ไขชื่อคูปอง", en: "Edit coupon name" })}
            style={{ ...inputS, width: 220 }}
          />
        </div>
        <div style={fieldCol}>
          <span style={fieldLabel}>{t({ th: "โค้ด (แก้ไม่ได้)", en: "Code (locked)" })}</span>
          <span
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontWeight: 600,
              minHeight: 32,
              display: "flex",
              alignItems: "center",
            }}
          >
            {coupon.code}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={fieldCol}>
            <span style={fieldLabel}>{t({ th: "ประเภท", en: "Type" })}</span>
            <select
              aria-label={t({ th: "แก้ไขประเภทคูปอง", en: "Edit coupon type" })}
              value={type}
              onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              style={inputS}
            >
              <option value="percent">{t({ th: "ลดเป็นเปอร์เซ็นต์", en: "Percent off" })}</option>
              <option value="fixed">{t({ th: "ลดเป็นบาท", en: "Baht off" })}</option>
            </select>
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>
              {type === "percent"
                ? t({ th: "ลด (%)", en: "Value (%)" })
                : t({ th: "ลด (฿)", en: "Value (฿)" })}
            </span>
            <input
              type="number"
              min={0}
              max={type === "percent" ? 100 : undefined}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ ...inputS, width: 90 }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={fieldCol}>
            <span style={fieldLabel}>{t({ th: "ยอดขั้นต่ำ (฿)", en: "Min spent (฿)" })}</span>
            <input
              type="number"
              min={0}
              value={minSubtotal}
              onChange={(e) => setMinSubtotal(e.target.value)}
              placeholder="0"
              style={{ ...inputS, width: 110 }}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>{t({ th: "ส่วนลดสูงสุด (฿)", en: "Max cap (฿)" })}</span>
            <input
              type="number"
              min={0}
              value={maxCap}
              onChange={(e) => setMaxCap(e.target.value)}
              placeholder="∞"
              style={{ ...inputS, width: 110 }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={fieldCol}>
          <span style={fieldLabel}>{t({ th: "จำนวนส่วนลด", en: "Quota" })}</span>
          <input
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="∞"
            style={{ ...inputS, width: 74 }}
          />
        </div>
        <div style={fieldCol}>
          <span style={fieldLabel}>{t({ th: "สิทธิ์ต่อคน", en: "Usage for user" })}</span>
          <input
            type="number"
            min={1}
            value={perCustomer}
            onChange={(e) => setPerCustomer(e.target.value)}
            style={{ ...inputS, width: 74 }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <DateTimeField
          label={t({ th: "เริ่ม (ไม่บังคับ)", en: "Starts (optional)" })}
          base={{ th: "แก้ไขวันเริ่ม", en: "Edit start" }}
          date={startDate}
          time={startTime}
          onDate={setStartDate}
          onTime={setStartTime}
        />
        <DateTimeField
          label={t({ th: "สิ้นสุด (ไม่บังคับ)", en: "Ends (optional)" })}
          base={{ th: "แก้ไขวันสิ้นสุด", en: "Edit end" }}
          date={endDate}
          time={endTime}
          onDate={setEndDate}
          onTime={setEndTime}
        />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={save}
          disabled={busy || !canSave}
        >
          {busy ? t({ th: "กำลังบันทึก…", en: "Saving…" }) : t({ th: "บันทึก", en: "Save" })}
        </button>
        <button type="button" className="btn-sm" onClick={onCancel} disabled={busy}>
          {t({ th: "ยกเลิก", en: "Cancel" })}
        </button>
      </div>
    </div>
  );
}

const detailCol = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  flex: 1,
  minWidth: 150,
} as const;

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={fieldCol}>
      <span style={detailLabel}>{label}</span>
      <span style={{ fontSize: 14 }}>{children}</span>
    </div>
  );
}

/** View mode — the full detail in three columns + Edit / Delete. */
function CouponView({
  coupon,
  onEdit,
  onDelete,
}: {
  coupon: CouponWithUsage;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const t = useT();
  const status = isCouponExpired(coupon.endsAt, Date.now())
    ? t({ th: "หมดอายุ", en: "Expired" })
    : coupon.status === "active"
      ? t({ th: "ใช้งานอยู่", en: "Active" })
      : t({ th: "ปิดอยู่", en: "Disabled" });
  return (
    <>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div style={detailCol}>
          <DetailField label={t({ th: "โค้ด", en: "Code" })}>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
              {coupon.code}
            </span>
          </DetailField>
          <DetailField label={t({ th: "ส่วนลด", en: "Discount" })}>
            {valueLabel(coupon)}
          </DetailField>
          <DetailField label={t({ th: "ยอดขั้นต่ำ", en: "Min spent" })}>
            {coupon.minSubtotalSatang > 0 ? formatBahtTrim(coupon.minSubtotalSatang) : "—"}
          </DetailField>
          <DetailField label={t({ th: "ส่วนลดสูงสุด", en: "Max cap" })}>
            {coupon.maxDiscountSatang != null ? formatBahtTrim(coupon.maxDiscountSatang) : "—"}
          </DetailField>
        </div>
        <div style={detailCol}>
          <DetailField label={t({ th: "จำนวนส่วนลด", en: "Quota" })}>
            {coupon.maxUses ?? "∞"}
          </DetailField>
          <DetailField label={t({ th: "สิทธิ์ต่อคน", en: "Usage for user" })}>
            {coupon.maxUsesPerCustomer}
          </DetailField>
          <DetailField
            label={t({ th: "ใช้ไปแล้ว", en: "Used" })}
          >{`${coupon.redemptions} / ${coupon.maxUses ?? "∞"}`}</DetailField>
        </div>
        <div style={detailCol}>
          <DetailField label={t({ th: "สถานะ", en: "Status" })}>{status}</DetailField>
          <DetailField label={t({ th: "สร้างเมื่อ", en: "Created" })}>
            {formatUpdatedAt(coupon.createdAt)}
          </DetailField>
          <DetailField label={t({ th: "วันเริ่ม", en: "Start date" })}>
            {fullDate(coupon.startsAt)}
          </DetailField>
          <DetailField label={t({ th: "วันสิ้นสุด", en: "End date" })}>
            {fullDate(coupon.endsAt)}
          </DetailField>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" className="btn-sm" onClick={onEdit}>
          {t({ th: "แก้ไข", en: "Edit" })}
        </button>
        <ConfirmButton
          className="btn-sm"
          ariaLabel={`${t({ th: "ลบ", en: "Delete" })} ${coupon.code}`}
          confirmLabel={t({ th: "ลบเลย?", en: "Remove?" })}
          onConfirm={onDelete}
        >
          {t({ th: "ลบ", en: "Delete" })}
        </ConfirmButton>
      </div>
    </>
  );
}

/** One coupon: a compact row (name · discount · active) that expands to view / edit. */
function CouponRow({
  coupon,
  onChanged,
}: {
  coupon: CouponWithUsage;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  // Expired coupons can't be re-enabled — the toggle shows off + disabled.
  const expired = isCouponExpired(coupon.endsAt, Date.now());

  async function toggleActive(active: boolean) {
    try {
      await updateCoupon(coupon.id, { status: active ? "active" : "disabled" });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function del() {
    const refusal = deleteRefusal(coupon.redemptions);
    if (refusal) {
      toast(t(refusal), "error");
      return;
    }
    try {
      await deleteCoupon(coupon.id);
      toast(t({ th: "ลบคูปองแล้ว", en: "Coupon deleted" }), "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 2px" }}>
        <button
          type="button"
          onClick={() => {
            if (expanded) setEditing(false); // collapsing exits edit mode (don't strand unsaved edits)
            setExpanded((v) => !v);
          }}
          aria-expanded={expanded}
          aria-label={`${expanded ? t({ th: "ย่อ", en: "Collapse" }) : t({ th: "ขยาย", en: "Expand" })} ${coupon.name ?? coupon.code}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: 1,
            minWidth: 0,
            background: "none",
            border: "none",
            padding: "4px 0",
            cursor: "pointer",
            textAlign: "left",
            color: "inherit",
          }}
        >
          <Chevron open={expanded} />
          <span
            style={{
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {coupon.name ?? "—"}
          </span>
          <span className="pill soft">{valueLabel(coupon)}</span>
        </button>
        <span
          className="switch"
          title={
            expired
              ? t({ th: "หมดอายุ — เลยวันสิ้นสุดแล้ว", en: "Expired — past its end date" })
              : coupon.status === "active"
                ? t({ th: "ใช้งานอยู่", en: "Active" })
                : t({ th: "ปิดอยู่", en: "Disabled" })
          }
          style={{ opacity: expired ? 0.45 : 1, cursor: expired ? "not-allowed" : undefined }}
        >
          <input
            type="checkbox"
            checked={!expired && coupon.status === "active"}
            disabled={expired}
            aria-label={t({
              th: `เปิดใช้งานคูปอง ${coupon.code}`,
              en: `Coupon ${coupon.code} active`,
            })}
            onChange={(e) => toggleActive(e.target.checked)}
          />
          <span className="slider" />
        </span>
      </div>
      {expanded && (
        <div style={{ padding: "0 2px 16px 30px" }}>
          {editing ? (
            <CouponEditor
              coupon={coupon}
              onSaved={() => {
                setEditing(false);
                onChanged();
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <CouponView coupon={coupon} onEdit={() => setEditing(true)} onDelete={del} />
          )}
        </div>
      )}
    </div>
  );
}

export default function CouponsPage() {
  const toast = useToast();
  const t = useT();
  const [coupons, setCoupons] = useState<CouponWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [perCustomer, setPerCustomer] = useState("1");
  const [maxCap, setMaxCap] = useState("");
  const [busy, setBusy] = useState(false);

  // Percent entered as % → basis points (×100); fixed entered as ฿ → satang (×100).
  const valueNum = Math.round((parseFloat(value) || 0) * 100);
  const canAdd =
    name.trim() !== "" &&
    code.trim() !== "" &&
    valueNum > 0 &&
    (type !== "percent" || valueNum <= 10000);

  async function load() {
    try {
      setCoupons(await fetchCoupons());
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    const clash = duplicateCodeRefusal(
      code,
      coupons.map((c) => c.code),
    );
    if (clash) {
      toast(t(clash), "error");
      return;
    }
    const wanted = code.trim().toUpperCase();
    setBusy(true);
    try {
      await addCoupon({
        code: wanted,
        name: name.trim(),
        type,
        value: valueNum,
        minSubtotalSatang: Math.round((parseFloat(minSubtotal) || 0) * 100),
        startsAt: dateTimeToMs(startDate, startTime),
        endsAt: dateTimeToMs(endDate, endTime),
        maxUses: maxUses.trim() ? Math.max(1, Math.round(parseFloat(maxUses))) : null,
        maxUsesPerCustomer: Math.max(1, Math.round(parseFloat(perCustomer) || 1)),
        // Blank = uncapped, so an empty box must send null rather than a 0 that would zero every discount.
        maxDiscountSatang: maxCap.trim() ? Math.round((parseFloat(maxCap) || 0) * 100) : null,
      });
      toast(t({ th: "เพิ่มคูปองแล้ว", en: "Coupon added" }), "success");
      setCode("");
      setName("");
      setValue("");
      setMinSubtotal("");
      setStartDate("");
      setStartTime("");
      setEndDate("");
      setEndTime("");
      setMaxUses("");
      setPerCustomer("1");
      setMaxCap("");
      await load();
    } catch (e2) {
      toast((e2 as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title={t({ th: "คูปอง", en: "Coupons" })}
        subtitle={t({
          th: "โค้ดส่วนลดสำหรับสมาชิก ใช้ตอนสั่งซื้อบน AirPlus — แบบเปอร์เซ็นต์ลดจากยอดรวม แบบบาทลดเป็นจำนวนเงิน · คูปองที่มีคนใช้แล้วปิดใช้งานได้อย่างเดียว ลบไม่ได้",
          en: "Member-only discount codes for AirPlus checkout. Percent coupons take a % off the subtotal; fixed coupons take a baht amount off. Once a coupon has redemptions it can only be disabled, not deleted.",
        })}
      />

      {/* Frame 1 — add a coupon */}
      <div style={cardStyle}>
        <div style={cardLabel}>{t({ th: "เพิ่มคูปอง", en: "Add a coupon" })}</div>
        <form onSubmit={add} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Coupon name — admin-only label (customers never see it), full width. */}
          <div style={fieldCol}>
            <span style={fieldLabel}>{t({ th: "ชื่อคูปอง", en: "Coupon name" })}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t({
                th: "ตั้งชื่อไว้ดูเอง — ลูกค้าไม่เห็นชื่อนี้",
                en: "Name this coupon for your own reference — customers never see it",
              })}
              aria-label={t({ th: "ชื่อคูปอง", en: "Coupon name" })}
              style={{ ...inputS, width: "100%" }}
            />
          </div>

          {/* Setup — grouped: (Type · Value)   —wider gap—   (Min spent · Max cap), then a second
              row of (Code · Quota · Usage for user). */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 36, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={fieldCol}>
                  <span style={fieldLabel}>{t({ th: "ประเภท", en: "Type" })}</span>
                  <select
                    aria-label={t({ th: "ประเภทคูปอง", en: "Coupon type" })}
                    value={type}
                    onChange={(e) => setType(e.target.value as "percent" | "fixed")}
                    style={inputS}
                  >
                    <option value="percent">
                      {t({ th: "ลดเป็นเปอร์เซ็นต์", en: "Percent off" })}
                    </option>
                    <option value="fixed">{t({ th: "ลดเป็นบาท", en: "Baht off" })}</option>
                  </select>
                </div>
                <div style={fieldCol}>
                  <span style={fieldLabel}>
                    {type === "percent"
                      ? t({ th: "ลด (%)", en: "Value (%)" })
                      : t({ th: "ลด (฿)", en: "Value (฿)" })}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={type === "percent" ? 100 : undefined}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === "percent" ? "10" : "50"}
                    style={{ ...inputS, width: 90 }}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                <div style={fieldCol}>
                  <span style={fieldLabel}>{t({ th: "ยอดขั้นต่ำ (฿)", en: "Min spent (฿)" })}</span>
                  <input
                    type="number"
                    min={0}
                    value={minSubtotal}
                    onChange={(e) => setMinSubtotal(e.target.value)}
                    placeholder="0"
                    style={{ ...inputS, width: 110 }}
                  />
                </div>
                <div style={fieldCol}>
                  <span style={fieldLabel}>{t({ th: "ส่วนลดสูงสุด (฿)", en: "Max cap (฿)" })}</span>
                  <input
                    type="number"
                    min={0}
                    value={maxCap}
                    onChange={(e) => setMaxCap(e.target.value)}
                    placeholder="∞"
                    title={t({
                      th: "ส่วนลดมากที่สุดที่คูปองนี้ให้ได้ · เว้นว่าง = ไม่จำกัด",
                      en: "Largest discount this coupon can ever give. Blank = no cap.",
                    })}
                    style={{ ...inputS, width: 110 }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={fieldCol}>
                <span style={fieldLabel}>{t({ th: "โค้ด", en: "Code" })}</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="WELCOME10"
                  style={{ ...inputS, width: 130, textTransform: "uppercase" }}
                />
              </div>
              <div style={fieldCol}>
                <span style={fieldLabel}>{t({ th: "จำนวนส่วนลด", en: "Quota" })}</span>
                <input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="∞"
                  title={t({
                    th: "ใช้ได้ทั้งหมดกี่ครั้ง รวมทุกคน · เว้นว่าง = ไม่จำกัด",
                    en: "Total redemptions allowed across all customers. Blank = unlimited.",
                  })}
                  style={{ ...inputS, width: 74 }}
                />
              </div>
              <div style={fieldCol}>
                <span style={fieldLabel}>{t({ th: "สิทธิ์ต่อคน", en: "Usage for user" })}</span>
                <input
                  type="number"
                  min={1}
                  value={perCustomer}
                  onChange={(e) => setPerCustomer(e.target.value)}
                  title={t({
                    th: "ลูกค้าหนึ่งคนใช้คูปองนี้ได้กี่ครั้ง",
                    en: "How many times one customer may use this coupon.",
                  })}
                  style={{ ...inputS, width: 74 }}
                />
              </div>
            </div>
          </div>

          {/* Schedule — start / end date + time (optional; blank = no bound). */}
          <div style={{ display: "flex", gap: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
            <DateTimeField
              label={t({ th: "เริ่ม (ไม่บังคับ)", en: "Starts (optional)" })}
              base={{ th: "วันเริ่ม", en: "Start" }}
              date={startDate}
              time={startTime}
              onDate={setStartDate}
              onTime={setStartTime}
            />
            <DateTimeField
              label={t({ th: "สิ้นสุด (ไม่บังคับ)", en: "Ends (optional)" })}
              base={{ th: "วันสิ้นสุด", en: "End" }}
              date={endDate}
              time={endTime}
              onDate={setEndDate}
              onTime={setEndTime}
            />
          </div>

          <div>
            <button type="submit" className="btn-primary btn-sm" disabled={busy || !canAdd}>
              {t({ th: "เพิ่ม", en: "Add" })}
            </button>
          </div>
        </form>
      </div>

      {/* Frame 2 — coupons table */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={cardLabel}>{t({ th: "คูปอง", en: "Coupons" })}</div>
        {loading ? (
          <p className="muted" style={{ fontSize: 13 }}>
            {t({ th: "กำลังโหลด…", en: "Loading…" })}
          </p>
        ) : coupons.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            {t({ th: "ยังไม่มีคูปอง — เพิ่มได้ที่ด้านบน", en: "No coupons yet. Add one above." })}
          </p>
        ) : (
          <div>
            {coupons.map((c) => (
              <CouponRow key={c.id} coupon={c} onChanged={load} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
