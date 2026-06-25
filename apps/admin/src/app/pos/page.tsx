"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  apiBase,
  lookupBarcode,
  fetchProducts,
  fetchBarcodes,
  fetchServices,
  fetchShopInfo,
  type ProductRow,
  type ServiceRow,
  type ShopInfo,
} from "@/lib/api";
import JsBarcode from "jsbarcode";
import { formatBaht } from "@/lib/format";
import { lineTotalSatang, cartTotalSatang } from "@/lib/posCart";
import { flushOutbox, type OutboxStore, type QueuedSale } from "@/lib/outbox";
import { createIdbStore } from "@/lib/outbox-idb";
import { useToast } from "../ToastProvider";

type SaleType = "parts" | "repair";
type AddMethod = "scan" | "code" | "search";
type LineKind = "part" | "service";

interface SaleLine {
  uid: string;
  kind: LineKind;
  name: string;
  productVariantId?: string | null;
  barcodeValue?: string;
  productCode?: string;
  tags?: string[]; // part detail tags (brand · system · part name)
  quantity: number;
  unitPriceSatang: number;
}

async function syncSale(sale: QueuedSale): Promise<boolean> {
  const res = await fetch(`${apiBase}/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sales: [sale] }),
  });
  return res.ok;
}

const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
};
const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 10,
};
const inputSm: CSSProperties = { minHeight: 0, padding: "8px 10px" };

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 9,
        border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
        background: active ? "var(--primary)" : "var(--surface)",
        color: active ? "#fff" : "var(--text)",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid transparent",
        background: active ? "var(--primary-soft)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-muted)",
        fontWeight: active ? 600 : 500,
        fontSize: 13,
        cursor: "pointer",
        minHeight: 0,
      }}
    >
      {children}
    </button>
  );
}

function chip(kind: "part" | "service"): CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: 5,
    background: kind === "service" ? "var(--primary-soft)" : "var(--hover)",
    color: kind === "service" ? "var(--primary)" : "var(--text-muted)",
    whiteSpace: "nowrap",
  };
}

/** A small rendered barcode (EAN-13 for 13 digits, else CODE128). Drawn off-screen to a data URL so
 * list re-renders can't blank it; renders nothing if the value won't encode. */
function BarcodePreview({ value }: { value: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!value) {
      setSrc("");
      return;
    }
    const encode = (format: string) => {
      const c = document.createElement("canvas");
      JsBarcode(c, value, {
        format,
        width: 1.3,
        height: 26,
        displayValue: true,
        fontSize: 9,
        margin: 0,
      });
      return c.toDataURL("image/png");
    };
    try {
      // Prefer EAN-13 for 13-digit codes, but fall back to CODE128 when the check digit is invalid.
      setSrc(/^\d{13}$/.test(value) ? encode("EAN13") : encode("CODE128"));
    } catch {
      try {
        setSrc(encode("CODE128"));
      } catch {
        setSrc(""); // value won't encode at all → show nothing
      }
    }
  }, [value]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={`Barcode ${value}`}
      style={{ maxWidth: 124, height: "auto", display: "block" }}
    />
  );
}

/** One cart line: row 1 = name + detail tags · barcode; row 2 = ฿ price in total of N pcs. */
function CartItem({
  line,
  barcode,
  onQty,
  onPrice,
  onRemove,
}: {
  line: SaleLine;
  barcode?: string;
  onQty: (q: number) => void;
  onPrice: (satang: number) => void;
  onRemove: () => void;
}) {
  const isService = line.kind === "service";
  const tags = line.tags ?? [];
  return (
    <div style={{ position: "relative", padding: "12px 0", borderTop: "1px solid var(--border)" }}>
      {/* Row 1 */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingRight: 28 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{line.name}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}>
            {isService ? (
              <span style={chip("service")}>Service</span>
            ) : (
              tags.map((t, i) => (
                <span key={i} style={chip("part")}>
                  {t}
                </span>
              ))
            )}
          </div>
        </div>
        {!isService && barcode && (
          <div style={{ flex: "none", paddingTop: 2 }}>
            <BarcodePreview value={barcode} />
          </div>
        )}
      </div>

      {/* Remove (top-right) */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        style={{
          position: "absolute",
          top: 12,
          right: 0,
          width: 24,
          height: 24,
          minHeight: 0,
          padding: 0,
          lineHeight: 1,
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 6,
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      {/* Row 2 */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 6,
          marginTop: 10,
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        <span>฿</span>
        <input
          type="number"
          min={0}
          value={line.unitPriceSatang / 100}
          onChange={(e) =>
            onPrice(Math.max(0, Math.round((parseFloat(e.target.value) || 0) * 100)))
          }
          style={{ width: 92, ...inputSm }}
          title="Unit price"
        />
        <span>in total of</span>
        <input
          type="number"
          min={1}
          value={line.quantity}
          onChange={(e) => onQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
          style={{ width: 56, ...inputSm }}
          title="Quantity"
        />
        <span>pcs.</span>
      </div>
    </div>
  );
}

export default function PosPage() {
  const toast = useToast();

  const [saleType, setSaleType] = useState<SaleType>("parts");
  const [method, setMethod] = useState<AddMethod>("scan");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [plate, setPlate] = useState("");
  const [note, setNote] = useState("");
  const [now] = useState(() => new Date());

  // Reference data (loaded once; scanning falls back to the API when offline/missing).
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [barcodeToProductId, setBarcodeToProductId] = useState<Map<string, string>>(new Map());
  const [codeToBarcode, setCodeToBarcode] = useState<Map<string, string>>(new Map());
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [shop, setShop] = useState<ShopInfo>({ name: "", address: "" });

  // Add-part inputs
  const [scanVal, setScanVal] = useState("");
  const [codeVal, setCodeVal] = useState("");
  const [searchVal, setSearchVal] = useState("");

  // Add-service inputs
  const [svcId, setSvcId] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");

  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);

  const storeRef = useRef<OutboxStore | null>(null);
  if (!storeRef.current) storeRef.current = createIdbStore();
  const store = storeRef.current;

  useEffect(() => {
    fetchProducts()
      .then((ps) => setProducts(ps))
      .catch(() => {});
    fetchBarcodes()
      .then((bs) => {
        const byBarcode = new Map<string, string>();
        const byCode = new Map<string, string>();
        for (const b of bs)
          if (b.barcode) {
            byBarcode.set(b.barcode, b.productId);
            byCode.set(b.productCode, b.barcode);
          }
        setBarcodeToProductId(byBarcode);
        setCodeToBarcode(byCode);
      })
      .catch(() => {});
    fetchServices()
      .then((s) => setServices(s))
      .catch(() => {});
    fetchShopInfo()
      .then((s) => setShop(s))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function flush() {
      const r = await flushOutbox(store, syncSale);
      if (cancelled) return;
      if (r.synced) toast(`Synced ${r.synced} queued sale(s)`, "success");
      setPending((await store.all()).length);
    }
    flush();
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const totalSatang = cartTotalSatang(lines);

  function addProductLine(p: ProductRow, barcodeValue?: string) {
    const tags = [p.brandName, p.usageName, p.typeName].filter((t): t is string => !!t);
    const barcode = barcodeValue ?? codeToBarcode.get(p.productCode);
    setLines((ls) => {
      const existing = ls.find((l) => l.kind === "part" && l.productVariantId === p.variantId);
      if (existing && p.variantId) {
        return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...ls,
        {
          uid: crypto.randomUUID(),
          kind: "part",
          name: p.name,
          productVariantId: p.variantId,
          barcodeValue: barcode,
          productCode: p.productCode,
          tags,
          quantity: 1,
          unitPriceSatang: p.offlinePriceSatang || 0,
        },
      ];
    });
    toast(`Added ${p.name}`, "success");
  }

  async function addByScan() {
    const v = scanVal.trim();
    if (!v) return;
    const pid = barcodeToProductId.get(v);
    const local = pid ? products.find((p) => p.id === pid) : undefined;
    if (local) {
      addProductLine(local, v);
      setScanVal("");
      return;
    }
    setBusy(true);
    try {
      const found = await lookupBarcode(v);
      if (!found) {
        toast(`Unknown barcode: ${v}`, "error");
        return;
      }
      const prod = products.find((p) => p.id === found.productId);
      const tags = prod
        ? [prod.brandName, prod.usageName, prod.typeName].filter((t): t is string => !!t)
        : [];
      setLines((ls) => [
        ...ls,
        {
          uid: crypto.randomUUID(),
          kind: "part",
          name: found.name,
          productVariantId: found.variantId,
          barcodeValue: v,
          productCode: found.productCode,
          tags,
          quantity: 1,
          unitPriceSatang: prod?.offlinePriceSatang || 0,
        },
      ]);
      toast(`Added ${found.name}`, "success");
      setScanVal("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function addByCode() {
    const v = codeVal.trim().toLowerCase();
    if (!v) return;
    const p = products.find((x) => x.productCode.toLowerCase() === v);
    if (!p) {
      toast(`No product with code “${codeVal.trim()}”.`, "error");
      return;
    }
    addProductLine(p);
    setCodeVal("");
  }

  const searchResults = useMemo(() => {
    const q = searchVal.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.productCode.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchVal, products]);

  const selectedService = services.find((s) => s.id === svcId) ?? null;

  function selectService(id: string) {
    setSvcId(id);
    const s = services.find((x) => x.id === id);
    setSvcPrice(s ? (s.basePriceSatang / 100).toString() : "");
  }

  function addServiceFromList() {
    if (!selectedService) return;
    const price = Math.max(0, Math.round((parseFloat(svcPrice) || 0) * 100));
    setLines((ls) => [
      ...ls,
      {
        uid: crypto.randomUUID(),
        kind: "service",
        name: selectedService.name,
        quantity: 1,
        unitPriceSatang: price,
      },
    ]);
    toast(`Added ${selectedService.name}`, "success");
    setSvcId("");
    setSvcPrice("");
  }

  function addManualService() {
    const name = manualName.trim();
    if (!name) return;
    const price = Math.max(0, Math.round((parseFloat(manualPrice) || 0) * 100));
    setLines((ls) => [
      ...ls,
      { uid: crypto.randomUUID(), kind: "service", name, quantity: 1, unitPriceSatang: price },
    ]);
    toast(`Added ${name}`, "success");
    setManualName("");
    setManualPrice("");
  }

  function updateLine(uid: string, patch: Partial<SaleLine>) {
    setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...patch } : l)));
  }
  function removeLine(uid: string) {
    setLines((ls) => ls.filter((l) => l.uid !== uid));
  }

  // Save the whole order — parts (deduct stock) and services (labour lines) plus the sale type,
  // plate and note — to the sales ledger. Offline-safe via the outbox; the server dedupes on uuid.
  async function saveSale(): Promise<boolean> {
    const sale: QueuedSale = {
      clientUuid: crypto.randomUUID(),
      paymentMethod: "cash",
      saleType,
      licensePlate: saleType === "repair" ? plate.trim() || undefined : undefined,
      notes: note.trim() || undefined,
      lines: lines.map((l) => ({
        productVariantId: l.kind === "part" ? (l.productVariantId ?? null) : null,
        lineType: l.kind,
        description: l.name,
        barcodeValue: l.barcodeValue,
        quantity: l.quantity,
        unitPriceSatang: l.unitPriceSatang,
      })),
      queuedAt: Date.now(),
    };
    try {
      if (await syncSale(sale)) return true;
      toast("Server rejected the sale — check the items and try again.", "error");
      return false;
    } catch {
      await store.add(sale);
      setPending((await store.all()).length);
      toast("Offline — sale saved, will sync when back online.", "info");
      return true;
    }
  }

  function printBill() {
    window.print();
  }

  async function checkout() {
    if (lines.length === 0) return;
    setBusy(true);
    try {
      const ok = await saveSale();
      if (!ok) return;
      printBill();
      toast("Sale saved ✓", "success");
      setLines([]);
      setPlate("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  const billDateStr = now.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const billTimeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  return (
    <main>
      <h1>Point of Sale</h1>
      {pending > 0 && (
        <p style={{ color: "var(--warn)" }} className="bill-no-print">
          ⏳ {pending} sale(s) queued offline — will sync when online.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 380px)",
          gap: 20,
          alignItems: "start",
        }}
        className="pos-grid"
      >
        {/* ---- LEFT: build the sale ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={card}>
            <div style={fieldLabel}>Selling type</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Seg active={saleType === "parts"} onClick={() => setSaleType("parts")}>
                🧰 Buy auto parts
              </Seg>
              <Seg active={saleType === "repair"} onClick={() => setSaleType("repair")}>
                🔧 Repair service
              </Seg>
            </div>
            {saleType === "repair" && (
              <div style={{ marginTop: 14 }}>
                <div style={fieldLabel}>ทะเบียนรถ (license plate)</div>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  placeholder="เช่น 1กก 1234 สุรินทร์"
                  style={{ width: "100%" }}
                />
              </div>
            )}
          </div>

          {/* Add auto part */}
          <div style={card}>
            <div style={fieldLabel}>Add auto part</div>
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              <Tab active={method === "scan"} onClick={() => setMethod("scan")}>
                📷 Scan barcode
              </Tab>
              <Tab active={method === "code"} onClick={() => setMethod("code")}>
                ⌨️ Type code
              </Tab>
              <Tab active={method === "search"} onClick={() => setMethod("search")}>
                🔍 Search
              </Tab>
            </div>

            {method === "scan" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addByScan();
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  autoFocus
                  value={scanVal}
                  onChange={(e) => setScanVal(e.target.value)}
                  placeholder="Scan or paste a barcode…"
                  style={{ flex: 1, ...inputSm }}
                />
                <button type="submit" className="btn-soft" disabled={busy} style={inputSm}>
                  Add
                </button>
              </form>
            )}

            {method === "code" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addByCode();
                }}
                style={{ display: "flex", gap: 8 }}
              >
                <input
                  value={codeVal}
                  onChange={(e) => setCodeVal(e.target.value)}
                  placeholder="Type a product code…"
                  style={{ flex: 1, ...inputSm }}
                />
                <button type="submit" className="btn-soft" style={inputSm}>
                  Add
                </button>
              </form>
            )}

            {method === "search" && (
              <div>
                <input
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  placeholder="Search by name or code…"
                  style={{ width: "100%", ...inputSm }}
                />
                {searchResults.length > 0 && (
                  <div
                    style={{
                      marginTop: 8,
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    {searchResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          addProductLine(p);
                          setSearchVal("");
                        }}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 10px",
                          background: "transparent",
                          border: "none",
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.name}
                          <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                            {p.productCode}
                          </span>
                        </span>
                        <span className="muted" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                          {formatBaht(p.offlinePriceSatang || 0)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Add service (repair only) */}
          {saleType === "repair" && (
            <div style={card}>
              <div style={fieldLabel}>Add service</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select
                  value={svcId}
                  onChange={(e) => selectService(e.target.value)}
                  style={{ flex: "1 1 180px", ...inputSm }}
                >
                  <option value="">Choose a service…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <span className="muted" style={{ fontSize: 13 }}>
                  ฿
                </span>
                <input
                  type="number"
                  min={0}
                  value={svcPrice}
                  onChange={(e) => setSvcPrice(e.target.value)}
                  placeholder="0"
                  disabled={!selectedService}
                  style={{ width: 96, ...inputSm }}
                />
                <button
                  type="button"
                  className="btn-soft"
                  disabled={!selectedService}
                  onClick={addServiceFromList}
                  style={inputSm}
                >
                  Add
                </button>
              </div>

              <div
                className="muted"
                style={{ fontSize: 12, margin: "12px 0 8px", textAlign: "center" }}
              >
                — or add a service manually —
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Service description…"
                  style={{ flex: "1 1 180px", ...inputSm }}
                />
                <span className="muted" style={{ fontSize: 13 }}>
                  ฿
                </span>
                <input
                  type="number"
                  min={0}
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="0"
                  style={{ width: 96, ...inputSm }}
                />
                <button
                  type="button"
                  className="btn-soft"
                  disabled={!manualName.trim()}
                  onClick={addManualService}
                  style={inputSm}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Cart */}
          <div style={card}>
            <div style={fieldLabel}>Items ({lines.length})</div>
            {lines.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                No items yet. Add a part{saleType === "repair" ? " or a service" : ""} above.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {lines.map((l) => (
                  <CartItem
                    key={l.uid}
                    line={l}
                    barcode={l.barcodeValue || codeToBarcode.get(l.productCode ?? "")}
                    onQty={(quantity) => updateLine(l.uid, { quantity })}
                    onPrice={(unitPriceSatang) => updateLine(l.uid, { unitPriceSatang })}
                    onRemove={() => removeLine(l.uid)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---- RIGHT: bill ---- */}
        <div style={{ position: "sticky", top: 16 }}>
          <div className="bill-print">
            <div className="bill-doc">
              <div className="bill-shop-name">{shop.name || "—"}</div>
              {shop.address && (
                <div className="bill-meta" style={{ whiteSpace: "pre-wrap" }}>
                  {shop.address}
                </div>
              )}
              <div className="bill-meta" style={{ marginTop: 8 }}>
                {billDateStr} · {billTimeStr}
                {saleType === "repair" && plate.trim() ? ` · ทะเบียน ${plate.trim()}` : ""}
              </div>

              <table className="bill-lines">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Qty</th>
                    <th className="num">Price</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ color: "#9aa0a8", padding: "14px 4px" }}>
                        No items yet.
                      </td>
                    </tr>
                  ) : (
                    lines.map((l) => (
                      <tr key={l.uid}>
                        <td>{l.name}</td>
                        <td className="num">{l.quantity}</td>
                        <td className="num">{formatBaht(l.unitPriceSatang)}</td>
                        <td className="num">{formatBaht(lineTotalSatang(l))}</td>
                      </tr>
                    ))
                  )}
                  <tr className="bill-total-row">
                    <td colSpan={3}>Total</td>
                    <td className="num">{formatBaht(totalSatang)}</td>
                  </tr>
                </tbody>
              </table>

              {note.trim() && (
                <div className="bill-note">
                  <strong>Note:</strong> {note.trim()}
                </div>
              )}
            </div>
          </div>

          {/* Controls (not printed) */}
          <div className="bill-no-print" style={{ marginTop: 12 }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note to the bill…"
              rows={2}
              style={{ width: "100%", fontFamily: "inherit", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn-soft" onClick={printBill} style={{ flex: 1 }}>
                Print bill
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={checkout}
                disabled={busy || lines.length === 0}
                style={{ flex: 1 }}
              >
                Save &amp; print
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
