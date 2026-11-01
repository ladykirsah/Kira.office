import type { InsightPeriod } from "@l-shopee/core";
import type { InsightsPayload } from "./insightPage";
import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/** ภาพรวม AirPlus's one call: every number on the page for one period (GET /insights). */
export async function fetchInsights(
  fetchFn: FetchFn,
  base: string,
  token: string,
  period: InsightPeriod,
): Promise<InsightsPayload> {
  const res = await fetchFn(`${base}/insights?period=${period}`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Insight failed to load");
  return (await res.json()) as InsightsPayload;
}
