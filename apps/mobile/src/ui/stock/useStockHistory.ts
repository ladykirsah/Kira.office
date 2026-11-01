import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import type { CustomRange, DatePreset } from "@/lib/orderList";
import { fetchMovements } from "@/lib/stockApi";
import { periodOf, shownMovements, type Movement, type MovementKind } from "@/lib/stockHistory";
import { useAuth } from "../AppProviders";

type HistorySheet = "scan" | "range" | null;

/**
 * What ประวัติซื้อขาย remembers: the changes for the picked dates, the type button, what is typed or
 * scanned, the open sheet and the change being read. Opens on ทุกวัน, like Orders.
 */
export function useStockHistory() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [rows, setRows] = useState<Movement[] | null>(null);
  const [limit, setLimit] = useState(0);
  const [failed, setFailed] = useState(false);
  const [kind, setKind] = useState<MovementKind>("all");
  const [q, setQ] = useState("");
  const [date, setDate] = useState<DatePreset>("all");
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const [sheet, setSheet] = useState<HistorySheet>(null);
  const [open, setOpen] = useState<Movement | null>(null);
  // Only the newest request may fill the list: a slow answer for the old dates never wins.
  const asked = useRef(0);

  const load = useCallback(
    async (preset: DatePreset, range: CustomRange | null) => {
      if (!token) return;
      const ask = ++asked.current;
      setRows(null);
      setFailed(false);
      try {
        const out = await fetchMovements(
          fetch,
          API_BASE,
          token,
          periodOf(preset, range, Date.now()),
        );
        if (ask !== asked.current) return;
        setRows(out.movements);
        setLimit(out.limit);
      } catch {
        if (ask === asked.current) setFailed(true);
      }
    },
    [token],
  );

  // Coming back to the page shows what changed meanwhile (a sale, a refill); new dates load too.
  useFocusEffect(
    useCallback(() => {
      void load(date, custom);
    }, [load, date, custom]),
  );

  const pickDate = (preset: DatePreset, range: CustomRange | null = null) => {
    setDate(preset);
    setCustom(range);
  };

  /** A scanned code becomes the search: its product's changes, or "ไม่พบ" like a typed one. */
  const scanned = (code: string) => {
    setSheet(null);
    setQ(code.trim());
  };

  const clearSearch = () => {
    setQ("");
    setKind("all");
  };

  return {
    rows,
    shown: rows ? shownMovements(rows, { kind, q }) : null,
    limit,
    failed,
    reload: () => void load(date, custom),
    kind,
    setKind,
    q,
    setQ,
    date,
    custom,
    pickDate,
    sheet,
    setSheet,
    open,
    setOpen,
    scanned,
    clearSearch,
  };
}

export type StockHistory = ReturnType<typeof useStockHistory>;
