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
import { ProductImageUpload } from "../../ProductImageUpload";

const field = { display: "grid", gap: 4 } as const;
const thb = (satang: number) => (satang / 100).toFixed(2);
const baht = (satang: number) => `฿${thb(satang)}`;
const toSatang = (s: string) => Math.round((parseFloat(s) || 0) * 100);

function Img({ imageKey, alt }: { imageKey: string | null; alt: string }) {
  if (imageKey) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={`${apiBase}/img/${imageKey}`}
        alt={alt}
        width={64}
        height={64}
        style={{ objectFit: "cover", borderRadius: 8 }}
      />
    );
  }
  return (
    <span
      style={{
        width: 64,
        height: 64,
        borderRadius: 8,
        background: "var(--hover)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-faint)",
      }}
    >
      📦
    </span>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="muted">{label}</div>
      <div>{children}</div>
    </>
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
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [costThb, setCostThb] = useState("");
  const [offlineThb, setOfflineThb] = useState("");
  const [onlineThb, setOnlineThb] = useState("");
  const [shopeeListed, setShopeeListed] = useState(false);

  function hydrate(d: ProductDetail) {
    setName(d.product.name);
    setDescription(d.product.description ?? "");
    setStatus(d.product.status);
    setShopeeListed(Boolean(d.product.shopeeListed));
    setCostThb(d.pricing ? thb(d.pricing.itemCostSatang) : "");
    setOfflineThb(d.pricing ? thb(d.pricing.targetPriceSatang) : "");
    setOnlineThb(d.pricing ? thb(d.pricing.onlinePriceSatang) : "");
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
        description: description || undefined,
        status,
        shopeeListed,
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
    maxWidth: 480,
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
          maxWidth: 480,
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

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "12px 0 18px" }}>
        <Img imageKey={p.imageKey} alt={p.name} />
        {editing && <ProductImageUpload productId={id} />}
      </div>

      {editing ? (
        <form onSubmit={save} style={{ display: "grid", gap: 12, maxWidth: 440 }}>
          <label style={field}>
            Name *
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label style={field}>
            Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label style={field}>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="draft">draft</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label style={field}>
            Cost (THB)
            <input value={costThb} onChange={(e) => setCostThb(e.target.value)} />
          </label>
          <label style={field}>
            On-site price (THB)
            <input value={offlineThb} onChange={(e) => setOfflineThb(e.target.value)} />
          </label>
          <label style={field}>
            Online price — Shopee (THB)
            <input value={onlineThb} onChange={(e) => setOnlineThb(e.target.value)} />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={shopeeListed}
              onChange={(e) => setShopeeListed(e.target.checked)}
            />
            Listed on Shopee
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
        <div style={grid}>
          <Row label="Status">{p.status}</Row>
          <Row label="Description">{p.description || "—"}</Row>
          <Row label="Cost">{pr ? baht(pr.itemCostSatang) : "—"}</Row>
          <Row label="On-site price">{pr ? baht(pr.targetPriceSatang) : "—"}</Row>
          <Row label="Online (Shopee) price">{pr ? baht(pr.onlinePriceSatang) : "—"}</Row>
          <Row label="Listed on Shopee">
            <span className={p.shopeeListed ? "pill on" : "pill off"}>
              {p.shopeeListed ? "On Shopee" : "Not listed"}
            </span>
          </Row>
        </div>
      )}

      <p style={{ marginTop: 18 }}>
        <a href="/products">← Products</a>
      </p>
    </main>
  );
}
