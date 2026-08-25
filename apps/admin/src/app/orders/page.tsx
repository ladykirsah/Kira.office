import { fetchOrders } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { OrdersTable } from "./OrdersTable";
import { serverT } from "@/lib/serverLang";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  // Next 15 hands searchParams in as a promise. `?card=` is the dashboard's deep-link into the summary
  // frame; read it on the server and pass it down, so OrdersTable never needs useSearchParams.
  searchParams: Promise<{ card?: string }>;
}) {
  const t = await serverT();
  const { card } = await searchParams;

  let orders;
  try {
    orders = await fetchOrders();
  } catch (err) {
    return (
      <main>
        <h1>{t({ th: "ออเดอร์", en: "Orders" })}</h1>
        <p style={{ color: "var(--danger)" }}>
          {t({ th: "โหลดออเดอร์ไม่สำเร็จ", en: "Could not load orders" })}: {(err as Error).message}
        </p>
      </main>
    );
  }

  const airplusCount = orders.filter((o) => o.channel === "airplus").length;

  return (
    <main>
      <PageHeader
        title={`${t({ th: "ออเดอร์", en: "Orders" })} (${airplusCount})`}
        subtitle={t({ th: "จัดการออเดอร์ AirPlus", en: "AirPlus order management" })}
      />
      <OrdersTable orders={orders} initialCardKey={card ?? null} />
    </main>
  );
}
