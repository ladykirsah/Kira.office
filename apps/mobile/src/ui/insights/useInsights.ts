import type { InsightPeriod, MetricKey } from "@l-shopee/core";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { toggleSeries, type InsightsPayload } from "@/lib/insightPage";
import { fetchInsights } from "@/lib/insightsApi";
import { useAuth } from "../AppProviders";

/**
 * What ภาพรวม AirPlus remembers: the period, its numbers, and which tiles draw the graph (ยอดขาย
 * and กำไร to start, as drawn). Coming back to the page loads it again.
 */
export function useInsights(start: InsightPeriod = "realtime") {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [period, setPeriod] = useState<InsightPeriod>(start);
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [lines, setLines] = useState<MetricKey[]>(["sales", "profit"]);
  // Only the newest request may fill the page: a slow answer for the old period never wins.
  const asked = useRef(0);

  const load = useCallback(
    async (which: InsightPeriod) => {
      if (!token) return;
      const ask = ++asked.current;
      setData(null);
      setFailed(false);
      try {
        const out = await fetchInsights(fetch, API_BASE, token, which);
        if (ask === asked.current) setData(out);
      } catch {
        if (ask === asked.current) setFailed(true);
      }
    },
    [token],
  );

  useFocusEffect(
    useCallback(() => {
      void load(period);
    }, [load, period]),
  );

  return {
    period,
    setPeriod,
    data,
    failed,
    reload: () => void load(period),
    lines,
    tapTile: (key: MetricKey) => setLines((now) => toggleSeries(now, key)),
  };
}

export type Insights = ReturnType<typeof useInsights>;
