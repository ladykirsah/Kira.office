"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  apiBase,
  getProductDetail,
  updateProduct,
  setProductPricing,
  type ProductDetail,
} from "@/lib/api";
import { useToast } from "../../../ToastProvider";
import { ProductGallery } from "../../ProductGallery";
import { BarcodePreview } from "../../BarcodePreview";

const field = { display: "grid", gap: 4 } as const;
const thb = (satang: number) => (satang / 100).toFixed(2);
const baht = (satang: number) => `฿${thb(satang)}`;
const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="muted">{label}</div>
      <div>{children}</div>
    </>
  );
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
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [shopeeItemId, setShopeeItemId] = useState("");
  const [category, setCategory] = useState("");
  const [active, setActive] = useState(true);
  const [costThb, setCostThb] = useState("");
  const [offlineThb, setOfflineThb] = useState("");
  const [onlineThb, setOnlineThb] = useState("");
  const [weightKg, setWeightKg] = useState("");

  function hydrate(d: ProductDetail) {
    setName(d.product.name);
    setBarcode(d.barcode ?? "");
    setShopeeItemId(d.product.shopeeItemId ?? "");
    setCategory(d.product.category ?? "");
    setActive(d.product.status === "active");
    setCostThb(d.pricing ? thb(d.pricing.itemCostSatang) : "");
    setOfflineThb(d.pricing ? thb(d.pricing.targetPriceSatang) : "");
    setOnlineThb(d.pricing ? thb(d.pricing.onlinePriceSatang) : "");
    setWeightKg(d.product.weightGrams ? (d.product.weightGrams / 1000).toString() : "");
  }

  async function load() {
    try {
      const d = await getProductDetail(id);
      setDetail(d);
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

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProduct(id, {
        name,
        status: active ? "active" : "draft",
        shopeeListed: active, // one "Active" toggle = active on-site AND listed on Shopee
        shopeeItemId,
        category,
        weightGrams: Math.round((parseFloat(weightKg) || 0) * 1000),
        barcode,
      });
      if (detail?.variantId && (costThb || offlineThb || onlineThb)) {
        await setProductPricing(id, {
          itemCostSatang: toSatang(costThb),
          targetPriceSatang: toSatang(offlineThb),
          onlinePriceSatang: toSatang(onlineThb),
        });
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

  function cancel() {
    if (detail) hydrate(detail);
    setEditing(false);
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
  const grid = {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: "10px 16px",
    maxWidth: 520,
    alignItems: "baseline",
  } as const;

  return (
    <main>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          maxWidth: 560,
        }}
      >
        <h1 style={{ margin: 0 }}>{p.name}</h1>
        {!editing && (
          <button className="btn-primary" onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        {p.productCode}
      </p>

      {editing ? (
        <form onSubmit={save} style={{ display: "grid", gap: 16, maxWidth: 560 }}>
          <div style={field}>
            <span style={{ fontWeight: 600 }}>Photos</span>
            <ProductGallery productId={id} initial={detail.images} />
          </div>

          <label style={field}>
            Product name *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label style={field}>
            Barcode
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="scan / type"
            />
            <BarcodePreview value={barcode} />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
            <label style={{ ...field, flex: 1 }}>
              Shopee ID (link)
              <input
                value={shopeeItemId}
                onChange={(e) => setShopeeItemId(e.target.value)}
                placeholder="Shopee item id"
              />
            </label>
            <label style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
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
          </div>

          <label style={field}>
            Category
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Air Conditioning"
            />
          </label>

          <div style={field}>
            <span style={{ fontWeight: 600 }}>Pricing</span>
            <table cellPadding={6} style={{ borderCollapse: "collapse", maxWidth: 380 }}>
              <tbody>
                <tr>
                  <td className="muted">Cost</td>
                  <td>
                    <input
                      value={costThb}
                      onChange={(e) => setCostThb(e.target.value)}
                      style={{ width: 140 }}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="muted">On-site price</td>
                  <td>
                    <input
                      value={offlineThb}
                      onChange={(e) => setOfflineThb(e.target.value)}
                      style={{ width: 140 }}
                    />
                  </td>
                </tr>
                <tr>
                  <td className="muted">Online (Shopee)</td>
                  <td>
                    <input
                      value={onlineThb}
                      onChange={(e) => setOnlineThb(e.target.value)}
                      style={{ width: 140 }}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <small className="muted">All prices in THB (฿). More pricing options later.</small>
          </div>

          <label style={field}>
            Weight (kg)
            <input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="0"
              style={{ width: 140 }}
            />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" className="btn-primary" disabled={busy}>
              Save
            </button>
            <button type="button" onClick={cancel} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <div style={{ margin: "12px 0 18px" }}>
            <StaticFrames images={detail.images} name={p.name} />
          </div>
          <div style={grid}>
            <Row label="Status">
              <span className={active ? "pill on" : "pill off"}>{active ? "Active" : "Draft"}</span>
            </Row>
            <Row label="Barcode">
              {detail.barcode ? <BarcodePreview value={detail.barcode} /> : "—"}
            </Row>
            <Row label="Shopee ID">{p.shopeeItemId || "—"}</Row>
            <Row label="Category">{p.category || "—"}</Row>
            <Row label="Cost">{pr ? baht(pr.itemCostSatang) : "—"}</Row>
            <Row label="On-site price">{pr ? baht(pr.targetPriceSatang) : "—"}</Row>
            <Row label="Online (Shopee) price">{pr ? baht(pr.onlinePriceSatang) : "—"}</Row>
            <Row label="Weight">{p.weightGrams ? `${p.weightGrams / 1000} kg` : "—"}</Row>
          </div>
        </>
      )}

      <p style={{ marginTop: 18 }}>
        <a href="/products">← Products</a>
      </p>
    </main>
  );
}
