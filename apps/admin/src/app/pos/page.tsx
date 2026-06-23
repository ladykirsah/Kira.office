"use client";

import { useState } from "react";
import { apiBase, lookupBarcode } from "@/lib/api";
import { formatBaht } from "@/lib/format";

interface CartLine {
  productVariantId: string;
  barcodeValue: string;
  name: string;
  quantity: number;
  unitPriceSatang: number;
}

// The scanned barcode is resolved to a real variant via GET /products/by-barcode/:code, so the
// stock ledger gets valid variant ids. Price/qty are entered at the counter. Offline outbox
// (IndexedDB queue + retry) is the next iteration.
export default function PosPage() {
  const [barcode, setBarcode] = useState("");
  const [priceThb, setPriceThb] = useState("");
  const [qty, setQty] = useState("1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const totalSatang = cart.reduce((sum, l) => sum + l.unitPriceSatang * l.quantity, 0);

  async function addLine() {
    const unitPriceSatang = Math.round(parseFloat(priceThb) * 100);
    const quantity = parseInt(qty, 10);
    if (!barcode || !Number.isFinite(unitPriceSatang) || unitPriceSatang <= 0 || quantity <= 0) {
      setStatus("Enter a barcode, a price and a quantity.");
      return;
    }
    setBusy(true);
    setStatus("Looking up…");
    try {
      const found = await lookupBarcode(barcode);
      if (!found) {
        setStatus(`Unknown barcode: ${barcode}`);
        return;
      }
      setCart((c) => [
        ...c,
        { productVariantId: found.variantId, barcodeValue: barcode, name: found.name, quantity, unitPriceSatang },
      ]);
      setStatus(`Added ${found.name}`);
      setBarcode("");
      setPriceThb("");
      setQty("1");
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (cart.length === 0) return;
    setBusy(true);
    setStatus("Syncing…");
    try {
      const res = await fetch(`${apiBase}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sales: [
            {
              clientUuid: crypto.randomUUID(),
              paymentMethod: "cash",
              lines: cart.map(({ productVariantId, barcodeValue, quantity, unitPriceSatang }) => ({
                productVariantId,
                barcodeValue,
                quantity,
                unitPriceSatang,
              })),
            },
          ],
        }),
      });
      setStatus(`Synced: ${JSON.stringify(await res.json())}`);
      setCart([]);
    } catch (err) {
      setStatus(`Sync failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>POS</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <input placeholder="Price (THB)" value={priceThb} onChange={(e) => setPriceThb(e.target.value)} />
        <input placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 64 }} />
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
      <button onClick={checkout} disabled={busy || cart.length === 0}>
        Checkout
      </button>
      <p style={{ color: "#555" }}>{status}</p>
    </main>
  );
}
