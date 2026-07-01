"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { inputL, inputS } from "@/lib/inputStyles";
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
import { CopyButton } from "../../CopyButton";
import { PricingFields, type PricingForm } from "../../PricingFields";
import { CampaignWorkspace } from "../../CampaignWorkspace";
import { ProfitPeek } from "../../ProfitPeek";
import { PartDetails, type PartForm } from "../../PartDetails";
import { formatUpdatedAt } from "@/lib/format";
import { FitmentSection } from "../../FitmentSection";
import { DeleteProductCard } from "../../DeleteProductCard";
import { totalCostSatang, commissionFeeSatang, profitSatang } from "@/lib/pricing";

const field = { display: "grid", gap: 4 } as const;
const n0 = (x: number | undefined | null): number => (Number.isFinite(x) ? (x as number) : 0);
const thb = (satang: number) => (n0(satang) / 100).toFixed(2);
const baht = (satang: number) => `฿${thb(satang)}`;
const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{children}</div>
    </div>
  );
}

const groupHead = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
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

/** View-mode gallery: a 224px main image (defaults to the cover) with 112px thumbnails to switch. */
function StaticFrames({ images, name }: { images: ProductDetail["images"]; name: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <span
        style={{
          width: 350,
          height: 350,
          borderRadius: 12,
          background: "var(--hover)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-faint)",
          fontSize: 72,
        }}
      >
        📦
      </span>
    );
  }

  const idx = Math.min(active, images.length - 1);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      {/* Column 1 — big frame */}
      <div
        style={{
          width: 350,
          height: 350,
          flex: "0 0 auto",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--hover)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${apiBase}/img/${images[idx].imageKey}`}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>
      {/* Column 2 — all thumbnails */}
      {images.length > 1 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexWrap: "wrap",
            height: 350,
            alignContent: "flex-start",
            gap: 10,
          }}
        >
          {images.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}${i === 0 ? " (cover)" : ""}`}
              style={{
                width: 110,
                height: 110,
                padding: 0,
                minHeight: 0,
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--hover)",
                border: i === idx ? "2px solid var(--primary)" : "1px solid var(--border)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${apiBase}/img/${img.imageKey}`}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </button>
          ))}
        </div>
      )}
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
  const [description, setDescription] = useState("");
  const [shopeeItemId, setShopeeItemId] = useState("");
  const [productRef, setProductRef] = useState("");
  const [shopeeActive, setShopeeActive] = useState(true);
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

  // Deep-link straight into edit mode: the products-table "Edit" action links with ?edit=1.
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
        {p.updatedAt ? `Last updated date: ${formatUpdatedAt(p.updatedAt)}` : p.productRef}
      </p>

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
        <>
          <div style={{ margin: "12px 0 18px" }}>
            <StaticFrames images={detail.images} name={p.name} />
          </div>
          {p.description && (
            <p className="muted" style={{ margin: "-6px 0 18px", fontSize: 14 }}>
              {p.description}
            </p>
          )}
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "16px 18px",
              background: "var(--surface)",
            }}
          >
            <div style={overviewGrid}>
              {/* Column 1 — Part & stock */}
              <div>
                <div style={groupHead}>Part &amp; Stock</div>
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
                <Field label="Stock on hand">
                  <strong style={{ fontSize: 20 }}>{detail.onHand ?? 0}</strong>
                </Field>
                <Field label="Weight">{p.weightGrams ? `${p.weightGrams / 1000} kg` : "—"}</Field>
              </div>

              {/* Column 2 — Identifiers */}
              <div>
                <div style={groupHead}>Identifiers</div>
                <Field label="Product ID">
                  {p.productRef ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        {p.productRef}
                        <CopyButton value={p.productRef} label="Product ID" />
                      </span>
                      <BarcodePreview value={p.productRef} />
                    </div>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Shopee ID">
                  {p.shopeeItemId ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {p.shopeeItemId}
                      <CopyButton value={p.shopeeItemId} label="Shopee ID" />
                    </span>
                  ) : (
                    "—"
                  )}
                </Field>
                <Field label="Shopee">
                  <span className={shopeeActive ? "pill on" : "pill off"}>
                    {shopeeActive ? "Active on Shopee" : "Not listed"}
                  </span>
                </Field>
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
