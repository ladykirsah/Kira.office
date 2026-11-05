import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/config";
import { fetchShopeeFees, saveShopeeFees, type ShopeeFees } from "@/lib/shopeeFees";
import { useAuth } from "../AppProviders";

/** ค่าคอม Shopee: the shop's Shopee fees, fresh each time the page comes back into view. */
export function useShopeeFees() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const owner = auth.status === "signed-in" && auth.staff.role === "super_admin";
  const [fees, setFees] = useState<ShopeeFees | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setFees(await fetchShopeeFees(fetch, API_BASE, token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** The owner's บันทึก: the page then shows what the server kept. Throws so the sheet can say so. */
  const save = useCallback(
    async (next: ShopeeFees) => setFees(await saveShopeeFees(fetch, API_BASE, token, next)),
    [token],
  );

  return { fees, failed, owner, load, save };
}

export type ShopeeFeesState = ReturnType<typeof useShopeeFees>;
