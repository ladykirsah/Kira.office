"use client";

import { useEffect, useState } from "react";
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

/** Add product: same layout + fields as the editor. "Save draft" / "Save product" set the status;
 *  photos / pricing / fitments are added on the edit page you land on after saving. */
export default function NewProductPage() {
  const router = useRouter();
  const toast = useToast();
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
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

  async function submit(status: "draft" | "active") {
    if (!productCode.trim() || !name.trim()) {
      toast("Product code and name are required", "error");
      return;
    }
    setBusy(true);
    try {
      const out = await createProduct({ productCode, name, barcode: barcode || undefined });
      if (!out.created) {
        toast(`A product with code “${productCode}” already exists`, "info");
        setBusy(false);
        return;
      }
      await updateProduct(out.productId, {
        name,
        status,
        shopeeListed: status === "active",
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
      toast(
        status === "active" ? `Saved “${productCode}”` : `Draft “${productCode}” saved`,
        "success",
      );
      router.push(`/products/${out.productId}/edit`);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusy(false);
    }
  }

  return (
    <main>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>Add product</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
          <button type="button" onClick={() => router.push("/products")} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-soft"
            onClick={() => submit("draft")}
            disabled={busy}
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => submit("active")}
            disabled={busy}
          >
            Save product
          </button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        New product — add photos, pricing and fitments after saving.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit("active");
        }}
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))",
          alignItems: "start",
        }}
      >
        <label style={{ ...field, gridColumn: "1 / -1" }}>
          Product code *
          <input value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
        </label>
        <label style={{ ...field, gridColumn: "1 / -1" }}>
          Product name *
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", gridColumn: "1 / -1" }}>
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

        <div style={{ gridColumn: "1 / -1" }}>
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
        </div>
      </form>
    </main>
  );
}
