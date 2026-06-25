"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  apiBase,
  lookupBarcode,
  fetchProducts,
  fetchBarcodes,
  fetchServices,
  fetchShopInfo,
  fetchCarFitment,
  type ProductRow,
  type ServiceRow,
  type ShopInfo,
  type CarBrandTree,
} from "@/lib/api";
import JsBarcode from "jsbarcode";
import { formatBaht } from "@/lib/format";
import { lineTotalSatang, cartTotalSatang } from "@/lib/posCart";
import { inputL, inputS } from "@/lib/inputStyles";
import { flushOutbox, type OutboxStore, type QueuedSale } from "@/lib/outbox";
import { createIdbStore } from "@/lib/outbox-idb";
import { useToast } from "../ToastProvider";

type SaleType = "parts" | "repair";
type AddKind = "product" | "service";
type AddMethod = "scan" | "code";
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
// Input-box size patterns (inputL / inputS) live in @/lib/inputStyles — shared app-wide.

/** Local date as yyyy-mm-dd (for a <input type="date"> default). */
function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** A yyyy-mm-dd string as a Thai long date (Buddhist era), e.g. 25 มิถุนายน 2569. */
function thaiDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

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
  if (kind === "service") {
    return {
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 7px",
      borderRadius: 5,
      background: "var(--primary-soft)",
      color: "var(--primary)",
      whiteSpace: "nowrap",
    };
  }
  // Part detail tags: match the products table's outlined .tag.tag-sm style.
  return {
    fontSize: 11,
    fontWeight: 400,
    padding: "1px 8px",
    borderRadius: 8,
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--text-muted)",
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

