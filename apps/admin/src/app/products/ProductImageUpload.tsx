"use client";

import { useState, type ChangeEvent } from "react";
import { uploadProductImage } from "@/lib/api";

export function ProductImageUpload({ productId }: { productId: string }) {
  const [status, setStatus] = useState("");

  async function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Uploading…");
    try {
      await uploadProductImage(productId, file);
      setStatus("✓");
      location.reload();
    } catch (err) {
      setStatus((err as Error).message);
    }
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} />
      <small style={{ color: "#555" }}>{status}</small>
    </span>
  );
}
