import { apiBase, fetchSales } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { SalesTable } from "./SalesTable";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  let sales;
  try {
    sales = await fetchSales();
  } catch (err) {
    return (
      <main>
        <h1>Sales</h1>
        <p style={{ color: "var(--danger)" }}>Could not load sales: {(err as Error).message}</p>
      </main>
    );
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotalSatang, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.grossProfitSatang, 0);

  return (
    <main>
      <h1>Sales ({sales.length})</h1>
      <p>
        Revenue <strong>{formatBaht(totalRevenue)}</strong> · gross profit{" "}
        <strong>{formatBaht(totalProfit)}</strong> ·{" "}
        <a href={`${apiBase}/sales/export.csv`}>Download CSV</a>
      </p>
      <SalesTable sales={sales} />
    </main>
  );
}
