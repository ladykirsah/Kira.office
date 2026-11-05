"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CatalogItem } from "@/lib/db";
import { MY_CAR_KEY, fitsQuery, parseMyCar, serializeMyCar, type MyCar } from "@/lib/myCar";

/** The parts that fit the saved car (from GET /api/fits). */
export interface FitState {
  count: number;
  ids: ReadonlySet<string>;
  items: CatalogItem[];
}

interface MyCarContext {
  car: MyCar | null;
  /** false until localStorage has been read (avoids flashing "เลือกรุ่นรถของคุณ" for a saved car) */
  ready: boolean;
  fit: FitState | null;
  /** the fitting-parts list could not load (offline / server error) */
  fitFailed: boolean;
  saveCar: (car: MyCar) => void;
  clearCar: () => void;
}

const Ctx = createContext<MyCarContext>({
  car: null,
  ready: false,
  fit: null,
  fitFailed: false,
  saveCar: () => {},
  clearCar: () => {},
});

export const useMyCar = (): MyCarContext => useContext(Ctx);

function readStored(): MyCar | null {
  try {
    return parseMyCar(window.localStorage.getItem(MY_CAR_KEY));
  } catch {
    return null; // storage blocked (private mode) → behave as "no car"
  }
}

/** รถของฉัน for one page: reads the saved car from the shopper's own phone and loads what fits it. */
export function MyCarProvider({ children }: { children: React.ReactNode }) {
  const [car, setCar] = useState<MyCar | null>(null);
  const [ready, setReady] = useState(false);
  const [fit, setFit] = useState<FitState | null>(null);
  const [fitFailed, setFitFailed] = useState(false);

  useEffect(() => {
    setCar(readStored());
    setReady(true);
  }, []);

  useEffect(() => {
    setFit(null);
    setFitFailed(false);
    if (!car) return;
    const ctrl = new AbortController();
    fetch(`/api/fits?${fitsQuery(car)}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`fits ${r.status}`))))
      .then((d: { count: number; ids: string[]; items: CatalogItem[] }) =>
        setFit({ count: d.count, ids: new Set(d.ids), items: d.items }),
      )
      .catch((err: unknown) => {
        // A failed load only hides the count + fit lines; the car itself stays saved.
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("[my-car] could not load fitting parts", err);
        setFitFailed(true);
      });
    return () => ctrl.abort();
  }, [car]);

  const saveCar = useCallback((next: MyCar) => {
    try {
      window.localStorage.setItem(MY_CAR_KEY, serializeMyCar(next));
    } catch {
      /* storage blocked — still use the car for this visit */
    }
    setCar(next);
  }, []);

  const clearCar = useCallback(() => {
    try {
      window.localStorage.removeItem(MY_CAR_KEY);
    } catch {
      /* nothing saved to remove */
    }
    setCar(null);
  }, []);

  const value = useMemo(
    () => ({ car, ready, fit, fitFailed, saveCar, clearCar }),
    [car, ready, fit, fitFailed, saveCar, clearCar],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
