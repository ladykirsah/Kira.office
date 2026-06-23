"use client";

import { useState } from "react";
import { apiBase, type ProductRow } from "@/lib/api";
import { ProductImageUpload } from "./ProductImageUpload";
import { ArchiveButton } from "./ArchiveButton";

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [q, setQ] = useState("");
  const s = q.trim().toLowerCase();
  const filtered = s
    ? products.filter(
        (p) => p.productCode.toLowerCase().includes(s) || p.name.toLowerCase().includes(s),
      )
    : products;

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search code or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 280, maxWidth: "100%" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>
          {products.length === 0
            ? "No products yet. Add one or import a CSV."
            : "No products match your search."}
        </div>
      ) : (
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Image</th>
              <th align="left">Code</th>
              <th align="left">Name</th>
              <th align="left">Status</th>
              <th align="left">Upload</th>
              <th align="left"></th>
              <th align="left"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td>
                  {p.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${apiBase}/img/${p.imageKey}`}
                      alt={p.name}
                      width={40}
                      height={40}
                      style={{ objectFit: "cover", borderRadius: 4 }}
                    />
                  ) : (
                    <span style={{ color: "var(--text-faint)" }}>—</span>
                  )}
                </td>
                <td>{p.productCode}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td>
                  <ProductImageUpload productId={p.id} />
                </td>
                <td>
                  <a href={`/products/${p.id}/edit`}>Edit</a>
                </td>
                <td>
                  <ArchiveButton productId={p.id} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