/** One cart line. Row 1: name + detail tags (or Service chip) on the left, barcode on the right.
 * Row 2 (separated by a clear gap): editable ฿ price × qty pcs. on the left, bold line total right. */
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
  const miniInput: CSSProperties = { width: 66, fontSize: 13, padding: "5px 8px", minHeight: 0 };
  return (
    <div
      style={{
        position: "relative",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 14px",
        background: "var(--surface)",
      }}
    >
      {/* Row 1: identity — name + tags (left), barcode (right) */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingRight: 28 }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{line.name}</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
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
          top: 10,
          right: 10,
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

      {/* Row 2: money — ฿ price × qty pcs. (left) · line total (right). Divider above to skim by. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
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
            style={miniInput}
            title="Unit price"
          />
          <span>×</span>
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => onQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            style={{ ...miniInput, width: 48, textAlign: "center" }}
            title="Quantity"
          />
          <span>pcs.</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{formatBaht(lineTotalSatang(line))}</div>
      </div>
    </div>
  );
}

type BillStyle = "invoice" | "thermal";

/** Amount in baht with grouping + 2 decimals, no symbol (e.g. 2,590.00). */
function amt(satang: number): string {
  return (satang / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type DocType = "bill" | "quotation";

/** The in-progress POS cart, saved locally so a page switch / refresh doesn't lose it. */
const DRAFT_KEY = "pos:draft:v1";
interface PosDraft {
  lines: SaleLine[];
  plate: string;
  note: string;
  billDate: string;
  carBrandId: string;
  carModelId: string;
  carYear: string;
  docType: DocType;
}

/** A mock QR graphic (3 finder patterns + scattered modules). Stands in until the shop uploads a
 * real contact QR in Shop info. Deterministic so it doesn't flicker on re-render. */
function QrPlaceholder({ size = 80 }: { size?: number }) {
  const N = 21;
  const c = size / N;
  const rects: ReactNode[] = [];
  const fill = (x: number, y: number) =>
    rects.push(<rect key={`${x}-${y}`} x={x * c} y={y * c} width={c} height={c} fill="#18181b" />);
  const finder = (ox: number, oy: number) => {
    for (let x = 0; x < 7; x++)
      for (let y = 0; y < 7; y++) {
        const edge = x === 0 || x === 6 || y === 0 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) fill(ox + x, oy + y);
      }
  };
  finder(0, 0);
  finder(N - 7, 0);
  finder(0, N - 7);
  for (let x = 0; x < N; x++)
    for (let y = 0; y < N; y++) {
      const inFinder = (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
      if (inFinder) continue;
      if ((x * 7 + y * 13 + x * y * 3) % 5 === 0 || (x + y) % 4 === 0) fill(x, y);
    }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ background: "#fff", display: "block", flex: "none" }}
      aria-label="Contact QR (sample)"
    >
      {rects}
    </svg>
  );
}

/** The printable cash bill, rendered as a thermal receipt or a structured invoice. */
function BillDoc({
  billStyle,
  docType,
  shopName,
  shopAddress,
  dateLabel,
  vehicle,
  plate,
  lines,
  totalSatang,
  note,
}: {
  billStyle: BillStyle;
  docType: DocType;
  shopName: string;
  shopAddress: string;
  dateLabel: string;
  vehicle: string;
  plate: string;
  lines: SaleLine[];
  totalSatang: number;
  note: string;
}) {
  const muted = "#6b7280";
  const empty = lines.length === 0;
  const isQuote = docType === "quotation";
  const headEn = isQuote ? "QUOTATION" : "CASH BILL";
  const headTh = isQuote ? "ใบเสนอราคา" : "บิลเงินสด";

  if (billStyle === "thermal") {
    const dash = <div style={{ borderTop: "1.5px dashed #9aa0a6", margin: "11px 0" }} />;
    const metaRow = (label: string, value: string) => (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: muted }}>{label}</span>
        <span>{value}</span>
      </div>
    );
    return (
      <div
        style={{
          maxWidth: 320,
          margin: "0 auto",
          background: "#fff",
          color: "#18181b",
          fontSize: 12.5,
          lineHeight: 1.5,
          padding: "20px 18px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: 2 }}>{headEn}</div>
          <div style={{ fontSize: 11, color: muted }}>{headTh}</div>
          <div style={{ fontWeight: 700, fontSize: 14, marginTop: 8 }}>{shopName}</div>
          {!isQuote && shopAddress && (
            <div style={{ fontSize: 11, color: "#52525b", whiteSpace: "pre-wrap" }}>
              {shopAddress}
            </div>
          )}
        </div>
        {dash}
        {metaRow("วันที่", dateLabel)}
        {vehicle && metaRow("รถ", vehicle)}
        {plate && metaRow("ทะเบียน", plate)}
        {dash}
        {empty ? (
          <div style={{ color: muted, padding: "4px 0" }}>ยังไม่มีรายการ</div>
        ) : (
          lines.map((l) => (
            <div key={l.uid} style={{ marginBottom: 6 }}>
              <div>{l.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "#3f3f46" }}>
                <span style={{ color: muted }}>×{l.quantity}</span>
                <span>{amt(lineTotalSatang(l))}</span>
              </div>
            </div>
          ))
        )}
        {dash}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          <span>{isQuote ? "รวมโดยประมาณ" : "รวมทั้งสิ้น"}</span>
          <span>฿{amt(totalSatang)}</span>
        </div>
        {isQuote && (
          <div style={{ fontSize: 10.5, color: muted, marginTop: 4 }}>
            * ราคาประเมิน อาจเปลี่ยนแปลงตามหน้างาน
          </div>
        )}
        {note && (
          <>
            {dash}
            <div style={{ fontSize: 11, color: "#52525b" }}>หมายเหตุ: {note}</div>
          </>
        )}
        {isQuote ? (
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <div style={{ display: "inline-block" }}>
              <QrPlaceholder size={92} />
            </div>
            <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>
              สแกนเพื่อติดต่อร้าน · จองคิว
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 11, color: muted }}>
            *** ขอบคุณที่ใช้บริการ ***
          </div>
        )}
      </div>
    );
  }

  // Invoice
  return (
    <div
      style={{
        background: "#fff",
        color: "#18181b",
        fontSize: 13,
        border: "1px solid #d4d4d8",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          padding: "16px 18px",
          borderBottom: "2px solid #18181b",
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{shopName}</div>
          {!isQuote && shopAddress && (
            <div
              style={{ fontSize: 12, color: "#52525b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}
            >
              {shopAddress}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div
            style={{
              display: "inline-block",
              background: "#18181b",
              color: "#fff",
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1.5,
              padding: "5px 11px",
              borderRadius: 4,
            }}
          >
            {headEn}
          </div>
          <div style={{ fontSize: 12, color: "#52525b", marginTop: 7 }}>{dateLabel}</div>
        </div>
      </div>
      {(vehicle || plate) && (
        <div
          style={{
            display: "flex",
            gap: 28,
            flexWrap: "wrap",
            padding: "10px 18px",
            background: "#f4f4f5",
            fontSize: 12,
          }}
        >
          {vehicle && (
            <div>
              <span style={{ color: muted }}>รถ:</span> {vehicle}
            </div>
          )}
          {plate && (
            <div>
              <span style={{ color: muted }}>ทะเบียน:</span> {plate}
            </div>
          )}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#fafafa", color: muted, fontSize: 11 }}>
            <th style={{ textAlign: "left", padding: "8px 8px 8px 18px", fontWeight: 600 }}>
              รายการ
            </th>
            <th style={{ textAlign: "center", padding: 8, fontWeight: 600 }}>จำนวน</th>
            <th style={{ textAlign: "right", padding: 8, fontWeight: 600 }}>ราคา</th>
            <th style={{ textAlign: "right", padding: "8px 18px 8px 8px", fontWeight: 600 }}>
              รวม
            </th>
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr>
              <td colSpan={4} style={{ padding: "14px 18px", color: "#9aa0a6" }}>
                ยังไม่มีรายการ
              </td>
            </tr>
          ) : (
            lines.map((l) => (
              <tr key={l.uid} style={{ borderBottom: "1px solid #efefef" }}>
                <td style={{ padding: "9px 8px 9px 18px" }}>{l.name}</td>
                <td style={{ textAlign: "center", padding: 9 }}>{l.quantity}</td>
                <td style={{ textAlign: "right", padding: 9 }}>{amt(l.unitPriceSatang)}</td>
                <td style={{ textAlign: "right", padding: "9px 18px 9px 8px" }}>
                  {amt(lineTotalSatang(l))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "baseline",
          gap: 24,
          padding: "12px 18px",
          borderTop: "2px solid #18181b",
        }}
      >
        <span style={{ fontWeight: 700, letterSpacing: 1 }}>{isQuote ? "ESTIMATE" : "TOTAL"}</span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>฿{amt(totalSatang)}</span>
      </div>
      {(note || isQuote) && (
        <div
          style={{
            padding: "10px 18px",
            borderTop: "1px solid #e5e5e5",
            fontSize: 12,
            color: "#52525b",
          }}
        >
          {note && (
            <div>
              <span style={{ fontWeight: 600 }}>Note:</span> {note}
            </div>
          )}
          {isQuote && (
            <div style={{ marginTop: note ? 4 : 0 }}>* ราคาประเมิน อาจเปลี่ยนแปลงตามหน้างาน</div>
          )}
        </div>
      )}
      {isQuote && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "14px 18px",
            borderTop: "1px solid #e5e5e5",
            background: "#fafafa",
          }}
        >
          <QrPlaceholder size={76} />
          <div>
            <div style={{ fontWeight: 600 }}>สนใจติดต่อร้าน</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              สแกน QR เพื่อแชท / จองคิว ได้ทันที
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PosPage() {
  const toast = useToast();

  const [addKind, setAddKind] = useState<AddKind>("product");
  const [method, setMethod] = useState<AddMethod>("scan");
  const [lines, setLines] = useState<SaleLine[]>([]);
  const [billDate, setBillDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState("");
  const [billStyle, setBillStyle] = useState<BillStyle>("invoice");
  const [docType, setDocType] = useState<DocType>("bill");

  // Vehicle: brand → model → year, plus the plate.
  const [carBrandId, setCarBrandId] = useState("");
  const [carModelId, setCarModelId] = useState("");
  const [carYear, setCarYear] = useState("");
  const [plate, setPlate] = useState("");

  // Reference data (loaded once; scanning falls back to the API when offline/missing).
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [barcodeToProductId, setBarcodeToProductId] = useState<Map<string, string>>(new Map());
  const [codeToBarcode, setCodeToBarcode] = useState<Map<string, string>>(new Map());
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [shop, setShop] = useState<ShopInfo>({ name: "", address: "" });
  const [carFitment, setCarFitment] = useState<CarBrandTree[]>([]);

  // Add-part inputs
  const [scanVal, setScanVal] = useState("");
  const [codeVal, setCodeVal] = useState("");

  // Add-service inputs. svcId is "" / a service id / MANUAL; svcPrice is the price for either path.
  const [svcId, setSvcId] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [manualName, setManualName] = useState("");

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
    fetchCarFitment()
      .then((b) => setCarFitment(b))
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

  // Auto-save the in-progress draft locally so switching pages / refreshing doesn't lose the cart.
  // A draft is NOT a sale (no revenue) — it's cleared on checkout, when the order goes to the ledger.
  const draftReady = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<PosDraft>;
        if (Array.isArray(d.lines) && d.lines.length) setLines(d.lines);
        if (typeof d.plate === "string") setPlate(d.plate);
        if (typeof d.note === "string") setNote(d.note);
        if (typeof d.billDate === "string") setBillDate(d.billDate);
        if (typeof d.carBrandId === "string") setCarBrandId(d.carBrandId);
        if (typeof d.carModelId === "string") setCarModelId(d.carModelId);
        if (typeof d.carYear === "string") setCarYear(d.carYear);
        if (d.docType === "bill" || d.docType === "quotation") setDocType(d.docType);
      }
    } catch {
      // ignore corrupt or unavailable storage
    }
    // Enable saving only after the restore has settled, so it can't clobber the saved draft on mount.
    const t = setTimeout(() => {
      draftReady.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    try {
      const empty =
        lines.length === 0 && !plate.trim() && !note.trim() && !carBrandId && !carModelId;
      if (empty) {
        localStorage.removeItem(DRAFT_KEY);
      } else {
        const draft: PosDraft = {
          lines,
          plate,
          note,
          billDate,
          carBrandId,
          carModelId,
          carYear,
          docType,
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      }
    } catch {
      // ignore storage errors (private mode / quota)
    }
  }, [lines, plate, note, billDate, carBrandId, carModelId, carYear, docType]);

  const totalSatang = cartTotalSatang(lines);

  // Vehicle (repair): cascade brand → model → year off the car-fitment tree.
  const selectedBrand = carFitment.find((b) => b.id === carBrandId) ?? null;
  const brandModels = selectedBrand?.models ?? [];
  const selectedModel = brandModels.find((m) => m.id === carModelId) ?? null;
  const yearOptions = (() => {
    const from = selectedModel?.yearFrom;
    const to = selectedModel?.yearTo;
    const hi = to ?? new Date().getFullYear();
    const lo = from ?? hi - 25;
    const years: number[] = [];
    for (let y = hi; y >= lo; y--) years.push(y);
    return years;
  })();
  const vehicleLabel = [selectedBrand?.name, selectedModel?.name, carYear]
    .filter(Boolean)
    .join(" ");

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

  const MANUAL = "__manual__";
  const isManualService = svcId === MANUAL;
  const serviceName = isManualService
    ? manualName.trim()
    : (services.find((s) => s.id === svcId)?.name ?? "");

  function selectService(id: string) {
    setSvcId(id);
    setManualName("");
    if (id === MANUAL || id === "") {
      setSvcPrice("");
    } else {
      const s = services.find((x) => x.id === id);
      setSvcPrice(s ? (s.basePriceSatang / 100).toString() : "");
    }
  }

  function addService() {
    if (!serviceName) return;
    const price = Math.max(0, Math.round((parseFloat(svcPrice) || 0) * 100));
    setLines((ls) => [
      ...ls,
      {
        uid: crypto.randomUUID(),
        kind: "service",
        name: serviceName,
        quantity: 1,
        unitPriceSatang: price,
      },
    ]);
    toast(`Added ${serviceName}`, "success");
    setSvcId("");
    setSvcPrice("");
    setManualName("");
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
    // A sale counts as a repair when it has a vehicle/plate or any service line; else it's parts.
    const isRepair = !!(vehicleLabel || plate.trim() || lines.some((l) => l.kind === "service"));
    const sale: QueuedSale = {
      clientUuid: crypto.randomUUID(),
      paymentMethod: "cash",
      saleType: isRepair ? "repair" : "parts",
      licensePlate: plate.trim() || undefined,
      vehicle: vehicleLabel || undefined,
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
      setCarBrandId("");
      setCarModelId("");
      setCarYear("");
      setAddKind("product");
      setBillDate(toISODate(new Date()));
    } finally {
      setBusy(false);
    }
  }

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
          gridTemplateColumns: "minmax(0, 528px) minmax(320px, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
        className="pos-grid"
      >
        {/* ---- LEFT: build the sale ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 528 }}>
          {/* Date */}
          <div style={card}>
            <div style={fieldLabel}>Date</div>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value || toISODate(new Date()))}
              style={inputL}
            />
          </div>

          {/* Vehicle — brand → model → year + plate */}
          <div style={card}>
            <div style={fieldLabel}>Vehicle</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={carBrandId}
                onChange={(e) => {
                  setCarBrandId(e.target.value);
                  setCarModelId("");
                  setCarYear("");
                }}
                style={{ flex: "1 1 130px", ...inputS }}
              >
                <option value="">Brand…</option>
                {carFitment.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                value={carModelId}
                onChange={(e) => {
                  setCarModelId(e.target.value);
                  setCarYear("");
                }}
                disabled={!selectedBrand || brandModels.length === 0}
                style={{ flex: "1 1 130px", ...inputS }}
              >
                <option value="">
                  {selectedBrand && brandModels.length === 0 ? "No models" : "Model…"}
                </option>
                {brandModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.yearFrom || m.yearTo ? ` (${m.yearFrom ?? "…"}–${m.yearTo ?? "…"})` : ""}
                  </option>
                ))}
              </select>
              <select
                value={carYear}
                onChange={(e) => setCarYear(e.target.value)}
                disabled={!selectedModel}
                style={{ flex: "0 1 104px", ...inputS }}
              >
                <option value="">Year…</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={fieldLabel}>ทะเบียนรถ (license plate)</div>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="เช่น 1กก 1234 สุรินทร์"
                style={inputL}
              />
            </div>
          </div>

          {/* Add item — Product / Service toggle switches the workspace */}
          <div style={card}>
            <div style={fieldLabel}>Add item</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <Seg active={addKind === "product"} onClick={() => setAddKind("product")}>
                📦 Product
              </Seg>
              <Seg active={addKind === "service"} onClick={() => setAddKind("service")}>
                🔧 Service
              </Seg>
            </div>

            {addKind === "product" && (
              <div>
                <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                  <Tab active={method === "scan"} onClick={() => setMethod("scan")}>
                    📷 Scan barcode
                  </Tab>
                  <Tab active={method === "code"} onClick={() => setMethod("code")}>
                    ⌨️ Type code
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
                      style={{ flex: 1, ...inputS }}
                    />
                    <button type="submit" className="btn-soft" disabled={busy} style={inputS}>
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
                      style={{ flex: 1, ...inputS }}
                    />
                    <button type="submit" className="btn-soft" style={inputS}>
                      Add
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Service workspace */}
            {addKind === "service" && (
              <div>
                <div style={fieldLabel}>Add service</div>
                {/* Row 1: pick a service, or choose to add manually */}
                <select
                  value={svcId}
                  onChange={(e) => selectService(e.target.value)}
                  style={{ width: "100%", ...inputS }}
                >
                  <option value="">Choose a service…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                  <option value={MANUAL}>✎ Add manually…</option>
                </select>

                {/* Manual description appears between the dropdown and the price */}
                {isManualService && (
                  <input
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Service description…"
                    autoFocus
                    style={{ width: "100%", marginTop: 8, ...inputS }}
                  />
                )}

                {/* Add — the price is set on the item in the cart below */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn-soft"
                    disabled={!serviceName}
                    onClick={addService}
                    style={{ ...inputS, padding: "8px 16px" }}
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Cart */}
          <div style={card}>
            <div style={fieldLabel}>Items ({lines.length})</div>
            {lines.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                No items yet. Add a product or service above.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          {/* Document type — big toggle above the preview (not printed) */}
          <div className="bill-no-print" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {(["bill", "quotation"] as DocType[]).map((d) => {
              const active = docType === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDocType(d)}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "11px 10px",
                    borderRadius: 10,
                    border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                    background: active ? "var(--primary)" : "var(--surface)",
                    color: active ? "#fff" : "var(--text)",
                    fontWeight: active ? 600 : 500,
                    fontSize: 14,
                    cursor: "pointer",
                    minHeight: 0,
                  }}
                >
                  {d === "bill" ? "💵 Cash bill" : "📝 Quotation"}
                </button>
              );
            })}
          </div>

          <div className="bill-print">
            <BillDoc
              billStyle={billStyle}
              docType={docType}
              shopName={shop.name || "—"}
              shopAddress={shop.address}
              dateLabel={thaiDate(billDate)}
              vehicle={vehicleLabel}
              plate={plate.trim()}
              lines={lines}
              totalSatang={totalSatang}
              note={note.trim()}
            />
          </div>

          {/* Controls (not printed) — paper, note, actions */}
          <div className="bill-no-print" style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)", marginRight: 2 }}>
                Paper
              </span>
              {(["invoice", "thermal"] as BillStyle[]).map((s) => {
                const active = billStyle === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setBillStyle(s)}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 999,
                      border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                      background: active ? "var(--primary-soft)" : "var(--surface)",
                      color: active ? "var(--primary)" : "var(--text-muted)",
                      fontWeight: active ? 600 : 500,
                      fontSize: 12.5,
                      cursor: "pointer",
                      minHeight: 0,
                    }}
                  >
                    {s === "invoice" ? "📄 Invoice" : "🧾 Receipt"}
                  </button>
                );
              })}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note to the bill…"
              rows={2}
              style={{ width: "100%", fontFamily: "inherit", marginBottom: 10 }}
            />
            {docType === "quotation" ? (
              <button
                type="button"
                className="btn-primary"
                onClick={printBill}
                disabled={lines.length === 0}
                style={{ width: "100%" }}
              >
                Create PDF
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn-soft" onClick={printBill} style={{ flex: 1 }}>
                  Create PDF
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={checkout}
                  disabled={busy || lines.length === 0}
                  style={{ flex: 1 }}
                >
                  Save File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
