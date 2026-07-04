import { formatBahtTrim } from "@/lib/format";
import { PageHeader } from "../PageHeader";

const card = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "14px 18px",
  minWidth: 150,
} as const;

export default function AffiliatePage() {
  return (
    <main>
      <PageHeader
        title="Affiliate income"
        subtitle={
          <>
            Commission from promoting other sellers&rsquo; products — separate from your own product
            sales (no stock, no cost).
          </>
        }
      />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <div style={card}>
          <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Commission income</div>
          <div style={{ fontSize: 22, fontWeight: 600 }}>{formatBahtTrim(0)}</div>
        </div>
      </div>

      <div className="empty">
        <div className="empty-icon">🤝</div>No affiliate income recorded yet.
      </div>
    </main>
  );
}
