"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProduct,
  updateProduct,
  adjustStock,
  setProductPricing,
  fetchAttributes,
  type Attributes,
} from "@/lib/api";
import { useToast } from "../../ToastProvider";
import { PartDetails, type PartForm } from "../PartDetails";
import { ProductGallery } from "../ProductGallery";
import { PricingFields, type PricingForm, toSatang } from "../PricingFields";

const field = { display: "grid", gap: 4 } as const;

/** Add product — same sections as the editor (photos, part details, pricing). The product is created
 *  lazily on the first photo upload or on save; "Save draft" / "Save product" set the status. */
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
  const [pricing, setPricing] = useState<PricingForm>({
    costThb: "",
    taxOnCost: false,
    b2cThb: "",
    b2bThb: "",
    onlineThb: "",
    onlineCommPct: "",
  });
  const [attributes, setAttributes] = useState<Attributes | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Source of truth for the created product (sync, avoids stale state in async flows).
  const created = useRef<{ id: string; variantId: string | null } | null>(null);

  useEffect(() => {
    fetchAttributes()
      .then(setAttributes)
      .catch(() => setAttributes(null));
  }, []);

  const updatePart = (patch: Partial<PartForm>) => setPart((prev) => ({ ...prev, ...patch }));
  const updatePricing = (patch: Partial<PricingForm>) =>
    setPricing((prev) => ({ ...prev, ...patch }));

  /** Create the product once (for photo upload or save); returns its id, or null if it can't yet. */
  async function ensureProduct(): Promise<string | null> {
    if (created.current) return created.current.id;
    if (!productCode.trim() || !name.trim()) {
      toast("Enter a product code and name first", "error");
      return null;
    }
    const out = await createProduct({ productCode, name });
    if (!out.created) {
      toast(`A product with code “${productCode}” already exists`, "info");
      return null;
    }
    created.current = { id: out.productId, variantId: out.variantId };
    setCreatedId(out.productId);
    return out.productId;
  }

  async function submit(status: "draft" | "active") {
    setBusy(true);
    try {
      const id = await ensureProduct();
      if (!id) {
        setBusy(false);
        return;
      }
      await updateProduct(id, {
        name,
        status,
        shopeeListed: status === "active",
        shopeeItemId: shopeeItemId || undefined,
        productRef: productRef || undefined,
        barcode: barcode || undefined,
        weightGrams: Math.round((parseFloat(weightKg) || 0) * 1000),
        brandName: part.brand || undefined,
        usageName: part.usage || undefined,
        typeName: part.type || undefined,
      });
      await setProductPricing(id, {
        itemCostSatang: toSatang(pricing.costThb),
        targetPriceSatang: toSatang(pricing.b2cThb),
        onlinePriceSatang: toSatang(pricing.onlineThb),
        b2bPriceSatang: toSatang(pricing.b2bThb),
        onlineCommissionBp: Math.round((parseFloat(pricing.onlineCommPct) || 0) * 100),
        taxOnCost: pricing.taxOnCost,
      });
      const stock = Math.round(parseFloat(stockQty) || 0);
      const vid = created.current?.variantId ?? null;
      if (vid && stock > 0) {
        await adjustStock({
          productVariantId: vid,
          quantityDelta: stock,
          movementType: "initial_stock",
          reason: "created from Add product",
        });
      }
      toast(
        status === "active" ? `Saved “${productCode}”` : `Draft “${productCode}” saved`,
        "success",
      );
      router.push(`/products/${id}/edit`);
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
            style={{ minHeight: 44, padding: "10px 16px", fontSize: 15 }}
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
        New product — fitments are added on the edit page after saving.
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
        <div style={{ ...field, gridColumn: "1 / -1" }}>
          <span style={{ fontWeight: 600 }}>Photos</span>
          <ProductGallery
            productId={createdId ?? ""}
            initial={[]}
            ensureProductId={ensureProduct}
          />
        </div>

        <label style={{ ...field, gridColumn: "1 / -1" }}>
          Product code *
          <input
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            disabled={!!createdId}
            required
          />
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

        <div style={{ gridColumn: "1 / -1" }}>
          <PricingFields form={pricing} update={updatePricing} />
        </div>
      </form>
    </main>
  );
}
