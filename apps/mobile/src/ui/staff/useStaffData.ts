import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/config";
import type { PayRow, PaymentMonth } from "@/lib/staffPage";
import {
  fetchActivity,
  fetchDaysOff,
  fetchPayments,
  fetchSalary,
  type ActivityRow,
  type DayOff,
} from "@/lib/teamApi";
import { useAuth } from "../AppProviders";

/**
 * One read for a tab or a sheet: the data, whether it failed, and load() to read it again. It reads
 * when the page comes into view and whenever what it asks for (`key`) or `stamp` (a save) changes.
 */
function useRead<T>(read: (token: string) => Promise<T>, key: string, stamp = 0) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [data, setData] = useState<{ key: string; value: T } | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const value = await read(token);
      setData({ key, value });
      setFailed(false);
    } catch {
      setFailed(true);
    }
    // `read` is rebuilt every render; `key` says what it asks for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key, stamp]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  // A month just switched shows nothing old while the new one loads.
  return { value: data?.key === key ? data.value : null, failed, load };
}

export function useSalary(month: string, stamp = 0) {
  const r = useRead<PayRow[]>((t) => fetchSalary(fetch, API_BASE, t, month), month, stamp);
  return { rows: r.value, failed: r.failed, load: r.load };
}

export function useDaysOff(month: string, stamp = 0, of?: string) {
  const r = useRead<DayOff[]>(
    (t) => fetchDaysOff(fetch, API_BASE, t, month, of),
    `${month}|${of ?? ""}`,
    stamp,
  );
  return { days: r.value, failed: r.failed, load: r.load };
}

export function useActivity(person: string | null, month: string, stamp = 0) {
  const r = useRead<ActivityRow[]>(
    (t) => fetchActivity(fetch, API_BASE, t, { person, month }),
    `${person ?? ""}|${month}`,
    stamp,
  );
  return { rows: r.value, failed: r.failed, load: r.load };
}

export function usePayments(id: string, stamp = 0) {
  const r = useRead<PaymentMonth[]>((t) => fetchPayments(fetch, API_BASE, t, id), id, stamp);
  return { months: r.value, failed: r.failed, load: r.load };
}
