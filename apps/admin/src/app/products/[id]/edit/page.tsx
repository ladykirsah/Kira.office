"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { getProductDetail, updateProduct, setProductPricing } from "@/lib/api";
import { useToast } from "../../../ToastProvider";

const field = { display: "grid", gap: 4 } as const;
const thb = (satang: number) => (satang / 100).toFixed(2);

export default function EditProductPage() {
  const id = useParams().id as string;
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [costThb, setCostThb] = useState("");
  const [priceThb, setPriceThb] = useState("");
  const [variantId, setVariantId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const d = await getProductDetail(id);
        setCode(d.product.productCode);
        setName(d.product.name);
        setDescription(d.product.description ?? "");
        setStatus(d.product.status);
        setVariantId(d.variantId);
        if (d.pricing) {
          setCostThb(thb(d.pricing.itemCostSatang));
          setPriceThb(thb(d.pricing.targetPriceSatang));
        }
      } catch (err) {
        toast((err as Error).message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateProduct(id, { name, description: description || undefined, status });
      if (variantId && (costThb || priceThb)) {
        await setProductPricing(id, {
          itemCostSatang: Math.round((parseFloat(costThb) || 0) * 100),
          targetPriceSatang: Math.round((parseFloat(priceThb) || 0) * 100),
        });
      }
      toast("Saved ✓", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <main>
        <h1>Edit product</h1>
        <div className="skeleton skeleton-row" style={{ width: "50%" }} />
        <div className="skeleton skeleton-row" style={{ width: "90%" }} />
        <div className="skeleton skeleton-row" style={{ width: "70%" }} />
      </main>
    );

  return (
    <main>
      <h1>Edit product · {code}</h1>
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
          Target price (THB)
          <input value={priceThb} onChange={(e) => setPriceThb(e.target.value)} />
        </label>
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
