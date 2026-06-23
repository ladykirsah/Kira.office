"use client";

import { useState, type FormEvent } from "react";
import { createProduct } from "@/lib/api";
import { useToast } from "../../ToastProvider";

const field = { display: "grid", gap: 4 } as const;

export default function NewProductPage() {
  const toast = useToast();
  const [productCode, setProductCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const out = await createProduct({
        productCode,
        name,
        description: description || undefined,
        barcode: barcode || undefined,
      });
      if (out.created) {
        toast(`Created “${productCode}”`, "success");
        setProductCode("");
        setName("");
        setDescription("");
        setBarcode("");
      } else {
        toast(`A product with code “${productCode}” already exists`, "info");
      }
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Add product</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 440 }}>
        <label style={field}>
          Product code *
          <input value={productCode} onChange={(e) => setProductCode(e.target.value)} required />
        </label>
        <label style={field}>
          Name *
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label style={field}>
          Description
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label style={field}>
          Barcode (optional)
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
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
