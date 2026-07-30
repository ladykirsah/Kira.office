import { fetchOrderDetail } from "@/lib/api";
import { PageHeader } from "../../PageHeader";
import { OrderDetailView } from "./OrderDetailView";

export const dynamic = "force-dynamic";

/**
 * Full detail for one AirPlus order — the subpage the /orders list links to.
 *
 * Read-only for the order itself (fulfilment editing still lives on the old Sales tab); the one
 * exception is claims, which carry actions here because the owner asked for the claim process to
 * run from this page.
 */
export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let detail;
  try {
    detail = await fetchOrderDetail(id);
  } catch (err) {
    return (
      <main>
        <PageHeader title="Order" />
        <p style={{ color: "var(--danger)" }}>Could not load order: {(err as Error).message}</p>
      </main>
    );
  }

  if (!detail) {
    return (
      <main>
        <PageHeader title="Order not found" subtitle="This page covers AirPlus orders only." />
        <div className="empty">
          <div className="empty-icon">🧾</div>
          No AirPlus order with that id. Shopee orders live on Sales.
        </div>
      </main>
    );
  }

  return <OrderDetailView detail={detail} />;
}
