"use client";

import { useState } from "react";
import { apiBase } from "@/lib/api";
import { formatBaht } from "@/lib/format";

interface CartLine {
  productVariantId: string;
  barcodeValue: string;
  quantity: number;
  unitPriceSatang: number;
}

// NOTE: skeleton — uses the scanned barcode as the variant id placeholder. The full POS resolves
// barcode -> variant via the catalog and works offline (IndexedDB outbox) before syncing.
export default function PosPage() {
  const [barcode, setBarcode] = useState("");
  const [priceThb, setPriceThb] = useState("");
  const [qty, setQty] = useState("1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [status, setStatus] = useState("");

  const totalSatang = cart.reduce((sum, l) => sum + l.unitPriceSatang * l.quantity, 0);

  function addLine() {
    const unitPriceSatang = Math.round(parseFloat(priceThb) * 100);
    const quantity = parseInt(qty, 10);
    if (!barcode || !Number.isFinite(unitPriceSatang) || unitPriceSatang <= 0 || quantity <= 0) {
      setStatus("Enter a barcode, a price and a quantity.");
      return;
    }
    setCart((c) => [...c, { productVariantId: barcode, barcodeValue: barcode, quantity, unitPriceSatang }]);
    setBarcode("");
    setPriceThb("");
    setQty("1");
    setStatus("");
  }

  async function checkout() {
    if (cart.length === 0) return;
    setStatus("Syncing…");
    try {
      const res = await fetch(`${apiBase}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sales: [{ clientUuid: crypto.randomUUID(), paymentMethod: "cash", lines: cart }],
        }),
      });
      setStatus(`Synced: ${JSON.stringify(await res.json())}`);
      setCart([]);
    } catch (err) {
      setStatus(`Sync failed: ${(err as Error).message}`);
    }
  }

  return (
    <main>
      <h1>POS</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input placeholder="Barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        <input placeholder="Price (THB)" value={priceThb} onChange={(e) => setPriceThb(e.target.value)} />
        <input placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 64 }} />
        <button onClick={addLine}>Add</button>
      </div>
      <ul>
        {cart.map((l, i) => (
          <li key={i}>
            {l.barcodeValue} ×{l.quantity} @ {formatBaht(l.unitPriceSatang)}
          </li>
        ))}
      </ul>
      <p>
        <strong>Total: {formatBaht(totalSatang)}</strong>
      </p>
      <button onClick={checkout} disabled={cart.length === 0}>
        Checkout
      </button>
      <p style={{ color: "#555" }}>{status}</p>
    </main>
  );
}
