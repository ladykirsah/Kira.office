import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/lib/config";
import {
  fetchCars,
  fetchDrafts,
  fetchProducts,
  fetchServices,
  readShopAccounts,
  type CarBrand,
  type OpenDraft,
  type ProductRow,
  type ReceiveAccount,
  type ServiceRow,
} from "@/lib/posApi";
import { todaysSaleNumbers } from "@/lib/scanApi";
import { useAuth } from "../AppProviders";

/** What ทำบิล reads once and keeps: the shop's parts, services, cars, accounts, drafts, numbers. */
export interface PosData {
  products: ProductRow[];
  services: ServiceRow[];
  cars: CarBrand[];
  shopName: string;
  accounts: ReceiveAccount[];
  drafts: OpenDraft[];
  /** Bill numbers the server has issued, so a new one follows today's highest. */
  issuedNumbers: (string | null)[];
  /** The last load failed — most often no internet. The page still works from what it has. */
  offline: boolean;
  reload: () => Promise<void>;
  reloadDrafts: () => Promise<void>;
}

export function usePosData(): PosData {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [cars, setCars] = useState<CarBrand[]>([]);
  const [shopName, setShopName] = useState("");
  const [accounts, setAccounts] = useState<ReceiveAccount[]>([]);
  const [drafts, setDrafts] = useState<OpenDraft[]>([]);
  const [issuedNumbers, setIssuedNumbers] = useState<(string | null)[]>([]);
  const [offline, setOffline] = useState(false);

  const reloadDrafts = useCallback(async () => {
    if (!token) return;
    try {
      setDrafts(await fetchDrafts(fetch, API_BASE, token));
    } catch {
      setOffline(true);
    }
  }, [token]);

  const reload = useCallback(async () => {
    if (!token) return;
    // Each list on its own: one that fails (no internet, a slow server) leaves the others usable.
    const results = await Promise.allSettled([
      fetchProducts(fetch, API_BASE, token).then(setProducts),
      fetchServices(fetch, API_BASE, token).then(setServices),
      fetchCars(fetch, API_BASE, token).then(setCars),
      readShopAccounts(fetch, API_BASE, token).then((s) => {
        setShopName(s.name);
        setAccounts(s.accounts);
      }),
      fetchDrafts(fetch, API_BASE, token).then(setDrafts),
      todaysSaleNumbers(fetch, API_BASE, token).then(setIssuedNumbers),
    ]);
    setOffline(results.some((r) => r.status === "rejected"));
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    products,
    services,
    cars,
    shopName,
    accounts,
    drafts,
    issuedNumbers,
    offline,
    reload,
    reloadDrafts,
  };
}
