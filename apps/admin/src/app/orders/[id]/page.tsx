import { EMPTY_SHOP_INFO, fetchOrderDetail, fetchShopInfo } from "@/lib/api";
import { PageHeader } from "../../PageHeader";
import { OrderDetailView } from "./OrderDetailView";
import { serverT } from "@/lib/serverLang";

export const dynamic = "force-dynamic";

/**
 * Full detail for one AirPlus order — the subpage the /orders list links to.
 *
 * Mostly read-only. The exceptions are the ones the owner asked to run from here: the claim process,
 * the staff note, and — while the order is waiting to go out — the parcel label and the drop-off
 * record. Bulk fulfilment editing still lives on the old Sales tab.
 */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await serverT();
  const { id } = await params;

  // "airplus", NOT "denair": the barcode-label page prints at the workshop counter and uses the Den
  // Air identity, but a parcel for a storefront order is sent BY AirPlus and the sender block on the
  // label has to say so. Non-fatal — a label with an empty sender still beats no page at all.
  const shop = await fetchShopInfo("airplus").catch(() => EMPTY_SHOP_INFO);

  let detail;
  try {
    detail = await fetchOrderDetail(id);
  } catch (err) {
    return (
      <main>
        <PageHeader title={t({ th: "ออเดอร์", en: "Order" })} />
        <p style={{ color: "var(--danger)" }}>
          {t({ th: "โหลดออเดอร์ไม่สำเร็จ", en: "Could not load order" })}: {(err as Error).message}
        </p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main>
        <PageHeader
          title={t({ th: "ไม่พบออเดอร์", en: "Order not found" })}
          subtitle={t({
            th: "หน้านี้แสดงเฉพาะออเดอร์ AirPlus",
            en: "This page covers AirPlus orders only.",
          })}
        />
        <div className="empty">
          <div className="empty-icon">🧾</div>
          {t({
            th: "ไม่มีออเดอร์ AirPlus รหัสนี้ · ออเดอร์ Shopee อยู่ที่หน้าการเงิน",
            en: "No AirPlus order with that id. Shopee orders live on Sales.",
          })}
        </div>
      </main>
    );
  }

  return <OrderDetailView detail={detail} shop={shop} />;
}
