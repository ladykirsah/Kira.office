"use client";

import { useEffect, useRef, useState } from "react";
import { apiBase, type ProductRow } from "@/lib/api";
import { inputS } from "@/lib/inputStyles";
import { tierProfits } from "@/lib/tierProfits";
import { productStatusTag, isNotLive } from "@/lib/productStatus";
import { readinessNote, readinessValues } from "@/lib/readiness";
import { canWrite, canSeeProfit } from "@l-shopee/core";
import { useStaffRole } from "../StaffRoleProvider";
import { stockStatus } from "@/lib/stock";
import { tableText } from "@/lib/tableText";
import { ActionsMenu } from "./ActionsMenu";
import { PriceProfitCell } from "./PriceProfitCell";
import { StockCell } from "./StockCell";
import { useT } from "../LangProvider";

type Tab = "all" | "airplus" | "notlive" | "low" | "out";

/** Sort/filter dimensions for the products list. `values` returns a product's value(s) for the dimension. */
const DIMENSIONS = [
  {
    key: "brand",
    label: { th: "ยี่ห้ออะไหล่", en: "Part brand" },
    values: (p: ProductRow) => (p.brandName ? [p.brandName] : []),
  },
  {
    key: "usage",
    label: { th: "ระบบที่ใช้ได้", en: "Match system" },
    values: (p: ProductRow) => (p.usageName ? [p.usageName] : []),
  },
  {
    key: "type",
    label: { th: "ชื่ออะไหล่", en: "Part name" },
    values: (p: ProductRow) => (p.typeName ? [p.typeName] : []),
  },
  {
    key: "car",
    label: { th: "ยี่ห้อรถ", en: "Car brand" },
    values: (p: ProductRow) => p.carBrands,
  },
  /**
   * Not a property of the part — a property of how finished its record is. It earns a place beside
   * the others because it is the one the Not live tab is actually worked from: "show me everything
   * missing a photo" is the whole job, and it was previously eight products opened one at a time.
   */
  { key: "readiness", label: { th: "ความพร้อมขาย", en: "Readiness" }, values: readinessValues },
] as const;

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const t = useT();
  const role = useStaffRole();
  // A mechanic reads the catalog to do counter work: one list, no filters to manage it by, no
  // margin, nothing to click into (owner, 2026-08-24). The API enforces each of these itself — the
  // cost is not even sent to them — so this only spares them controls that would refuse.
  const managesCatalog = !!role && canWrite(role, "products");
  const seesProfit = !!role && canSeeProfit(role);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("");
  const [filterVal, setFilterVal] = useState<string>("");
  // The frozen-column divider only shows once the table overflows (Product is at its min width).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [frozen, setFrozen] = useState(false);

  // Shopee tabs are gone — there is no Shopee API (owner, 2026-07-29). The status that matters is
  // AirPlus: the storefront shows a product only while status = 'active'.
  const onAirPlus = products.filter((p) => p.status === "active");

  // "Not live" replaced the Paused and Draft tabs (owner, 2026-08-24) — they answer one question:
  // is this in front of a customer? "Archived" was folded into Paused at the same time, so there
  // are three states: active, draft, paused. The status pill says which.
  const notLive = products.filter((p) => isNotLive(p.status));
  const outOfStock = products.filter((p) => p.onHand <= 0);
  const lowStock = products.filter((p) => stockStatus(p.onHand) === "low");

  const byTab =
    tab === "airplus"
      ? onAirPlus
      : tab === "notlive"
        ? notLive
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
        <TabBtn id="all" label={t({ th: "ทั้งหมด", en: "All" })} n={products.length} />
        {managesCatalog && (
          <>
            <TabBtn
              id="airplus"
              label={t({ th: "อยู่บน AirPlus", en: "On AirPlus" })}
              n={onAirPlus.length}
            />
            <TabBtn
              id="notlive"
              label={t({ th: "ยังไม่วางขาย", en: "Not live" })}
              n={notLive.length}
            />
            <TabBtn id="low" label={t({ th: "เหลือน้อย", en: "Low stock" })} n={lowStock.length} />
            <TabBtn id="out" label={t({ th: "หมด", en: "Out of stock" })} n={outOfStock.length} />
          </>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 18,
          background: "var(--surface)",
        }}
      >
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
            placeholder={t({ th: "ค้นหารหัสหรือชื่อสินค้า…", en: "Search code or name…" })}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              ...inputS,
              width: 240,
              maxWidth: "100%",
              color: "var(--text)",
              fontWeight: 500,
            }}
          />
          <select
            aria-label={t({ th: "เรียงตาม", en: "Sort by" })}
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
            <option value="">{t({ th: "เรียงตาม…", en: "Sort by…" })}</option>
            {DIMENSIONS.map((d) => (
              <option key={d.key} value={d.key}>
                {t(d.label)}
              </option>
            ))}
          </select>
          {dim && (
            <select
              aria-label={t({ th: "กรอง", en: "Filter" })}
              value={filterVal}
              onChange={(e) => setFilterVal(e.target.value)}
              style={{
                ...inputS,
                color: filterVal ? "var(--text)" : "var(--text-faint)",
                fontWeight: filterVal ? 500 : 400,
              }}
            >
              <option value="">
                {t({ th: `${t(dim.label)}ทั้งหมด`, en: `All ${dim.label.en.toLowerCase()}` })}
              </option>
              {filterOptions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </div>

        {view.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📦</div>
            {products.length === 0
              ? "No products yet. Add one or import a CSV."
              : t({ th: "ไม่มีสินค้าที่ตรงกับที่เลือก", en: "No products match." })}
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
                    {t({ th: "สินค้า", en: "Product" })}
                  </th>
                  <th align="left">{t({ th: "ราคาออนไลน์", en: "Online price" })}</th>
                  <th align="left">{t({ th: "ราคา B2C", en: "B2C price" })}</th>
                  <th align="center">{t({ th: "คงเหลือ", en: "Stock" })}</th>
                  <th align="left">{t({ th: "สถานะ", en: "Status" })}</th>
                  <th align="left">{t({ th: "จัดการ", en: "Action" })}</th>
                </tr>
              </thead>
              <tbody>
                {view.map((p) => {
                  // Shared formula. This used to charge AirPlus a commission it does not pay —
                  // that fee belongs to Shopee, which this table does not have a column for.
                  const { airplus: onlineProfit, b2c: b2cProfit } = tierProfits({
                    costSatang: p.itemCostSatang,
                    taxOnCost: !!p.taxOnCost,
                    b2cSatang: p.offlinePriceSatang,
                    b2bSatang: p.b2bPriceSatang ?? 0, // optional on the list payload
                    airplusSatang: p.onlinePriceSatang,
                    shopeeSatang: 0,
                    commissionBp: p.onlineCommissionBp,
                  });
                  return (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="freeze-col">
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {p.imageKey ? (
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
                              href={`/products/${p.id}`}
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
                          profitSatang={seesProfit ? onlineProfit : null}
                        />
                      </td>
                      <td>
                        <PriceProfitCell
                          priceSatang={p.offlinePriceSatang}
                          profitSatang={seesProfit ? b2cProfit : null}
                        />
                      </td>
                      <td align="center">
                        <StockCell
                          variantId={p.variantId}
                          onHand={p.onHand}
                          held={p.held}
                          readOnly={!managesCatalog}
                        />
                      </td>
                      <td>
                        {(() => {
                          const s = productStatusTag(p);
                          // The pill says WHICH tab this row belongs to; the line under it says what
                          // is stopping the product from selling. On every tab, not just Not live
                          // (owner, 2026-08-24) — a product selling without a picture is worth
                          // flagging too. `readinessNote` is what keeps the two from repeating each
                          // other: it stays quiet about stock whenever the pill already reads Out.
                          const note = readinessNote(p);
                          return (
                            <>
                              <span className={`pill ${s.cls}`}>{t(s.label)}</span>
                              {note && (
                                <span className={note.ready ? "why ready" : "why"}>
                                  {t(note.text)}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </td>
                      <td>
                        <ActionsMenu
                          productId={p.id}
                          status={p.status}
                          shopeeListed={p.shopeeListed}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
