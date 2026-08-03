import Link from "next/link";
import { PageHeader } from "./PageHeader";
import { fetchOrders, fetchShopeeWorklist, type ShopeeWorklistItem } from "@/lib/api";
import { shopeeWorklistErrorText } from "@/lib/shopeeWorklist";
import { DASHBOARD_CARDS } from "@/lib/dashboardCards";
import { ShopeeWorklist } from "./ShopeeWorklist";
import {
  ORDER_SUMMARY_CARDS,
  orderSummaryCardLabel,
  summaryCardCounts,
  summaryCardHref,
  type SummaryCardKey,
} from "@/lib/orderSummaryCards";
import {
  summaryCard,
  summaryLabel,
  summaryNumber,
  summaryNumberColor,
} from "@/lib/summaryCardStyles";

// The counts are live order data, so the dashboard renders per request rather than being cached — the
// same reason /orders is force-dynamic.
export const dynamic = "force-dynamic";

const sectionLabel = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
} as const;

export default async function DashboardPage() {
  // The dashboard must open even when the order API is down — a broken counts fetch drops the frame to
  // a quiet line and leaves the nav grid working, rather than erroring the whole page.
  let counts: Record<SummaryCardKey, number> | null = null;
  try {
    counts = summaryCardCounts(await fetchOrders());
  } catch {
    counts = null;
  }

  // Products the owner still owes Shopee a stock update for. A failure must NOT collapse into an
  // empty list: "no work" and "we couldn't look" are different answers, and only one of them means
  // the Shopee stock is safe to leave alone. Keep the reason and show it.
  let worklist: ShopeeWorklistItem[] = [];
  let worklistError: string | null = null;
  try {
    worklist = await fetchShopeeWorklist();
  } catch (e) {
    worklistError = shopeeWorklistErrorText(e);
  }

  return (
    <main>
      <PageHeader title="Dashboard" subtitle="Welcome back. Here's what's waiting." />

      {/* The /orders summary frame, duplicated: each card carries its live count and links to the
          same filtered Orders view clicking it there would open. */}
      <section aria-label="Needs your action" style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <h2 style={sectionLabel}>Needs your action</h2>
          <Link
            href="/orders"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            Open Orders →
          </Link>
        </div>

        {counts ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {ORDER_SUMMARY_CARDS.map((card) => {
              const value = counts![card.key];
              return (
                <a
                  key={card.key}
                  href={summaryCardHref(card)}
                  style={{
                    ...summaryCard,
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div style={summaryLabel}>{orderSummaryCardLabel(card)}</div>
                  <div
                    style={{ ...summaryNumber, color: summaryNumberColor(value, card.activeColor) }}
                  >
                    {value}
                  </div>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="muted" style={{ fontSize: 14 }}>
            Order counts are unavailable right now.
          </div>
        )}
      </section>

      {/* Always on the dashboard, even with nothing to do (owner's request, 2026-08-03): a section
          that disappears can't be trusted — you can't tell "nothing to update" from "the block is
          gone again". Three answers, never mixed: the checklist, "No updates.", or why we failed. */}
      <section aria-label="Update on Shopee" style={{ marginTop: 34 }}>
        <div style={{ ...sectionLabel, marginBottom: 12 }}>Update on Shopee</div>
        {worklistError ? (
          <div className="empty">
            <div className="empty-icon" aria-hidden>
              ⚠
            </div>
            <span style={{ color: "var(--danger)" }}>{worklistError}</span>
          </div>
        ) : (
          <ShopeeWorklist rows={worklist} />
        )}
      </section>

      <div style={{ ...sectionLabel, marginTop: 34, marginBottom: 12 }}>Go to</div>
      <div className="card-grid">
        {DASHBOARD_CARDS.map((s) => (
          <a key={s.href} href={s.href} className="card">
            <div style={{ fontSize: 28, lineHeight: 1 }} aria-hidden>
              {s.icon}
            </div>
            <div style={{ fontWeight: 600, marginTop: 10 }}>{s.title}</div>
            <div className="muted" style={{ fontSize: 14 }}>
              {s.desc}
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
