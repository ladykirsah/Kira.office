"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  apiBase,
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
import { useToast } from "../../../ToastProvider";
import { ProductGallery } from "../../ProductGallery";
import { BarcodePreview } from "../../BarcodePreview";
import { PricingFields, type PricingForm } from "../../PricingFields";
import { CampaignWorkspace } from "../../CampaignWorkspace";
import { ProfitPeek } from "../../ProfitPeek";
import { PartDetails, type PartForm } from "../../PartDetails";
import { formatUpdatedAt } from "@/lib/format";
import { FitmentSection } from "../../FitmentSection";
import { totalCostSatang, commissionFeeSatang, profitSatang } from "@/lib/pricing";

const field = { display: "grid", gap: 4 } as const;
const n0 = (x: number | undefined | null): number => (Number.isFinite(x) ? (x as number) : 0);
const thb = (satang: number) => (n0(satang) / 100).toFixed(2);
const baht = (satang: number) => `฿${thb(satang)}`;
const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 3 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

const groupHead = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  marginBottom: 12,
} as const;

function PriceProfit({ price, profit }: { price: number; profit: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {baht(price)}
      <ProfitPeek value={profit} />
    </span>
  );
}

function yearStr(f: Fitment): string {
  if (f.yearFrom && f.yearTo) return `${f.yearFrom}–${f.yearTo}`;
  if (f.yearFrom) return `${f.yearFrom}+`;
  if (f.yearTo) return `–${f.yearTo}`;
  return "";
}

