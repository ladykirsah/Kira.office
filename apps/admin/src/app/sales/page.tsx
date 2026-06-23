import { apiBase, fetchSales } from "@/lib/api";
import { formatBaht } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  let sales;
  try {
    sales = await fetchSales();
  } catch (err) {
    return (
      <main>
        <h1>Sales</h1>
        <p style={{ color: "crimson" }}>Could not load sales: {(err as Error).message}</p>
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
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">When</th>
            <th align="left">Payment</th>
            <th align="right">Total</th>
            <th align="right">Profit</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((s) => (
            <tr key={s.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{new Date(s.createdAt).toLocaleString("th-TH")}</td>
              <td>{s.paymentMethod ?? "—"}</td>
              <td align="right">{formatBaht(s.grandTotalSatang)}</td>
              <td align="right">{formatBaht(s.grossProfitSatang)}</td>
              <td>{s.saleStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
