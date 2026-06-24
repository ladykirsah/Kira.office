"use client";

import { useState } from "react";
import { apiBase, type ProductRow } from "@/lib/api";
import { formatBaht } from "@/lib/format";
import { ActionsMenu } from "./ActionsMenu";

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
        <table
          cellPadding={8}
          style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}
        >
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="right">Price</th>
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
                      {(() => {
                        const tags = [p.brandName, p.usageName, p.typeName].filter(
                          Boolean,
                        ) as string[];
                        return tags.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 6,
                              marginTop: 5,
                            }}
                          >
                            {tags.map((t) => (
                              <span key={t} className="tag">
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {p.productCode}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                <td align="right">
                  <div
                    style={{
                      display: "inline-grid",
                      gridTemplateColumns: "auto auto",
                      columnGap: 12,
                      rowGap: 3,
                      alignItems: "baseline",
                    }}
                  >
                    <span className="muted" style={{ fontSize: 12, textAlign: "left" }}>
                      Online
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {p.onlinePriceSatang ? formatBaht(p.onlinePriceSatang) : "—"}
                    </span>
                    <span className="muted" style={{ fontSize: 12, textAlign: "left" }}>
                      B2C
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {p.offlinePriceSatang ? formatBaht(p.offlinePriceSatang) : "—"}
                    </span>
                  </div>
                </td>
                <td align="right">{p.onHand}</td>
                <td>
                  <span className={p.shopeeListed ? "pill on" : "pill off"}>
                    {p.shopeeListed ? "Active" : "Not listed"}
                  </span>
                </td>
                <td>
                  <ActionsMenu productId={p.id} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
