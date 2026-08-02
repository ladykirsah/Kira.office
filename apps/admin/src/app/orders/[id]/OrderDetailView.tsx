"use client";

import { useState } from "react";
import {
  isClaimState,
  isTerminalClaimState,
  claimStateLabelTh,
  codApproval,
  canReviewPayment,
  operationalStatus,
  orderStages,
  type CustomerTier,
  type OrderStage,
} from "@l-shopee/core";
import { saveOrderStaffNote, privateFileUrl, type OrderDetail, type ShopInfo } from "@/lib/api";
import { ShipmentSection } from "./ShipmentActions";
import { PaymentReviewSection } from "./PaymentReview";
import { CodApprovalSection } from "./CodApproval";
import { RefundSection } from "./RefundSection";
import { ClaimReviewSection } from "./ClaimReview";
import { CopyButton } from "../../products/CopyButton";
import { DocumentsCard } from "./documents";
import { operationalStatusBadge } from "@/lib/badges";
import { formatBahtTrim } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { PageHeader } from "../../PageHeader";
import { BackLink } from "../../BackLink";
import { card, sectionTitle } from "./cardStyles";

function dt(ms: number | null): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)} · ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The double rule that closes a ledger — every figure above it sums into the total below. */
const totalRule = { borderTop: "1px solid var(--border)", margin: "6px 0" } as const;

/**
 * One step in the timeline stepper. Red (--primary) is reserved for the single "you are here" dot —
 * the current step, ringed so it reads at a glance. Passed steps render in the foreground colour
 * (black in light mode) with a black spine; upcoming steps are hollow and muted. Spraying red across
 * every done step over-uses the accent, so done is black and only current is red.
 */
