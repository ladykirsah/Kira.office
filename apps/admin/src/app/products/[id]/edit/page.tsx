"use client";

import { useEffect, useState, type FormEvent } from "react";
import { inputL, inputS } from "@/lib/inputStyles";
import { cmToMm, mmToCm } from "@/lib/parcel";
import { useParams } from "next/navigation";
import {
  getProductDetail,
  updateProduct,
  setProductPricing,
  fetchAttributes,
  fetchCarFitment,
  adjustStock,
  type ProductDetail,
  type Attributes,
  type Fitment,
  type CarBrandTree,
} from "@/lib/api";
import { PageHeader } from "../../../PageHeader";
import { BackLink } from "../../../BackLink";
import { useToast } from "../../../ToastProvider";
import { ProductGallery } from "../../ProductGallery";
import { PricingFields, type PricingForm } from "../../PricingFields";
import { CampaignWorkspace } from "../../CampaignWorkspace";
import { ProductView } from "../../ProductView";
import { PartDetails, type PartForm } from "../../PartDetails";
import { formatUpdatedAt } from "@/lib/format";
import { FitmentSection } from "../../FitmentSection";
import { DeleteProductCard } from "../../DeleteProductCard";
import { totalCostSatang, commissionFeeSatang, profitSatang } from "@/lib/pricing";

const field = { display: "grid", gap: 4 } as const;
const n0 = (x: number | undefined | null): number => (Number.isFinite(x) ? (x as number) : 0);
const thb = (satang: number) => (n0(satang) / 100).toFixed(2);
const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);

