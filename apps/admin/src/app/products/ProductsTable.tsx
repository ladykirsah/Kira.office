"use client";

import { useState } from "react";
import { apiBase, type ProductRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { ProductImageUpload } from "./ProductImageUpload";
import { ArchiveButton } from "./ArchiveButton";

type Tab = "all" | "listed" | "unlisted";

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");

  const listed = products.filter((p) => p.shopeeListed);
  const unlisted = products.filter((p) => !p.shopeeListed);

  const byTab = tab === "listed" ? listed : tab === "unlisted" ? unlisted : products;
  const s = q.trim().toLowerCase();
  const rows = s
    ? byTab.filter(
        (p) => p.productCode.toLowerCase().includes(s) || p.name.toLowerCase().includes(s),
      )
    : byTab;

  const TabBtn = ({ id, label, n }: { id: Tab; label: string; n: number }) => (
    <button className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
      {label} ({n})
    </button>
  );

  return (
    <>
      <div className="tabs">
        <TabBtn id="all" label="All" n={products.length} />
        <TabBtn id="listed" label="On Shopee" n={listed.length} />
        <TabBtn id="unlisted" label="Not listed" n={unlisted.length} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Search code or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ width: 280, maxWidth: "100%" }}
        />
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>
          {products.length === 0
            ? "No products yet. Add one or import a CSV."
            : "No products match."}
        </div>
      ) : (
        <table cellPadding={8} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="right">Price (offline / online)</th>
              <th align="right">Stock</th>
              <th align="left">Shopee</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {p.imageKey ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`${apiBase}/img/${p.imageKey}`}
                        alt={p.name}
                        width={48}
                        height={48}
                        style={{ objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 6,
                          background: "var(--hover)",
                          flexShrink: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-faint)",
                        }}
                      >
                        📦
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <a href={`/products/${p.id}/edit`} style={{ fontWeight: 600 }}>
                        {p.name}
                      </a>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.productCode}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <ProductImageUpload productId={p.id} />
                      </div>
                    </div>
                  </div>
                </td>
                <td align="right">
                  <div>{p.offlinePriceSatang ? formatBaht(p.offlinePriceSatang) : "—"}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {p.onlinePriceSatang ? formatBaht(p.onlinePriceSatang) : "—"}
                  </div>
                </td>
                <td align="right">{p.onHand}</td>
                <td>
                  <span className={p.shopeeListed ? "pill on" : "pill off"}>
                    {p.shopeeListed ? "On Shopee" : "Not listed"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <a href={`/products/${p.id}/edit`}>Edit</a>
                    <ArchiveButton productId={p.id} status={p.status} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
