"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase, type ProductRow } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { totalCostSatang, commissionFeeSatang, profitSatang } from "@/lib/pricing";
import { productStatusTag } from "@/lib/productStatus";
import { stockStatus } from "@/lib/stock";
import { tableText } from "@/lib/tableText";
import { ActionsMenu } from "./ActionsMenu";
import { PriceProfitCell } from "./PriceProfitCell";
import { StockCell } from "./StockCell";

type Tab = "all" | "listed" | "offshopee" | "draft" | "low" | "out";

/** Sort/filter dimensions for the products list. `values` returns a product's value(s) for the dimension. */
const DIMENSIONS = [
  {
    key: "brand",
    label: "Part brand",
    values: (p: ProductRow) => (p.brandName ? [p.brandName] : []),
  },
  {
    key: "usage",
    label: "Match system",
    values: (p: ProductRow) => (p.usageName ? [p.usageName] : []),
  },
  { key: "type", label: "Part name", values: (p: ProductRow) => (p.typeName ? [p.typeName] : []) },
  { key: "car", label: "Car brand", values: (p: ProductRow) => p.carBrands },
] as const;

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("");
  const [filterVal, setFilterVal] = useState<string>("");
  // The frozen-column divider only shows once the table overflows (Product is at its min width).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [frozen, setFrozen] = useState(false);

  const listed = products.filter((p) => p.shopeeListed);
  const drafts = products.filter((p) => p.status === "draft");
  const offShopee = products.filter((p) => !p.shopeeListed && p.status !== "draft");
  const outOfStock = products.filter((p) => p.onHand <= 0);
  const lowStock = products.filter((p) => stockStatus(p.onHand) === "low");

  const byTab =
    tab === "listed"
      ? listed
      : tab === "offshopee"
        ? offShopee
        : tab === "draft"
          ? drafts
          : tab === "low"
            ? lowStock
            : tab === "out"
              ? outOfStock
              : products;
  const s = q.trim().toLowerCase();
  const rows = s
    ? byTab.filter(
        (p) => p.productRef.toLowerCase().includes(s) || p.name.toLowerCase().includes(s),
      )
    : byTab;

  // Linked Sort by + Filter: the chosen dimension drives both the sort and the Filter's options.
  const dim = DIMENSIONS.find((d) => d.key === sortBy);
  const filterOptions = dim
    ? Array.from(new Set(products.flatMap((p) => dim.values(p)))).sort((a, b) => a.localeCompare(b))
    : [];
  let view = rows;
  if (dim && filterVal) view = view.filter((p) => dim.values(p).includes(filterVal));
  if (dim) {
    const sortKey = (p: ProductRow) => {
      const vals = dim.values(p);
      return vals.length ? [...vals].sort()[0] : "";
    };
    view = [...view].sort((a, b) => {
      const ka = sortKey(a);
      const kb = sortKey(b);
      if (!ka || !kb) return ka ? -1 : kb ? 1 : 0; // products with no value sort last
      return ka.localeCompare(kb);
    });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setFrozen(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [view.length]);

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
        <TabBtn id="offshopee" label="Off Shopee" n={offShopee.length} />
        <TabBtn id="draft" label="Not listed" n={drafts.length} />
        <TabBtn id="low" label="Low stock" n={lowStock.length} />
        <TabBtn id="out" label="Out of stock" n={outOfStock.length} />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <input
          className="tbar-input"
          placeholder="Search code or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ ...inputS, width: 240, maxWidth: "100%", color: "var(--text)", fontWeight: 500 }}
        />
        <select
          aria-label="Sort by"
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setFilterVal("");
          }}
          style={{
            ...inputS,
            color: sortBy ? "var(--text)" : "var(--text-faint)",
            fontWeight: sortBy ? 500 : 400,
          }}
        >
          <option value="">Sort by…</option>
          {DIMENSIONS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter"
          value={filterVal}
          onChange={(e) => setFilterVal(e.target.value)}
          disabled={!dim}
          style={{
            ...inputS,
            color: filterVal ? "var(--text)" : "var(--text-faint)",
            fontWeight: filterVal ? 500 : 400,
          }}
        >
          <option value="">{dim ? `All ${dim.label.toLowerCase()}` : "Filter…"}</option>
          {filterOptions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {view.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>
          {products.length === 0
            ? "No products yet. Add one or import a CSV."
            : "No products match."}
        </div>
      ) : (
        <div className="products-scroll" ref={scrollRef}>
          <table
            className={frozen ? "products-table frozen" : "products-table"}
            cellPadding={8}
            style={{
              borderCollapse: "collapse",
              tableLayout: "fixed",
              width: "100%",
              minWidth: 966,
            }}
          >
            <colgroup>
              {/* Product (frozen, min 400px) flexes to fill; the rest are fixed px. The table
                  min-width makes it overflow the scroll wrapper when space is tight. */}
              <col />
              <col style={{ width: 136 }} />
              <col style={{ width: 136 }} />
              <col style={{ width: 96 }} />
              <col style={{ width: 92 }} />
              <col style={{ width: 106 }} />
            </colgroup>
            <thead>
              <tr>
                <th align="left" className="freeze-col">
                  Product
                </th>
                <th align="left">Online price</th>
                <th align="left">B2C price</th>
                <th align="center">Stock</th>
                <th align="left">Status</th>
                <th align="left">Action</th>
              </tr>
            </thead>
            <tbody>
              {view.map((p) => {
                const cost = totalCostSatang(p.itemCostSatang, !!p.taxOnCost);
                const onlineProfit = profitSatang(
                  p.onlinePriceSatang,
                  cost,
                  commissionFeeSatang(p.onlinePriceSatang, p.onlineCommissionBp),
                );
                const b2cProfit = profitSatang(p.offlinePriceSatang, cost, 0);
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="freeze-col">
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        {p.imageKey ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${apiBase}/img/${p.imageKey}`}
                            alt={p.name}
                            width={56}
                            height={56}
                            style={{ objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 56,
                              height: 56,
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
                          <a
                            href={`/products/${p.id}/edit`}
                            title={p.name}
                            style={{
                              fontWeight: 600,
                              display: "block",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
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
                                  <span key={t} className="tag tag-sm">
                                    {t}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div style={tableText.subtitle}>{p.productRef}</div>
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
                      <PriceProfitCell
                        priceSatang={p.offlinePriceSatang}
                        profitSatang={b2cProfit}
                      />
                    </td>
                    <td align="center">
                      <StockCell variantId={p.variantId} onHand={p.onHand} />
                    </td>
                    <td>
                      {(() => {
                        const s = productStatusTag(p);
                        return <span className={`pill ${s.cls}`}>{s.label}</span>;
                      })()}
                    </td>
                    <td>
                      <ActionsMenu productId={p.id} status={p.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