export default function EditProductPage() {
  const id = useParams().id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shopeeItemId, setShopeeItemId] = useState("");
  const [productRef, setProductRef] = useState("");
  const [shopeeActive, setShopeeActive] = useState(true);
  const [weightKg, setWeightKg] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [attributes, setAttributes] = useState<Attributes | null>(null);
  const [carTree, setCarTree] = useState<CarBrandTree[]>([]);
  const [part, setPart] = useState<PartForm>({ brand: "", usage: "", type: "" });
  const updatePart = (patch: Partial<PartForm>) => setPart((prev) => ({ ...prev, ...patch }));
  const [fitments, setFitments] = useState<Fitment[]>([]);
  const [pricing, setPricing] = useState<PricingForm>({
    costThb: "",
    taxOnCost: false,
    b2cThb: "",
    b2bThb: "",
    onlineThb: "",
    onlineCommPct: "",
  });
  const updatePricing = (patch: Partial<PricingForm>) =>
    setPricing((prev) => ({ ...prev, ...patch }));

  function hydrate(d: ProductDetail) {
    setName(d.product.name);
    setDescription(d.product.description ?? "");
    setShopeeItemId(d.product.shopeeItemId ?? "");
    setProductRef(d.product.productRef ?? "");
    setPart({
      brand: d.product.brandName ?? "",
      usage: d.product.usageName ?? "",
      type: d.product.typeName ?? "",
    });
    setShopeeActive(Boolean(d.product.shopeeListed));
    setWeightKg(d.product.weightGrams ? (d.product.weightGrams / 1000).toString() : "");
    setWidthCm(mmToCm(d.product.widthMm));
    setLengthCm(mmToCm(d.product.lengthMm));
    setHeightCm(mmToCm(d.product.heightMm));
    setStockQty(String(d.onHand ?? 0));
    setFitments(d.fitments ?? []);
    setPricing({
      costThb: d.pricing ? thb(d.pricing.itemCostSatang) : "",
      taxOnCost: d.pricing ? Boolean(d.pricing.taxOnCost) : false,
      b2cThb: d.pricing ? thb(d.pricing.targetPriceSatang) : "",
      b2bThb: d.pricing ? thb(d.pricing.b2bPriceSatang) : "",
      onlineThb: d.pricing ? thb(d.pricing.onlinePriceSatang) : "",
      onlineCommPct:
        d.pricing && d.pricing.onlineCommissionBp
          ? (d.pricing.onlineCommissionBp / 100).toString()
          : "",
    });
  }

  async function load() {
    try {
      const [d, attrs, cars] = await Promise.all([
        getProductDetail(id),
        fetchAttributes(),
        fetchCarFitment(),
      ]);
      setDetail(d);
      setAttributes(attrs);
      setCarTree(cars);
      hydrate(d);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Deep-link straight into edit mode: the products-table "Edit" action and the view page's Edit
  // button link with ?edit=1.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("edit") === "1") setEditing(true);
  }, []);

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (!productRef.trim()) {
      toast("Product ID is required", "error");
      return;
    }
    setBusy(true);
    try {
      await updateProduct(id, {
        name,
        description,
        // "Active on Shopee" = listed live on Shopee. ON also makes the product active on-site (a
        // live product can't be a draft); OFF leaves the on-site status unchanged (→ "Not listed").
        status: shopeeActive ? "active" : (detail?.product.status ?? "active"),
        shopeeListed: shopeeActive,
        shopeeItemId,
        productRef,
        weightGrams: Math.round((parseFloat(weightKg) || 0) * 1000),
        widthMm: cmToMm(widthCm),
        lengthMm: cmToMm(lengthCm),
        heightMm: cmToMm(heightCm),
        // The barcode is the Product ID (one identifier).
        barcode: productRef.trim(),
        brandName: part.brand,
        usageName: part.usage,
        typeName: part.type,
        fitments,
      });
      if (detail?.variantId) {
        await setProductPricing(id, {
          itemCostSatang: toSatang(pricing.costThb),
          targetPriceSatang: toSatang(pricing.b2cThb),
          onlinePriceSatang: toSatang(pricing.onlineThb),
          b2bPriceSatang: toSatang(pricing.b2bThb),
          onlineCommissionBp: Math.round((parseFloat(pricing.onlineCommPct) || 0) * 100),
          taxOnCost: pricing.taxOnCost,
        });
        // Stock is ledger-based: setting a new on-hand records an adjustment for the difference —
        // computed by the server against a fresh read, since `detail.onHand` is from page load.
        const target = Math.round(parseFloat(stockQty) || 0);
        if (detail && target !== (detail.onHand ?? 0)) {
          const res = await adjustStock({
            productVariantId: detail.variantId,
            countedOnHand: target,
            movementType: "manual_adjustment",
            reason: "edited from product page",
          });
          if (!res.applied) toast(res.reason ?? "Stock not changed", "error");
        }
      }
      toast("Saved ✓", "success");
      await load();
      setEditing(false);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main>
        <h1>Product</h1>
        <div className="skeleton skeleton-row" style={{ width: "50%" }} />
        <div className="skeleton skeleton-row" style={{ width: "90%" }} />
        <div className="skeleton skeleton-row" style={{ width: "70%" }} />
      </main>
    );

  if (!detail)
    return (
      <main>
        <h1>Product</h1>
        <p className="muted">Not found.</p>
        <p>
          <BackLink href="/products">Products</BackLink>
        </p>
      </main>
    );

  const p = detail.product;

  // Campaign workspace baseline = total cost + the saved online default's profit (live, edit mode).
  const editTC = totalCostSatang(toSatang(pricing.costThb), pricing.taxOnCost);
  const editOnline = toSatang(pricing.onlineThb);
  const editCommBp = Math.round((parseFloat(pricing.onlineCommPct) || 0) * 100);
  const editDefaultProfit = profitSatang(
    editOnline,
    editTC,
    commissionFeeSatang(editOnline, editCommBp),
  );

  return (
    <main>
      <PageHeader
        title={p.name}
        subtitle={p.updatedAt ? `Last updated date: ${formatUpdatedAt(p.updatedAt)}` : p.productRef}
        below={editing ? undefined : <BackLink href="/products">Products</BackLink>}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  if (detail) hydrate(detail); // discard unsaved edits
                  setEditing(false); // back to view mode (stay on the product)
                }}
              >
                Cancel
              </button>
            )}
            {editing ? (
              <button type="button" className="btn-primary" onClick={() => save()} disabled={busy}>
                Save
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>
        }
      />

      {editing ? (
        <>
          <form
            onSubmit={save}
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(440px, 100%), 1fr))",
              alignItems: "start",
            }}
          >
            <div style={{ ...field, gridColumn: "1 / -1" }}>
              <span style={{ fontWeight: 600 }}>Photos</span>
              <ProductGallery productId={id} initial={detail.images} />
            </div>

            <label style={field}>
              Product name *
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={inputL}
              />
            </label>

            <label style={field}>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Short spec — refrigerant, type, fitment note…"
                style={{ width: "100%", resize: "vertical" }}
              />
            </label>

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
              <label style={field}>
                Stock on hand
                <input
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  style={{ ...inputS, width: 140 }}
                />
                <small className="muted">
                  now {detail.onHand ?? 0} · change logged as adjustment
                </small>
              </label>
              <label style={field}>
                Weight (kg)
                <input
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="0"
                  style={{ ...inputS, width: 140 }}
                />
              </label>
              {/* Box size, not part size — carriers rate on volumetric weight (w×l×h/5000). */}
              <label style={field}>
                Box size (cm) — W × L × H
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {(
                    [
                      ["W", widthCm, setWidthCm],
                      ["L", lengthCm, setLengthCm],
                      ["H", heightCm, setHeightCm],
                    ] as const
                  ).map(([label, value, set], i) => (
                    <span key={label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {i > 0 && <span style={{ opacity: 0.5 }}>×</span>}
                      <input
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        inputMode="decimal"
                        placeholder={label}
                        aria-label={`Box ${label} in centimetres`}
                        style={{ ...inputS, width: 64 }}
                      />
                    </span>
                  ))}
                </span>
              </label>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <PartDetails
                value={part}
                onChange={updatePart}
                attributes={attributes}
                productRef={productRef}
                onProductRefChange={setProductRef}
                shopeeItemId={shopeeItemId}
                onShopeeItemIdChange={setShopeeItemId}
                shopeeActive={shopeeActive}
                onShopeeActiveChange={setShopeeActive}
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <FitmentSection fitments={fitments} onChange={setFitments} carTree={carTree} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <PricingFields form={pricing} update={updatePricing} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <CampaignWorkspace
                totalCostSatang={editTC}
                defaultProfitSatang={editDefaultProfit}
                defaultPriceSatang={editOnline}
              />
            </div>
          </form>
          <DeleteProductCard productId={id} />
        </>
      ) : (
        <ProductView detail={detail} />
      )}
    </main>
  );
}