function StaticFrames({ images, name }: { images: ProductDetail["images"]; name: string }) {
  if (images.length === 0) {
    return (
      <span
        style={{
          width: 92,
          height: 92,
          borderRadius: 10,
          background: "var(--hover)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-faint)",
          fontSize: 28,
        }}
      >
        📦
      </span>
    );
  }
  return (
    <div className="frames">
      {images.map((img, i) => (
        <div className="frame" key={img.id}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${apiBase}/img/${img.imageKey}`} alt={name} />
          {i === 0 && <span className="cover-badge">Cover</span>}
        </div>
      ))}
    </div>
  );
}

export default function EditProductPage() {
  const id = useParams().id as string;
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [shopeeItemId, setShopeeItemId] = useState("");
  const [productRef, setProductRef] = useState("");
  const [active, setActive] = useState(true);
  const [weightKg, setWeightKg] = useState("");
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
    setBarcode(d.barcode ?? "");
    setShopeeItemId(d.product.shopeeItemId ?? "");
    setProductRef(d.product.productRef ?? "");
    setPart({
      brand: d.product.brandName ?? "",
      usage: d.product.usageName ?? "",
      type: d.product.typeName ?? "",
    });
    setActive(d.product.status === "active");
    setWeightKg(d.product.weightGrams ? (d.product.weightGrams / 1000).toString() : "");
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

  async function save(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      await updateProduct(id, {
        name,
        status: active ? "active" : "draft",
        shopeeListed: active, // one "Active" toggle = active on-site AND listed on Shopee
        shopeeItemId,
        productRef,
        weightGrams: Math.round((parseFloat(weightKg) || 0) * 1000),
        barcode,
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
        // Stock is ledger-based: setting a new on-hand records an adjustment for the difference.
        const target = Math.round(parseFloat(stockQty) || 0);
        const current = detail?.onHand ?? 0;
        if (detail && target !== current) {
          const res = await adjustStock({
            productVariantId: detail.variantId,
            quantityDelta: target - current,
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
          <a href="/products">← Products</a>
        </p>
      </main>
    );

  const p = detail.product;
  const pr = detail.pricing;

  // Campaign workspace baseline = total cost + the saved online default's profit (live, edit mode).
  const editTC = totalCostSatang(toSatang(pricing.costThb), pricing.taxOnCost);
  const editOnline = toSatang(pricing.onlineThb);
  const editCommBp = Math.round((parseFloat(pricing.onlineCommPct) || 0) * 100);
  const editDefaultProfit = profitSatang(
    editOnline,
    editTC,
    commissionFeeSatang(editOnline, editCommBp),
  );

  // Read-only (view mode) profits from the saved pricing.
  const vTC = pr ? totalCostSatang(pr.itemCostSatang, Boolean(pr.taxOnCost)) : 0;
  const vOnlineProfit = pr
    ? profitSatang(
        pr.onlinePriceSatang,
        vTC,
        commissionFeeSatang(pr.onlinePriceSatang, pr.onlineCommissionBp),
      )
    : 0;
  const vB2cProfit = pr ? profitSatang(pr.targetPriceSatang, vTC, 0) : 0;
  const vB2bProfit = pr ? profitSatang(pr.b2bPriceSatang, vTC, 0) : 0;

  // Part-detail tags: prefer the structured brand/system/part, else split the legacy category text.
  const structured = [p.brandName, p.usageName, p.typeName].filter(Boolean) as string[];
  const partTags = structured.length
    ? structured
    : p.category
      ? p.category.split(" · ").filter(Boolean)
      : [];

  const overviewGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))",
    gap: "20px 36px",
    alignItems: "start",
  } as const;

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
        <h1 style={{ margin: 0 }}>{p.name}</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
          <button
            type="button"
            onClick={() => {
              if (editing) {
                if (detail) hydrate(detail); // discard unsaved edits
                setEditing(false); // back to view mode (stay on the product)
              } else {
                router.push("/products");
              }
            }}
          >
            {editing ? "Cancel" : "Back"}
          </button>
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
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {p.updatedAt ? `Last updated date: ${formatUpdatedAt(p.updatedAt)}` : p.productCode}
      </p>

      {editing ? (
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
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="switch">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              <span className="slider" />
            </span>
            <span>Active</span>
          </label>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
            <label style={field}>
              Stock on hand
              <input
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                style={{ width: 140 }}
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
                style={{ width: 140 }}
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
      ) : (
        <>
          <div style={{ margin: "12px 0 18px" }}>
            <StaticFrames images={detail.images} name={p.name} />
          </div>
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 18px",
              background: "var(--surface)",
            }}
          >
            <div style={overviewGrid}>
              {/* Column 1 — Status & stock, then Part & spec */}
              <div>
                <div style={groupHead}>Status &amp; stock</div>
                <Field label="Status">
                  <span className={active ? "pill on" : "pill off"}>
                    {active ? "Active" : "Draft"}
                  </span>
                </Field>
                <Field label="Stock on hand">
                  <strong style={{ fontSize: 20 }}>{detail.onHand ?? 0}</strong>
                </Field>

                <div
                  style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}
                >
                  <div style={groupHead}>Part &amp; spec</div>
                  <Field label="Part details">
                    {partTags.length ? (
                      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                        {partTags.map((t, i) => (
                          <span key={i} className="tag">
                            {t}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Field>
                  <Field label="Weight">{p.weightGrams ? `${p.weightGrams / 1000} kg` : "—"}</Field>
                </div>
              </div>

              {/* Column 2 — Identifiers */}
              <div>
                <div style={groupHead}>Identifiers</div>
                <Field label="Barcode">
                  {detail.barcode ? <BarcodePreview value={detail.barcode} /> : "—"}
                </Field>
                <Field label="Product ID">{p.productRef || "—"}</Field>
                <Field label="Shopee ID">{p.shopeeItemId || "—"}</Field>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))",
              gap: 18,
              alignItems: "start",
            }}
          >
            {/* Pricing — left column */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "12px 16px",
                background: "var(--surface)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Pricing</div>
              {[
                {
                  label: "Online · default",
                  price: n0(pr?.onlinePriceSatang),
                  profit: vOnlineProfit,
                },
                { label: "On-site · B2C", price: n0(pr?.targetPriceSatang), profit: vB2cProfit },
                { label: "On-site · B2B", price: n0(pr?.b2bPriceSatang), profit: vB2bProfit },
              ].map((t) => (
                <div
                  key={t.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "10px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div className="muted" style={{ width: 150, flexShrink: 0 }}>
                    {t.label}
                  </div>
                  <div>{pr ? <PriceProfit price={t.price} profit={t.profit} /> : "—"}</div>
                </div>
              ))}
            </div>

            {/* Fits these cars — right column */}
            {detail.fitments.length > 0 && (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  background: "var(--surface)",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Fits these cars</div>
                <table className="ftbl">
                  <colgroup>
                    <col style={{ width: "34%" }} />
                    <col style={{ width: "34%" }} />
                    <col style={{ width: "32%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Brand</th>
                      <th>Model</th>
                      <th>Years</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.fitments.map((f, i) => (
                      <tr key={i}>
                        <td>{f.carBrand || "—"}</td>
                        <td>{f.carModel || "—"}</td>
                        <td>{yearStr(f) || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
