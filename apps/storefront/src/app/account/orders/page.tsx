import Link from "next/link";
import { redirect } from "next/navigation";
import { orderStatusBadge, type OrderBadgeTone } from "@l-shopee/core";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { baht, formatDateTime } from "@/lib/format";
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

interface OrderLineRow {
  orderId: string;
  variantId: string;
  qty: number;
  productId: string;
  name: string;
  productRef: string;
  imageKey: string | null;
  currentPriceSatang: number;
}

/**
 * The badge rules live in @l-shopee/core (orderStatusBadge) because they hinge on Thai statuses
 * being substrings of each other — "เตรียมจัดส่ง" contains "จัดส่ง" — which this page previously got
 * wrong, collapsing "still in the shop" and "on the truck" into one identical amber pill. They are
 * tested there; do not re-derive them here.
 *
 * The carrier + tracking number are deliberately NOT in the badge any more: a badge says what STATE
 * an order is in, and "Flash Express · TH1234567890" is a payload, not a state. Tracking still shows
 * on the order-detail page's จัดส่ง step, one tap away via ดูสถานะ.
 */
function statusPill(o: OrderRow): { cls: OrderBadgeTone; label: string } {
  const badge = orderStatusBadge({
    orderStatus: o.orderStatus,
    hasTracking: Boolean(o.carrier || o.trackingNo),
  });
  return { cls: badge.tone, label: badge.label };
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

  const linesByOrder = new Map<string, OrderLineRow[]>();
  if (orders.length > 0) {
    const lines =
      (
        await db
          .prepare(
            `SELECT l.sales_order_id AS orderId, l.product_variant_id AS variantId,
                  l.quantity AS qty, p.id AS productId, p.name AS name,
                  p.product_ref AS productRef, p.image_key AS imageKey,
                  COALESCE(pp.online_price_satang, 0) AS currentPriceSatang
           FROM sales_order_lines l
           JOIN product_variants v ON v.id = l.product_variant_id
           JOIN products p ON p.id = v.product_id
           LEFT JOIN pricing_profiles pp ON pp.id =
             (SELECT id FROM pricing_profiles WHERE product_variant_id = v.id
              ORDER BY active_from DESC LIMIT 1)
           WHERE l.sales_order_id IN (${orders.map(() => "?").join(",")})`,
          )
          .bind(...orders.map((o) => o.id))
          .all<OrderLineRow>()
      ).results ?? [];
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
                      <OrderLineThumb key={l.variantId} imageKey={l.imageKey} name={l.name} />
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
