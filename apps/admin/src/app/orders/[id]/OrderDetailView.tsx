"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CLAIM_STATES,
  claimStateLabel,
  isClaimState,
  nextClaimStates,
  actorFor,
  orderHistoryEventLabel,
  isOrderHistoryEvent,
  operationalStatus,
  trackingUrl,
  type ClaimState,
} from "@l-shopee/core";
import {
  createOrderClaim,
  saveOrderStaffNote,
  transitionOrderClaim,
  type OrderDetail,
  type ShopInfo,
} from "@/lib/api";
import { LabelActions, ShipmentSection } from "./ShipmentActions";
import { operationalStatusBadge } from "@/lib/badges";
import { formatBahtTrim } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { PageHeader } from "../../PageHeader";
import { card, sectionTitle } from "./cardStyles";

function dt(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The double rule that closes a ledger — every figure above it sums into the total below. */
const totalRule = { borderTop: "1px solid var(--border)", margin: "6px 0" } as const;

/** Money row. `strong` is for the totals the owner reads first. */
function Row({
  label,
  value,
  strong,
  muted,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  /** Why this number is what it is — the arithmetic behind a derived row, in small grey type. */
  hint?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", gap: 12 }}>
      <span style={{ ...tableText.body2, color: muted ? "var(--text-muted)" : "var(--text)" }}>
        {label}
        {hint && <span style={{ ...tableText.subtitle, display: "block" }}>{hint}</span>}
      </span>
      <span
        style={{
          ...tableText.body2,
          fontWeight: strong ? 700 : 500,
          color: muted ? "var(--text-muted)" : "var(--text)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * One number, two names. A positive shortfall is delivery we absorbed; a negative one means we
 * charged more than the carrier billed, which is a real gain and is not clamped away upstream.
 * "On us −฿20" would read as nonsense, so the sign picks the label instead of the value.
 */
function shortfallLabel(shortfallSatang: number | null): string {
  if (shortfallSatang != null && shortfallSatang < 0) return "Shipping gain";
  return "Shipping on us";
}

function shortfallValue(shortfallSatang: number | null): string {
  // Null is not zero. Zero claims delivery cost us nothing; null admits nobody has been to the
  // counter yet, which is the normal state of an order waiting to ship.
  if (shortfallSatang == null) return "—";
  return `${shortfallSatang < 0 ? "+ " : "− "}${formatBahtTrim(Math.abs(shortfallSatang))}`;
}

/** Margin against goods after discount — the customer's shipping pass-through is not ours to claim. */
function marginHint(profitSatang: number | null, goodsSatang: number): string | undefined {
  if (profitSatang == null || goodsSatang <= 0) return undefined;
  return `${((profitSatang / goodsSatang) * 100).toFixed(1)}% of goods`;
}

/**
 * How far our own quote was from what Flash actually billed. Worth surfacing per order: if the gap
 * leans one way consistently, the rate card's volumetric divisor is wrong, and these rows are the
 * evidence for it.
 */
function quoteGap(autoSatang: number, realSatang: number | null): string | null {
  if (realSatang == null) return null;
  const gap = realSatang - autoSatang;
  if (gap === 0) return null;
  const dir = gap > 0 ? "under" : "over";
  return `Our quote was ${formatBahtTrim(Math.abs(gap))} ${dir} what Flash charged.`;
}

const TIER_PILL: Record<string, string> = {
  best: "good",
  good: "good",
  watch: "warn",
  bad: "bad",
  block: "bad",
};

export function OrderDetailView({ detail, shop }: { detail: OrderDetail; shop: ShopInfo }) {
  const { order, customer, address, money, lines, timeline, claims } = detail;
  const status = operationalStatusBadge(order.orderStatus, order.paymentStatus);
  /**
   * "To ship" is DERIVED, not a stored status: order_status new, confirmed and packing all read as
   * To ship once the money has cleared. Gating on the derived value is what makes the drop-off form
   * appear for all three, and disappear the moment the order becomes shipped.
   */
  const isToShip = operationalStatus(order.orderStatus, order.paymentStatus) === "to_ship";
  const track = trackingUrl(order.carrier, order.trackingNo);

  const [note, setNote] = useState(order.staffNote ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);

  async function saveNote() {
    setNoteSaving(true);
    setErr(null);
    try {
      await saveOrderStaffNote(order.id, note);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 1500);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setNoteSaving(false);
    }
  }

  async function move(claimId: string, to: ClaimState) {
    setBusyClaim(claimId);
    setErr(null);
    try {
      await transitionOrderClaim(claimId, to);
      location.reload();
    } catch (e) {
      // The API re-checks the gates, so a refusal here means the page was stale.
      setErr((e as Error).message);
      setBusyClaim(null);
    }
  }

  return (
    <main>
      <PageHeader
        title={order.externalOrderId}
        subtitle={
          <>
            สั่งซื้อเมื่อ {dt(order.orderCreatedAt ?? order.importedAt)} ·{" "}
            <span className={`pill ${status.pill}`}>{status.label}</span>
          </>
        }
        action={
          <Link href="/orders" className="btn-soft btn-sm">
            ← All orders
          </Link>
        }
      />

      {err && (
        <div style={{ ...card, borderColor: "var(--danger)", color: "var(--danger)" }} role="alert">
          {err}
        </div>
      )}

      {/* Shipment first, full width, while the order is waiting to go out (owner, 30 Jul 2026): the
          parcel is the only thing that needs doing, so it should not be below the customer's phone
          number. Once it ships the section disappears and Customer is first again. */}
      {isToShip && (
        <ShipmentSection
          order={order}
          address={address}
          lines={lines}
          shop={shop}
          status={status}
          onError={setErr}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* ── left column ─────────────────────────────────────────────────────────── */}
        <div>
          {/* Customer — the block that replaces Shopee's buyer card. Tier and credit are here
              because they are what decide whether this customer gets COD at all. */}
          <div style={card}>
            <div style={sectionTitle}>Customer</div>
            {customer ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {customer.customerCode ?? "—"}
                  </span>
                  {customer.tier && (
                    <span className={`pill ${TIER_PILL[customer.tier] ?? "off"}`}>
                      {customer.tier}
                    </span>
                  )}
                  <span style={tableText.subtitle}>
                    credit {customer.creditScore ?? 0} · {customer.orderCount} orders
                  </span>
                </div>
                <div style={{ ...tableText.body2, marginTop: 4 }}>{customer.name ?? "—"}</div>
                <div style={tableText.subtitle}>{customer.phone ?? "—"}</div>
              </>
            ) : (
              <div style={tableText.subtitle}>
                No storefront account — {order.buyerUsername ?? "unknown buyer"}
              </div>
            )}
          </div>

          {/* Shipping */}
          <div style={card}>
            <div style={sectionTitle}>Shipping</div>
            {address ? (
              <div style={tableText.body2}>
                <div style={{ fontWeight: 600 }}>
                  {address.recipientName ?? "—"} · {address.phone ?? "—"}
                </div>
                <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                  {[
                    address.addressLine1,
                    address.subdistrict,
                    address.district,
                    address.province,
                    address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </div>
              </div>
            ) : (
              <div style={tableText.subtitle}>No address on this order</div>
            )}
            <div style={{ marginTop: 10, display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={tableText.subtitle}>Carrier</div>
                <div style={tableText.body2}>{order.carrier ?? "—"}</div>
              </div>
              <div>
                <div style={tableText.subtitle}>Tracking</div>
                <div style={{ ...tableText.body2, fontFamily: "var(--font-mono, monospace)" }}>
                  {/* Only ever a link once a drop-off has been recorded — the carrier issues the
                      number at the counter, so before then there is nothing to link to. */}
                  {track ? (
                    <a href={track} target="_blank" rel="noreferrer noopener">
                      {order.trackingNo}
                    </a>
                  ) : (
                    (order.trackingNo ?? "—")
                  )}
                </div>
              </div>
              <div>
                <div style={tableText.subtitle}>Shipped</div>
                <div style={tableText.body2}>{dt(order.shipTimeMs)}</div>
              </div>
              {/* What the carrier actually billed, on the record itself — the card that answers
                  "what happened to this parcel" should not make you scroll to the money block for
                  the last figure of the four. */}
              <div>
                <div style={tableText.subtitle}>Real charge</div>
                <div style={tableText.body2}>
                  {order.shippingRealSatang == null
                    ? "—"
                    : formatBahtTrim(order.shippingRealSatang)}
                </div>
              </div>
            </div>

            {/* The label has to stay reachable for the whole life of the order, not just while it is
                waiting to go out — reprints happen. While it IS waiting, the buttons live in the
                Shipment section at the top instead, so there is never a second pair on screen. */}
            {!isToShip && (
              <LabelActions
                order={order}
                address={address}
                lines={lines}
                shop={shop}
                onError={setErr}
              />
            )}
          </div>

          {/* Items */}
          <div style={card}>
            <div style={sectionTitle}>Items</div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600, ...tableText.body2 }}>{l.name ?? "—"}</div>
                        <div style={tableText.subtitle}>{l.sku ?? l.variantId}</div>
                      </td>
                      <td style={tableText.body2}>{formatBahtTrim(l.unitPriceSatang)}</td>
                      <td style={tableText.body2}>{l.quantity}</td>
                      <td style={{ ...tableText.body2, fontWeight: 600 }}>
                        {formatBahtTrim(l.lineTotalSatang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Money — two books, per the owner's correction of 30 Jul 2026. Their formula described
              what we RECEIVE while the line was labelled "Total", which everyone reads as what the
              customer was charged; one word, two different numbers. So: left is an invoice they could
              hand the customer unedited, right never leaves the back office.

              Both read the API's derived `money`. Nothing is computed here — a figure that this page
              and /orders could disagree about is exactly what deriving centrally prevents. No
              marketplace fees either: that is a Shopee concept and does not exist on an AirPlus order. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            <div style={card}>
              <div style={sectionTitle}>What the customer was charged</div>
              <Row label="Subtotal" value={formatBahtTrim(order.subtotalSatang)} />
              {order.discountTotalSatang > 0 && (
                <Row
                  label="Coupon discount"
                  value={`− ${formatBahtTrim(order.discountTotalSatang)}`}
                />
              )}
              <Row label="Shipping" value={`+ ${formatBahtTrim(order.shippingFeeSatang)}`} />
              <div style={totalRule} />
              <Row label="Customer paid" value={formatBahtTrim(money.customerPaidSatang)} strong />
            </div>

            <div style={card}>
              <div style={sectionTitle}>What we kept</div>
              <Row
                label="Goods after discount"
                value={formatBahtTrim(money.goodsAfterDiscountSatang)}
              />
              <Row label="Item cost" value={`− ${formatBahtTrim(money.itemCostSatang)}`} muted />
              {/* The shortfall, NOT the full carrier charge: this panel starts from goods after
                  discount, which excludes the fee the customer paid. Deducting the whole ฿90 here
                  would drop their contribution and read profit low by exactly that fee. */}
              <Row
                label={shortfallLabel(money.shippingShortfallSatang)}
                value={shortfallValue(money.shippingShortfallSatang)}
                hint={
                  money.shippingShortfallSatang == null
                    ? "no drop-off recorded yet"
                    : `${formatBahtTrim(order.shippingRealSatang ?? 0)} real − ${formatBahtTrim(order.shippingFeeSatang)} charged`
                }
                muted
              />
              <div style={totalRule} />
              <Row
                label="Profit"
                value={money.profitSatang == null ? "—" : formatBahtTrim(money.profitSatang)}
                hint={marginHint(money.profitSatang, money.goodsAfterDiscountSatang)}
                strong
              />
            </div>
          </div>

          {/* Shipping money — the owner's four figures (auto cal / offered / charged / on us) plus the
              real charge, without which "On us" is a number with no arithmetic behind it. */}
          <div style={card}>
            <div style={sectionTitle}>Shipping fee</div>
            <Row
              label="Auto calculated"
              value={formatBahtTrim(order.shippingAutoSatang)}
              hint="what our Flash rate card quoted at checkout"
              muted
            />
            {/* Only on a shared-fee order. A null offered fee IS the marker for a normal one, which is
                why there is no separate flag to disagree with. */}
            {order.shippingOfferSatang != null && (
              <Row
                label="Offered to customer"
                value={formatBahtTrim(order.shippingOfferSatang)}
                hint="shared-fee order"
              />
            )}
            <Row label="Charged to customer" value={formatBahtTrim(order.shippingFeeSatang)} />
            <Row
              label="Real charge"
              value={
                order.shippingRealSatang == null ? "—" : formatBahtTrim(order.shippingRealSatang)
              }
              hint={
                order.shippingRealSatang == null
                  ? "recorded at drop-off"
                  : (order.carrier ?? "carrier not recorded")
              }
            />
            <div style={totalRule} />
            <Row
              label={shortfallLabel(money.shippingShortfallSatang)}
              value={shortfallValue(money.shippingShortfallSatang)}
              strong
            />
            {quoteGap(order.shippingAutoSatang, order.shippingRealSatang) && (
              <div style={{ ...tableText.subtitle, marginTop: 8, color: "var(--warn)" }}>
                {quoteGap(order.shippingAutoSatang, order.shippingRealSatang)}
              </div>
            )}
          </div>

          <ClaimsSection
            orderId={order.id}
            claims={claims}
            lines={lines}
            busyClaim={busyClaim}
            raising={raising}
            setRaising={setRaising}
            onMove={move}
            onError={setErr}
          />
        </div>

        {/* ── right rail: note + timeline ──────────────────────────────────────────── */}
        <div>
          <div style={card}>
            <div style={sectionTitle}>Note</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="บันทึกภายใน…"
              style={{ width: "100%", ...inputS, minHeight: 68 }}
            />
            <button
              type="button"
              className="btn-soft btn-sm"
              disabled={noteSaving || note === (order.staffNote ?? "")}
              onClick={() => void saveNote()}
              style={{ marginTop: 8 }}
            >
              {noteSaving ? "Saving…" : noteSaved ? "✓ Saved" : "Save note"}
            </button>
          </div>

          {/* Newest first, matching the Shopee reference the owner supplied. */}
          <div style={card}>
            <div style={sectionTitle}>Timeline</div>
            {timeline.length === 0 ? (
              <div style={tableText.subtitle}>No history yet.</div>
            ) : (
              timeline.map((t, i) => (
                <div key={t.id} style={{ display: "flex", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: i === 0 ? "var(--primary)" : "var(--border)",
                        marginTop: 6,
                        flexShrink: 0,
                      }}
                    />
                    {i < timeline.length - 1 && (
                      <span
                        style={{ width: 2, flex: 1, minHeight: 16, background: "var(--border)" }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: 14 }}>
                    <div style={{ ...tableText.body2, fontWeight: 600 }}>
                      {isOrderHistoryEvent(t.event) ? orderHistoryEventLabel(t.event) : t.event}
                    </div>
                    <div style={tableText.subtitle}>
                      {dt(t.createdAt)}
                      {t.actorEmail ? ` · ${t.actorEmail}` : " · system"}
                    </div>
                    {t.note && <div style={tableText.subtitle}>{t.note}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Claims. Actions are offered from the state machine in core, so the page can only ever show a
 * legal move — and the API re-checks anyway, because a stale tab is not a guard.
 */
function ClaimsSection({
  orderId,
  claims,
  lines,
  busyClaim,
  raising,
  setRaising,
  onMove,
  onError,
}: {
  orderId: string;
  claims: OrderDetail["claims"];
  lines: OrderDetail["lines"];
  busyClaim: string | null;
  raising: boolean;
  setRaising: (v: boolean) => void;
  onMove: (claimId: string, to: ClaimState) => void;
  onError: (m: string | null) => void;
}) {
  const [kind, setKind] = useState<"defect" | "wrong_item">("defect");
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const chosen = Object.entries(picked).filter(([, q]) => q > 0);

  async function submit() {
    setSaving(true);
    onError(null);
    try {
      await createOrderClaim(orderId, {
        kind,
        reasonNote: reason.trim() || null,
        lines: chosen.map(([salesOrderLineId, quantity]) => ({ salesOrderLineId, quantity })),
      });
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ ...sectionTitle, marginBottom: 0 }}>Claims</div>
        {!raising && (
          <button type="button" className="btn-soft btn-sm" onClick={() => setRaising(true)}>
            + Raise a claim
          </button>
        )}
      </div>

      {raising && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <select
              aria-label="Reason"
              value={kind}
              onChange={(e) => setKind(e.target.value as "defect" | "wrong_item")}
              style={inputS}
            >
              <option value="defect">Defective (เคลม)</option>
              <option value="wrong_item">Wrong item sent (ส่งผิด)</option>
            </select>
            <input
              placeholder="What did the customer say?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              style={{ ...inputS, flex: 1, minWidth: 220 }}
            />
          </div>
          {/* Which items — the owner said a claim can cover one line or several. */}
          {lines.map((l) => (
            <div
              key={l.id}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}
            >
              <input
                type="checkbox"
                checked={(picked[l.id] ?? 0) > 0}
                onChange={(e) => setPicked((p) => ({ ...p, [l.id]: e.target.checked ? 1 : 0 }))}
              />
              <span style={{ ...tableText.body2, flex: 1 }}>{l.name ?? l.variantId}</span>
              <input
                type="number"
                min={1}
                max={l.quantity}
                value={picked[l.id] ?? 1}
                disabled={(picked[l.id] ?? 0) === 0}
                onChange={(e) =>
                  setPicked((p) => ({ ...p, [l.id]: Math.min(l.quantity, Number(e.target.value)) }))
                }
                style={{ ...inputS, width: 70 }}
              />
              <span style={tableText.subtitle}>of {l.quantity}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={saving || chosen.length === 0}
              onClick={() => void submit()}
            >
              {saving ? "Raising…" : "Raise claim"}
            </button>
            <button type="button" className="btn-soft btn-sm" onClick={() => setRaising(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {claims.length === 0 && !raising && (
        <div style={{ ...tableText.subtitle, marginTop: 8 }}>No claims on this order.</div>
      )}

      {claims.map((c) => {
        const state = isClaimState(c.state) ? c.state : null;
        const moves = state ? nextClaimStates(state) : [];
        return (
          <div
            key={c.id}
            style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, ...tableText.body2 }}>
                {state ? claimStateLabel(state) : c.state}
              </span>
              <span className="pill off">{c.kind === "defect" ? "Defective" : "Wrong item"}</span>
              <span style={tableText.subtitle}>{dt(c.createdAt)}</span>
            </div>
            {c.reasonNote && <div style={tableText.subtitle}>{c.reasonNote}</div>}
            <div style={tableText.subtitle}>
              {c.lines.length} item{c.lines.length === 1 ? "" : "s"}
              {c.mechanicName ? ` · mechanic: ${c.mechanicName}` : ""}
              {c.refundSatang != null ? ` · refund ${formatBahtTrim(c.refundSatang)}` : ""}
            </div>

            {moves.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {moves.map((to) => {
                  const who = state ? actorFor(state, to) : null;
                  return (
                    <button
                      key={to}
                      type="button"
                      className={to.includes("reject") ? "btn-soft btn-sm" : "btn-primary btn-sm"}
                      disabled={busyClaim === c.id}
                      onClick={() => onMove(c.id, to)}
                      // Whose decision this is — a mechanic's verdict must never be mistaken for
                      // an admin's, because a refund traces back to who passed it.
                      title={who ? `${who} action` : undefined}
                    >
                      {claimStateLabel(to)}
                      {who === "mechanic" ? " (ช่าง)" : ""}
                    </button>
                  );
                })}
              </div>
            )}
            {state && CLAIM_STATES.includes(state) && moves.length === 0 && (
              <div style={{ ...tableText.subtitle, marginTop: 6 }}>Closed — no further action.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
