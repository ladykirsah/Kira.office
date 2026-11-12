import Link from "next/link";
import { redirect } from "next/navigation";
import {
  normalizeOrderStatus,
  normalizePaymentStatus,
  operationalStatus,
  operationalStatusLabelTh,
} from "@l-shopee/core";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { accountOrderLines, type AccountOrderLine } from "@/lib/orderLines";
import { baht, formatDateTime } from "@/lib/format";
import { sizeLabel } from "@/lib/sizePicker";
import { OrderLineThumb, ReorderButton, type ReorderLine } from "./ReorderButton";

export const dynamic = "force-dynamic";

/**
 * My orders — the logged-in customer's AirPlus order history, newest first. Reorder uses
 * CURRENT prices (latest pricing profile), never the historical order price; "ดูสถานะ"
 * deep-links into the existing (ref, phone) tracking page.
 */

interface OrderRow {
  id: string;
  ref: string;
  orderStatus: string | null;
  paymentStatus: string | null;
  totalSatang: number;
  createdAt: number | null;
  carrier: string | null;
  trackingNo: string | null;
}

/**
 * The order-history pill. Derived from BOTH status axes via operationalStatus, so it can finally tell
 * an unpaid order from a paid-and-packing one — the old version read only orderStatus and showed both
 * as the same grey รอดำเนินการ, giving the customer no pay-now signal on this page at all.
 *
 * It also normalizes first. The old version matched Thai substrings, so after migration 0069 every
 * order would have fallen through to that same grey pill: delivered, cancelled and brand-new all
 * looking identical.
 */
function statusPill(o: OrderRow): { cls: "good" | "warn" | "bad" | "soft"; label: string } {
  const state = operationalStatus(
    normalizeOrderStatus(o.orderStatus),
    normalizePaymentStatus(o.paymentStatus),
  );

  // While a parcel is moving, the carrier and tracking are more useful to the customer than the word.
  if (state === "in_transit") {
    const detail = [o.carrier, o.trackingNo].filter(Boolean).join(" · ");
    return { cls: "warn", label: detail || operationalStatusLabelTh("in_transit") };
  }

  if (state === null) return { cls: "soft", label: "รอดำเนินการ" };

  const CLS: Record<string, "good" | "warn" | "bad" | "soft"> = {
    complete: "good",
    claimed: "good",
    unpaid: "warn",
    verifying: "warn",
    cod_pending: "warn",
    to_ship: "warn",
    claim_pending: "warn",
    fail: "bad",
    return: "bad",
    cod_reject: "bad",
    refunded: "bad",
    claim_rejected: "bad",
  };
  return { cls: CLS[state] ?? "soft", label: operationalStatusLabelTh(state) };
}

export default async function AccountOrdersPage() {
  const customer = await getSession();
  if (!customer) redirect(`/login?next=${encodeURIComponent("/account/orders")}`);

  const db = await getDb();
  const orders =
    (
      await db
        .prepare(
          `SELECT id, external_order_id AS ref, order_status AS orderStatus,
                payment_status AS paymentStatus, grand_total_satang AS totalSatang,
                order_created_at AS createdAt, carrier, tracking_no AS trackingNo
         FROM sales_orders
         WHERE storefront_customer_id = ? AND channel = 'airplus'
         ORDER BY order_created_at DESC LIMIT 50`,
        )
        .bind(customer.id)
        .all<OrderRow>()
    ).results ?? [];

  const linesByOrder = new Map<string, AccountOrderLine[]>();
  if (orders.length > 0) {
    const lines = await accountOrderLines(
      db,
      orders.map((o) => o.id),
    );
    for (const line of lines) {
      const list = linesByOrder.get(line.orderId) ?? [];
      list.push(line);
      linesByOrder.set(line.orderId, list);
    }
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <div className="section">
        <h1 className="t-h1" style={{ margin: "0 0 4px" }}>
          คำสั่งซื้อของฉัน
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          ประวัติการสั่งซื้อทั้งหมดของบัญชีนี้
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>ยังไม่มีคำสั่งซื้อ</p>
          <Link href="/products" className="btn btn-primary">
            เลือกซื้อสินค้า
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12 }}>
          {orders.map((o) => {
            const pill = statusPill(o);
            const lines = linesByOrder.get(o.id) ?? [];
            const reorderLines: ReorderLine[] = lines.map((l) => ({
              variantId: l.variantId,
              productId: l.productId,
              name: l.name,
              productRef: l.productRef,
              priceSatang: l.currentPriceSatang,
              imageKey: l.imageKey,
              ...(l.choiceValue ? { choiceLabel: l.choiceValue } : {}),
              qty: l.qty,
            }));
            return (
              <div key={o.id} className="card" style={{ padding: 16 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <span className="t-h4">{o.ref}</span>
                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                </div>
                {o.createdAt !== null && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                    สั่งซื้อเมื่อ {formatDateTime(o.createdAt)}
                  </div>
                )}
                {lines.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {lines.map((l) => (
                      <OrderLineThumb
                        key={l.variantId}
                        imageKey={l.imageKey}
                        name={l.choiceValue ? `${l.name} · ${sizeLabel(l.choiceValue)}` : l.name}
                      />
                    ))}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: 12,
                    paddingTop: 12,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span className="muted" style={{ fontSize: 13 }}>
                    ยอดรวม
                  </span>
                  <span className="t-price-m">{baht(o.totalSatang)}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <Link
                    href={`/orders?ref=${encodeURIComponent(o.ref)}&phone=${encodeURIComponent(customer.phone)}`}
                    className="btn"
                    style={{ flex: 1, textAlign: "center" }}
                  >
                    ดูสถานะ
                  </Link>
                  {reorderLines.length > 0 && <ReorderButton lines={reorderLines} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
