import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchOrderDetail, type OrderDetail } from "@/lib/ordersApi";

export type OrderLoad =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "missing" }
  | { status: "ready"; detail: OrderDetail };

/** One order from the API — for its page and its files' own pages — with a way to load it again. */
export function useOrderDetail(
  id: string,
  token: string | null,
): { load: OrderLoad; reload: () => void } {
  const [load, setLoad] = useState<OrderLoad>({ status: "loading" });
  const reload = useCallback(() => {
    if (!token) return;
    fetchOrderDetail(fetch, API_BASE, token, id)
      .then((detail) => setLoad(detail ? { status: "ready", detail } : { status: "missing" }))
      .catch((e: unknown) =>
        setLoad({ status: "failed", message: e instanceof Error ? e.message : String(e) }),
      );
  }, [id, token]);
  useEffect(reload, [reload]);
  return { load, reload };
}
