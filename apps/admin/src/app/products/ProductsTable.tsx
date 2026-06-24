"use client";

import { useState } from "react";
import { apiBase, type ProductRow } from "@/lib/api";
import { totalCostSatang, commissionFeeSatang, profitSatang } from "@/lib/pricing";
import { ActionsMenu } from "./ActionsMenu";
import { PriceProfitCell } from "./PriceProfitCell";

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
            <col style={{ width: "32%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Online price</th>
              <th align="left">B2C price</th>
              <th align="right">Stock</th>
              <th align="left">Shopee</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const cost = totalCostSatang(p.itemCostSatang, !!p.taxOnCost);
              const onlineProfit = profitSatang(
                p.onlinePriceSatang,
                cost,
                commissionFeeSatang(p.onlinePriceSatang, p.onlineCommissionBp),
              );
              const b2cProfit = profitSatang(p.offlinePriceSatang, cost, 0);
              return (
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
                  <td>
                    <PriceProfitCell
                      priceSatang={p.onlinePriceSatang}
                      profitSatang={onlineProfit}
                    />
                  </td>
                  <td>
                    <PriceProfitCell priceSatang={p.offlinePriceSatang} profitSatang={b2cProfit} />
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
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
