"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase, lookupBarcode } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { flushOutbox, type OutboxStore, type QueuedSale } from "@/lib/outbox";
import { createIdbStore } from "@/lib/outbox-idb";
import { useToast } from "../ToastProvider";

interface CartLine {
  productVariantId: string;
  barcodeValue: string;
  name: string;
  quantity: number;
  unitPriceSatang: number;
}

async function syncSale(sale: QueuedSale): Promise<boolean> {
  const res = await fetch(`${apiBase}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sales: [sale] }),
  });
  return res.ok;
}

// Offline-first: scanning resolves a real variant; checkout tries /sync and, if the network fails,
// queues the sale in IndexedDB and flushes automatically on reconnect (server dedupes on clientUuid).
export default function PosPage() {
  const toast = useToast();
  const [barcode, setBarcode] = useState("");
  const [priceThb, setPriceThb] = useState("");
  const [qty, setQty] = useState("1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);

  const storeRef = useRef<OutboxStore | null>(null);
  if (!storeRef.current) storeRef.current = createIdbStore();
  const store = storeRef.current;

  useEffect(() => {
    let cancelled = false;
    async function flush() {
      const r = await flushOutbox(store, syncSale);
      if (cancelled) return;
      if (r.synced) toast(`Synced ${r.synced} queued sale(s)`, "success");
      setPending((await store.all()).length);
    }
    flush();
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const totalSatang = cart.reduce((sum, l) => sum + l.unitPriceSatang * l.quantity, 0);

  async function addLine() {
    const unitPriceSatang = Math.round(parseFloat(priceThb) * 100);
    const quantity = parseInt(qty, 10);
    if (!barcode || !Number.isFinite(unitPriceSatang) || unitPriceSatang <= 0 || quantity <= 0) {
      toast("Enter a barcode, a price and a quantity.", "error");
      return;
    }
    setBusy(true);
    try {
      const found = await lookupBarcode(barcode);
      if (!found) {
        toast(`Unknown barcode: ${barcode}`, "error");
        return;
      }
      setCart((c) => [
        ...c,
        {
          productVariantId: found.variantId,
          barcodeValue: barcode,
          name: found.name,
          quantity,
          unitPriceSatang,
        },
      ]);
      toast(`Added ${found.name}`, "success");
      setBarcode("");
      setPriceThb("");
      setQty("1");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (cart.length === 0) return;
    setBusy(true);
    const sale: QueuedSale = {
      clientUuid: crypto.randomUUID(),
      paymentMethod: "cash",
      lines: cart.map(({ productVariantId, barcodeValue, quantity, unitPriceSatang }) => ({
        productVariantId,
        barcodeValue,
        quantity,
        unitPriceSatang,
      })),
      queuedAt: Date.now(),
    };
    try {
      if (await syncSale(sale)) {
        toast("Sold ✓", "success");
        setCart([]);
      } else {
        toast("Server rejected the sale — check the items and try again.", "error");
      }
    } catch {
      await store.add(sale);
      setCart([]);
      setPending((await store.all()).length);
      toast("Offline — sale saved, will sync automatically when back online.", "info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>POS</h1>
      {pending > 0 && (
        <p style={{ color: "var(--warn)" }}>
          ⏳ {pending} sale(s) queued offline — will sync when online.
        </p>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <input
          placeholder="Price (THB)"
          value={priceThb}
          onChange={(e) => setPriceThb(e.target.value)}
        />
        <input
          placeholder="Qty"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={{ width: 64 }}
        />
        <button onClick={addLine} disabled={busy}>
          Add
        </button>
      </div>
      <ul>
        {cart.map((l, i) => (
          <li key={i}>
            {l.name} ({l.barcodeValue}) ×{l.quantity} @ {formatBaht(l.unitPriceSatang)}
          </li>
        ))}
      </ul>
      <p>
        <strong>Total: {formatBaht(totalSatang)}</strong>
      </p>
      <button className="btn-primary" onClick={checkout} disabled={busy || cart.length === 0}>
        Checkout
      </button>
    </main>
  );
}
