import { fetchFinanceSummary } from "@/lib/api";
import { formatBaht } from "@/lib/format";

export const dynamic = "force-dynamic";

const card = {
  border: "1px solid #eee",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
} as const;

export default async function FinancePage() {
  let s;
  try {
    s = await fetchFinanceSummary();
  } catch (err) {
    return (
      <main>
        <h1>Finance</h1>
        <p style={{ color: "crimson" }}>Could not load: {(err as Error).message}</p>
      </main>
    );
  }

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div style={card}>
      <div style={{ color: "#777", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    </div>
  );

  return (
    <main>
      <h1>Finance summary</h1>
      <p style={{ color: "#555" }}>On-site sales, all time.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Card label="Revenue" value={formatBaht(s.revenueSatang)} />
        <Card label="Gross profit" value={formatBaht(s.grossProfitSatang)} />
        <Card label="VAT collected" value={formatBaht(s.vatSatang)} />
        <Card label="Sales" value={String(s.salesCount)} />
        <Card label="Refunds" value={`${s.refundCount} · ${formatBaht(s.refundedSatang)}`} />
      </div>
    </main>
  );
}