function StepRow({ stage, last }: { stage: OrderStage; last: boolean }) {
  const done = stage.state === "done";
  const current = stage.state === "current";
  const reached = done || current;
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            marginTop: 5,
            flexShrink: 0,
            background: current ? "var(--primary)" : done ? "var(--text)" : "transparent",
            border: reached ? "none" : "2px solid var(--border)",
            boxShadow: current
              ? "0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent)"
              : "none",
          }}
        />
        {!last && (
          <span
            style={{
              width: 2,
              flex: 1,
              minHeight: 16,
              // Connector spines are always grey; the dot alone carries the state (red = current,
              // black = passed, hollow = upcoming).
              background: "var(--border)",
            }}
          />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 14 }}>
        <div
          style={{
            ...tableText.body2,
            fontWeight: reached ? 600 : 500,
            color: reached ? undefined : "var(--text-muted)",
          }}
        >
          {stage.label}
        </div>
        {stage.at != null && <div style={tableText.subtitle}>{dt(stage.at)}</div>}
        {stage.note && <div style={tableText.subtitle}>{stage.note}</div>}
      </div>
    </div>
  );
}

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
  const {
    order,
    customer,
    address,
    money,
    lines,
    timeline,
    claims,
    viewerIsSuperAdmin,
    refundAction,
    viewerRole,
    mechanics,
  } = detail;
  const status = operationalStatusBadge(order.orderStatus, order.paymentStatus);
  // "Verifying" is Zone A too: a slip is waiting on a confirm/reject decision.
  const isVerifying = operationalStatus(order.orderStatus, order.paymentStatus) === "verifying";
  // "COD pending" is Zone A: a watch-tier COD order awaits the staff approve/deny decision.
  const isCodPending = operationalStatus(order.orderStatus, order.paymentStatus) === "cod_pending";
  // The ACTIVE defect claim (any non-terminal state) is Zone A for its WHOLE life — approve/reject,
  // receive, mechanic verdict, ship, done. It stays on top until terminal (done/cancelled/rejected),
  // then drops to the Zone-B Claims card. The mechanic's + super-admin's call; a plain admin: read-only.
  // A claim stays in Zone A while non-terminal, PLUS a rejected one until we've shipped the product
  // back (mechanic_rejected is terminal in the machine, but its return shipment still needs doing —
  // marked done once tracking is recorded).
  const activeClaim =
    claims.find(
      (c) =>
        isClaimState(c.state) &&
        (!isTerminalClaimState(c.state) || (c.state === "mechanic_rejected" && !c.trackingNo)),
    ) ?? null;
  // Payment/COD review is the super-admin's + admin's action; a mechanic sees it read-only.
  const canReviewPay = canReviewPayment(viewerRole);
  /**
   * "To ship" is DERIVED, not a stored status: order_status new, confirmed and packing all read as
   * To ship once the money has cleared. Gating on the derived value is what makes the drop-off form
   * appear for all three, and disappear the moment the order becomes shipped.
   */
  const isToShip = operationalStatus(order.orderStatus, order.paymentStatus) === "to_ship";
  // Payment method, derived (no separate column): COD orders collect on delivery, everything else is
  // a bank transfer / PromptPay slip.
  const isCod = ["cod", "cod_confirmed", "cod_collected"].includes(order.paymentStatus ?? "");
  const paymentMethod = isCod ? "เก็บเงินปลายทาง" : "โอนเงิน / สลิป";

  /**
   * The timeline as a progress stepper (owner, 31 Jul): oldest → newest, dated from history, with the
   * dot on the current status. Labels/states are derived in core so the stepper always agrees with
   * the pill; history only supplies the timestamps.
   */
  // COD on a best/good customer is approved automatically at checkout — the timeline says so instead
  // of naming an approver. Unknown tiers fall through codApproval to "blocked" (not auto), so safe.
  const codAutoApproved = customer?.tier
    ? codApproval(customer.tier as CustomerTier) === "auto"
    : false;
  const stages = orderStages(
    order.orderStatus,
    order.paymentStatus,
    timeline.map((t) => ({ event: t.event, at: t.createdAt })),
    { codAutoApproved },
  );

  const [note, setNote] = useState(order.staffNote ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        below={<BackLink href="/orders">All orders</BackLink>}
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

      {isVerifying && (
        <PaymentReviewSection
          order={order}
          viewerIsSuperAdmin={viewerIsSuperAdmin}
          canAct={canReviewPay}
          status={status}
          onError={setErr}
        />
      )}

      {isCodPending && (
        <CodApprovalSection order={order} canAct={canReviewPay} status={status} onError={setErr} />
      )}

      {/* The active defect claim — Zone A for its whole life, for a mechanic or super-admin (a plain
          admin sees it read-only). Each step's action lives here; a deny move shows the customer why. */}
      {activeClaim && (
        <ClaimReviewSection
          claim={activeClaim}
          order={order}
          address={address}
          lines={lines}
          viewerRole={viewerRole}
          viewerIsSuperAdmin={viewerIsSuperAdmin}
          mechanics={mechanics}
          status={status}
          onError={setErr}
        />
      )}

      {/* A bounced parcel we were paid for: Zone A is the refund — the customer's payout account (super
          admin) plus the slip upload, or the evidence once it is done. Every other return is LINE OA. */}
      {(refundAction === "needs_refund" || refundAction === "refunded") && (
        <RefundSection
          order={order}
          refundAction={refundAction}
          viewerIsSuperAdmin={viewerIsSuperAdmin}
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
                    สำเร็จ {customer.completeCount} · ไม่สำเร็จ {customer.incompleteCount}
                  </span>
                </div>
                <div style={{ ...tableText.body2, marginTop: 4 }}>
                  {customer.name ?? "—"} · {customer.phone ?? "—"}
                </div>
              </>
            ) : (
              <div style={tableText.subtitle}>
                No storefront account — {order.buyerUsername ?? "unknown buyer"}
              </div>
            )}
          </div>

          {/* Shipping — three sections 16px apart: address, payment method, carrier. The label
              buttons used to live here; they moved to Documents, which carries them at every stage. */}
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

            <div style={{ marginTop: 16 }}>
              <div style={tableText.subtitle}>Payment method</div>
              <div style={tableText.body2}>{paymentMethod}</div>
            </div>

            <div style={{ marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={tableText.subtitle}>Carrier</div>
                <div style={tableText.body2}>{order.carrier ?? "—"}</div>
              </div>
              <div>
                <div style={tableText.subtitle}>Tracking no.</div>
                {order.trackingNo ? (
                  <div
                    style={{ ...tableText.body2, display: "flex", alignItems: "center", gap: 4 }}
                  >
                    {order.trackingNo}
                    <CopyButton value={order.trackingNo} label="tracking number" />
                  </div>
                ) : (
                  <div style={tableText.body2}>—</div>
                )}
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

          {/* Zone B is a read-only SUMMARY of RESOLVED claims — the active one is handled full-width in
              Zone A above and excluded here. Claims are raised by the customer, so there is no raise
              button; once a claim's resolution form is submitted it drops out of Zone A into here. */}
          <ClaimsSection
            claims={claims.filter((c) => c.id !== activeClaim?.id)}
            lines={lines}
            address={address}
            order={order}
            viewerIsSuperAdmin={viewerIsSuperAdmin}
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

          {/* The order's files — label, slip, claim evidence — each with View + Save. */}
          <DocumentsCard
            order={order}
            address={address}
            lines={lines}
            shop={shop}
            claims={claims}
            viewerIsSuperAdmin={viewerIsSuperAdmin}
            onError={setErr}
          />

          {/* Progress stepper: oldest → newest, dot on the current status (owner, 31 Jul). */}
          <div style={card}>
            <div style={sectionTitle}>Timeline</div>
            {stages.map((s, i) => (
              <StepRow key={s.key} stage={s} last={i === stages.length - 1} />
            ))}
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
/** One-line address for a resolved exchange's ship-to. */
function claimAddress(a: OrderDetail["address"]): string {
  if (!a) return "—";
  return [
    a.recipientName,
    a.phone,
    a.addressLine1,
    a.subdistrict,
    a.district,
    a.province,
    a.postalCode,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Zone B: a read-only SUMMARY of RESOLVED claims. Claims are raised by the customer (no admin raise
 * button) and driven to resolution in Zone A above; once a claim's resolution form is submitted it
 * finishes and drops in here as one card — the defect details + evidence + the outcome (refund slip,
 * or the replacement/return shipment). Hidden entirely when there is nothing to summarise.
 */
function ClaimsSection({
  claims,
  lines,
  address,
  order,
  viewerIsSuperAdmin,
}: {
  claims: OrderDetail["claims"];
  lines: OrderDetail["lines"];
  address: OrderDetail["address"];
  order: OrderDetail["order"];
  viewerIsSuperAdmin: boolean;
}) {
  if (claims.length === 0) return null;

  const nameFor = (c: OrderDetail["claims"][number]) =>
    c.lines.length > 0
      ? c.lines
          .map((cl) => lines.find((l) => l.id === cl.salesOrderLineId)?.name ?? cl.salesOrderLineId)
          .join(", ")
      : lines
          .map((l) => l.name)
          .filter(Boolean)
          .join(", ");

  return (
    <div style={card}>
      <div style={sectionTitle}>สรุปการเคลม</div>
      {claims.map((c, i) => {
        const state = isClaimState(c.state) ? c.state : null;
        const isRefund = c.resolution === "refund";
        const isReturn = c.state === "mechanic_rejected";
        const shipTo = c.replacementAddress ?? address;
        return (
          <div
            key={c.id}
            style={
              i > 0
                ? { marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }
                : undefined
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginBottom: 6,
              }}
            >
              <span className="pill off">{state ? claimStateLabelTh(state) : c.state}</span>
              <span style={tableText.subtitle}>{dt(c.createdAt)}</span>
            </div>

            <div style={{ fontSize: 14, lineHeight: 1.9 }}>
              <div>
                <span style={tableText.subtitle}>สินค้า</span> · {nameFor(c) || "—"}
              </div>
              {/* What the customer asked for, and the detail they submitted for it — kept even on a
                  rejected claim so the whole request is on record. */}
              {c.resolution && (
                <>
                  <div>
                    <span style={tableText.subtitle}>ลูกค้าเลือก</span> ·{" "}
                    {isRefund ? "รับเงินคืน" : "เปลี่ยนสินค้าใหม่"}
                  </div>
                  {isRefund ? (
                    <div>
                      <span style={tableText.subtitle}>บัญชีรับเงินคืน</span> ·{" "}
                      {!viewerIsSuperAdmin
                        ? "เฉพาะผู้ดูแลระดับสูง"
                        : order.refundAccountNo
                          ? `${order.refundBankName} · ${order.refundAccountNo} · ${order.refundAccountName}`
                          : "—"}
                    </div>
                  ) : (
                    <div>
                      <span style={tableText.subtitle}>ที่อยู่จัดส่ง</span> · {claimAddress(shipTo)}
                    </div>
                  )}
                </>
              )}
              {c.reasonNote && (
                <div>
                  <span style={tableText.subtitle}>เหตุผลลูกค้า</span> · {c.reasonNote}
                </div>
              )}
              {/* The mechanic on the case — shown for an approved claim AND a rejected one. */}
              {(c.assigneeName || c.mechanicName) && (
                <div>
                  <span style={tableText.subtitle}>ช่างผู้รับผิดชอบ</span> ·{" "}
                  {c.assigneeName || c.mechanicName}
                </div>
              )}
              {isReturn && c.adminNote && (
                <div>
                  <span style={tableText.subtitle}>เหตุผลปฏิเสธ</span> · {c.adminNote}
                </div>
              )}
            </div>

            {c.photoKeys.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {c.photoKeys.map((k) =>
                  /\.(mp4|mov|webm|m4v)$/i.test(k) ? (
                    <video
                      key={k}
                      src={privateFileUrl(k)}
                      controls
                      style={{
                        width: 120,
                        height: 72,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "#000",
                      }}
                    />
                  ) : (
                    <a key={k} href={privateFileUrl(k)} target="_blank" rel="noreferrer">
                      <img
                        src={privateFileUrl(k)}
                        alt="หลักฐานการเคลม"
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: "cover",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </a>
                  ),
                )}
              </div>
            )}

            {/* the outcome */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
              {isRefund ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    คืนเงินแล้ว{" "}
                    {order.refundSatang != null ? formatBahtTrim(order.refundSatang) : ""}
                  </div>
                  <div style={tableText.subtitle}>
                    {order.refundedAt ? dt(order.refundedAt) : "—"}
                    {order.refundActorEmail ? ` · ${order.refundActorEmail}` : ""}
                  </div>
                  {viewerIsSuperAdmin && order.refundSlipImageKey && (
                    <img
                      src={privateFileUrl(order.refundSlipImageKey)}
                      alt="สลิปการคืนเงิน"
                      style={{
                        marginTop: 8,
                        maxWidth: 220,
                        width: "100%",
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                      }}
                    />
                  )}
                </>
              ) : c.trackingNo ? (
                <>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {isReturn ? "ส่งสินค้าคืนลูกค้าแล้ว" : "จัดส่งสินค้าใหม่แล้ว"}
                  </div>
                  <div style={tableText.subtitle}>
                    {[c.carrier, c.trackingNo].filter(Boolean).join(" · ")}
                    {c.shippingFeeSatang != null
                      ? ` · ค่าจัดส่ง ${formatBahtTrim(c.shippingFeeSatang)}`
                      : ""}
                  </div>
                </>
              ) : (
                <div style={tableText.subtitle}>ปิดการเคลมแล้ว</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
