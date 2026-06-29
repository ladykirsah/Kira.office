"use client";

import { useEffect, useState } from "react";
import { checkIdentifier, type IdentifierKind } from "@/lib/api";

/** Debounced check: warn if another product already uses this identifier. */
export function useIdentifierCheck(
  kind: IdentifierKind,
  value: string,
  excludeProductId?: string,
): string | null {
  const [warn, setWarn] = useState<string | null>(null);
  useEffect(() => {
    const v = value.trim();
    if (!v) {
      setWarn(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const m = await checkIdentifier(kind, v);
        if (!cancelled) {
          setWarn(
            m && m.id !== excludeProductId
              ? `Already used by “${m.name}” (${m.productCode} · ${m.status})`
              : null,
          );
        }
      } catch {
        if (!cancelled) setWarn(null);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, value, excludeProductId]);
  return warn;
}

/** Barcode and ID is stored as product_ref and synced to barcode — check both. */
export function useBarcodeAndIdCheck(value: string, excludeProductId?: string): string | null {
  const refWarn = useIdentifierCheck("ref", value, excludeProductId);
  const barcodeWarn = useIdentifierCheck("barcode", value, excludeProductId);
  return refWarn ?? barcodeWarn;
}
