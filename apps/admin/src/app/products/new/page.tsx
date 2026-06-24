"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createProduct,
  updateProduct,
  adjustStock,
  fetchAttributes,
  type Attributes,
} from "@/lib/api";
import { useToast } from "../../ToastProvider";
import { PartDetails, type PartForm } from "../PartDetails";

const field = { display: "grid", gap: 4 } as const;

/** Add product: collects the same core info as the editor (name, status, stock, weight, part details)
 *  so a product can be catalogued up front; photos / pricing / fitments are added on the edit page. */
export default function NewProductPage() {
  const router = useRouter();
  const toast = useToast();
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(false);
  const [stockQty, setStockQty] = useState("0");
  const [weightKg, setWeightKg] = useState("");
  const [part, setPart] = useState<PartForm>({ brand: "", usage: "", type: "" });
  const [productRef, setProductRef] = useState("");
  const [barcode, setBarcode] = useState("");
  const [shopeeItemId, setShopeeItemId] = useState("");
  const [attributes, setAttributes] = useState<Attributes | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAttributes()
      .then(setAttributes)
      .catch(() => setAttributes(null));
  }, []);

  const updatePart = (patch: Partial<PartForm>) => setPart((prev) => ({ ...prev, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await createProduct({ productCode, name, barcode: barcode || undefined });
      if (!out.created) {
        toast(`A product with code “${productCode}” already exists`, "info");
        setBusy(false);
        return;
      }
      // Fill the rest with the same fields the editor saves.
      await updateProduct(out.productId, {
        name,
        status: active ? "active" : "draft",
        shopeeListed: active,
        shopeeItemId: shopeeItemId || undefined,
        productRef: productRef || undefined,
        weightGrams: Math.round((parseFloat(weightKg) || 0) * 1000),
        brandName: part.brand || undefined,
        usageName: part.usage || undefined,
        typeName: part.type || undefined,
      });
      const stock = Math.round(parseFloat(stockQty) || 0);
      if (out.variantId && stock > 0) {
        await adjustStock({
          productVariantId: out.variantId,
          quantityDelta: stock,
          movementType: "initial_stock",
          reason: "created from Add product",
        });
      }
      toast(`Created “${productCode}”`, "success");
      router.push(`/products/${out.productId}/edit`);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Add product</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        <label style={field}>
          Product code *
          <input value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
        </label>
        <label style={field}>
          Product name *
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="switch">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span className="slider" />
          </span>
          <span>Active</span>
        </label>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <label style={field}>
            Stock on hand
            <input
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              inputMode="numeric"
              style={{ width: 160 }}
            />
          </label>
          <label style={field}>
            Weight (kg)
            <input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              style={{ width: 160 }}
            />
          </label>
        </div>

        <PartDetails
          value={part}
          onChange={updatePart}
          attributes={attributes}
          barcode={barcode}
          onBarcodeChange={setBarcode}
          productRef={productRef}
          onProductRefChange={setProductRef}
          shopeeItemId={shopeeItemId}
          onShopeeItemIdChange={setShopeeItemId}
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={busy}
          style={{ justifySelf: "start" }}
        >
          Save
        </button>
      </form>
      <p>
        <a href="/products">← Products</a>
      </p>
    </main>
  );
}
