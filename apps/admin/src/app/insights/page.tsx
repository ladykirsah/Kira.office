import { INSIGHT_PERIODS, isInsightPeriod, type InsightPeriod } from "@l-shopee/core";
import { fetchInsights } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { InsightBoard } from "./InsightBoard";

/**
 * AirPlus Insight — Kira's answer to Shopee's Business Insights (ภาพรวมทั้งหมด).
 *
 * Server component so the whole payload arrives with the HTML: the owner opens this page to read
 * numbers, and a spinner followed by a layout shift is the wrong first impression for a page whose
 * entire job is numbers. The period is a URL parameter rather than client state — bookmarkable,
 * shareable, back-button-correct, and it matches the repo's convention of passing `searchParams`
 * from a server page instead of reaching for `useSearchParams`.
 *
 * Only the tile→chart interaction is client-side, in InsightBoard.
 */

export const dynamic = "force-dynamic";

const PERIOD_LABELS: Record<InsightPeriod, string> = {
  realtime: "Real-time",
  yesterday: "เมื่อวาน",
  "7d": "ย้อนหลัง 7 วัน",
  "30d": "ย้อนหลัง 30 วัน",
  month: "ภายในเดือนนี้",
};

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const requested = (await searchParams).period ?? "";
  const period: InsightPeriod = isInsightPeriod(requested) ? requested : "realtime";

  let payload;
  try {
    payload = await fetchInsights(period);
  } catch {
    // Degrade to a quiet line rather than an error page — the same choice the dashboard makes when
    // its counts are unavailable. A back office that throws is worse than one that admits a gap.
    return (
      <>
        <PageHeader title="AirPlus Insight" subtitle="ภาพรวมร้าน AirPlus" />
        <p className="muted">ยังโหลดข้อมูลไม่ได้ ลองใหม่อีกครั้ง</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="AirPlus Insight"
        subtitle="ภาพรวมทั้งหมด — ยอดขาย กำไร และการเข้าชมร้าน AirPlus"
      />

      {/* Period chips. Plain links, so each period is its own URL and the back button works. */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 24,
          overflowX: "auto",
        }}
      >
        {INSIGHT_PERIODS.map((p) => {
          const active = p === period;
          return (
            <a
              key={p}
              href={`/insights?period=${p}`}
              className="btn-sm"
              style={{
                textDecoration: "none",
                whiteSpace: "nowrap",
                // Red marks the ONE period you are looking at — nothing else on this page is coral.
                borderColor: active ? "var(--primary)" : "var(--border)",
                background: active ? "var(--primary-faint)" : "var(--surface)",
                color: active ? "var(--primary)" : "var(--text-muted)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {PERIOD_LABELS[p]}
            </a>
          );
        })}
      </div>

      <InsightBoard payload={payload} />
    </>
  );
}
