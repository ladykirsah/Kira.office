"use client";

import { useEffect, useState } from "react";
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
import { ConfirmButton } from "../../ConfirmButton";
import { inputS } from "@/lib/inputStyles";

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

// datetime-local value ↔ epoch ms; "" ↔ null (no window bound).
function inputToMs(v: string): number | null {
  return v ? new Date(v).getTime() : null;
}

const TrashIcon = () => (
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
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/** "10%" for percent coupons (value = basis points), "฿50" for fixed ones (value = satang). */
function valueLabel(c: CouponWithUsage): string {
  return c.type === "percent" ? `${c.value / 100}%` : formatBahtTrim(c.value);
}

function windowLabel(startsAt: number | null, endsAt: number | null): string {
  if (startsAt == null && endsAt == null) return "Always";
  const from = startsAt != null ? formatUpdatedAt(startsAt) : "…";
  const to = endsAt != null ? formatUpdatedAt(endsAt) : "…";
  return `${from} → ${to}`;
}

function CouponItem({
  coupon,
  onChanged,
}: {
  coupon: CouponWithUsage;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();

  async function toggle(active: boolean) {
    try {
      await updateCoupon(coupon.id, { status: active ? "active" : "disabled" });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function del() {
    try {
      await deleteCoupon(coupon.id);
      toast("Coupon deleted", "success");
      await onChanged();
    } catch (e) {
      // 409 (already redeemed) arrives here with a "disable it instead" message.
      toast((e as Error).message, "error");
    }
  }

  return (
    <tr>
      <td>
        <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>
          {coupon.code}
        </span>
      </td>
      <td>
        <span className="pill soft">{valueLabel(coupon)}</span>
      </td>
      <td>
        {coupon.minSubtotalSatang > 0 ? (
          formatBahtTrim(coupon.minSubtotalSatang)
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
        {windowLabel(coupon.startsAt, coupon.endsAt)}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {coupon.redemptions}
        <span className="muted"> / {coupon.maxUses ?? "∞"}</span>
      </td>
      <td>{coupon.maxUsesPerCustomer}</td>
      <td>
        <span className="switch">
          <input
            type="checkbox"
            checked={coupon.status === "active"}
            aria-label={`Coupon ${coupon.code} active`}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="slider" />
        </span>
      </td>
      <td style={{ textAlign: "right" }}>
        <ConfirmButton
          className="icon-btn"
          ariaLabel={`Delete ${coupon.code}`}
          confirmLabel="Remove?"
          onConfirm={del}
        >
          <TrashIcon />
        </ConfirmButton>
      </td>
    </tr>
  );
}

export default function CouponsPage() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<CouponWithUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("");
  const [minSubtotal, setMinSubtotal] = useState("");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [perCustomer, setPerCustomer] = useState("1");
  const [maxCap, setMaxCap] = useState("");
  const [busy, setBusy] = useState(false);

  // Percent entered as % → basis points (×100); fixed entered as ฿ → satang (×100).
  const valueNum = Math.round((parseFloat(value) || 0) * 100);
  const canAdd = code.trim() !== "" && valueNum > 0 && (type !== "percent" || valueNum <= 10000);

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
    setBusy(true);
    try {
      await addCoupon({
        code: code.trim().toUpperCase(),
        type,
        value: valueNum,
        minSubtotalSatang: Math.round((parseFloat(minSubtotal) || 0) * 100),
        startsAt: inputToMs(starts),
        endsAt: inputToMs(ends),
        maxUses: maxUses.trim() ? Math.max(1, Math.round(parseFloat(maxUses))) : null,
        maxUsesPerCustomer: Math.max(1, Math.round(parseFloat(perCustomer) || 1)),
        // Blank = uncapped, so an empty box must send null rather than a 0 that would zero every discount.
        maxDiscountSatang: maxCap.trim() ? Math.round((parseFloat(maxCap) || 0) * 100) : null,
      });
      toast("Coupon added", "success");
      setCode("");
      setValue("");
      setMinSubtotal("");
      setStarts("");
      setEnds("");
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
        title="Coupons"
        subtitle="Member-only discount codes for AirPlus checkout. Percent coupons take a % off the subtotal; fixed coupons take a baht amount off. Once a coupon has redemptions it can only be disabled, not deleted."
      />

      {/* Frame 1 — add a coupon */}
      <div style={cardStyle}>
        <div style={cardLabel}>Add a coupon</div>
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <div style={fieldCol}>
            <span style={fieldLabel}>Code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME10"
              style={{ ...inputS, width: 130, textTransform: "uppercase" }}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Type</span>
            <select
              aria-label="Coupon type"
              value={type}
              onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              style={inputS}
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Baht off</option>
            </select>
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>{type === "percent" ? "Value (%)" : "Value (฿)"}</span>
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
          <div style={fieldCol}>
            <span style={fieldLabel}>Min subtotal (฿)</span>
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
            <span style={fieldLabel}>Max cap (฿)</span>
            <input
              type="number"
              min={0}
              value={maxCap}
              onChange={(e) => setMaxCap(e.target.value)}
              placeholder="∞"
              title="Largest discount this coupon can ever give. Blank = no cap."
              style={{ ...inputS, width: 110 }}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Starts (optional)</span>
            <input
              type="datetime-local"
              value={starts}
              onChange={(e) => setStarts(e.target.value)}
              style={inputS}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Ends (optional)</span>
            <input
              type="datetime-local"
              value={ends}
              onChange={(e) => setEnds(e.target.value)}
              style={inputS}
            />
          </div>
          <div style={fieldCol}>
            <span style={fieldLabel}>Max uses</span>
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
            <span style={fieldLabel}>Per customer</span>
            <input
              type="number"
              min={1}
              value={perCustomer}
              onChange={(e) => setPerCustomer(e.target.value)}
              style={{ ...inputS, width: 74 }}
            />
          </div>
          <button type="submit" className="btn-primary btn-sm" disabled={busy || !canAdd}>
            Add
          </button>
        </form>
      </div>

      {/* Frame 2 — coupons table */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={cardLabel}>Coupons</div>
        {loading ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Loading…
          </p>
        ) : coupons.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No coupons yet. Add one above.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min subtotal</th>
                  <th>Window</th>
                  <th>Used</th>
                  <th>Per customer</th>
                  <th>Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <CouponItem key={c.id} coupon={c} onChanged={load} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
