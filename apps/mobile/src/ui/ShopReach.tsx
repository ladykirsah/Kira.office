import type { ShopReach } from "@l-shopee/shared/nav";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { API_BASE } from "@/lib/config";
import { readShopReach } from "@/lib/shopInfoApi";
import { useAuth } from "./AppProviders";

const Reach = createContext<ShopReach | undefined>(undefined);

/**
 * Whether the shop the app is open on runs the AirPlus website (plan 10.3's cards), read once after
 * sign-in. Until it is known, the app acts as before: Den Air, with AirPlus (plan 11.5).
 */
export function ShopReachProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [reach, setReach] = useState<ShopReach | undefined>(undefined);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void readShopReach(fetch, API_BASE, token).then((read) => {
      if (live) setReach(read);
    });
    return () => {
      live = false;
    };
  }, [token]);
  return <Reach.Provider value={reach}>{children}</Reach.Provider>;
}

/** The shop's reach, or undefined while it is not known yet (callers then act as before). */
export function useShopReach(): ShopReach | undefined {
  return useContext(Reach);
}
