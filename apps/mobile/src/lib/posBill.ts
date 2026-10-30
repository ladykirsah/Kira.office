import type { Phrase } from "@l-shopee/shared/lang";
import { billDate, type Buyer } from "./scanSale";

/**
 * ทำบิล's rules (owner approved the drawing, canvas v131, 30 Oct 2026): who the bill is for is picked
 * first — ลูกค้า (a car: plate, car and mileage required, name and phone optional) or ช่าง (only a
 * name, if any, and every part at the mechanic price). The same sale and draft shapes as the web
 * back office's ทำบิล sends, so both apps record the same thing.
 */

export type DocKind = "bill" | "quote";

/** One line of the bill: a part from stock, or a service (no stock). Money in satang. */
export interface PosLine {
  key: string;
  kind: "part" | "service";
  variantId: string | null;
  productId: string | null;
  /** The product's code (DN-447220), shown under its name. */
  productRef: string | null;
  name: string;
  photoKey: string | null;
  barcode: string | null;
  quantity: number;
  /** ราคาลูกค้า — the list price (a service's own price). */
  walkInSatang: number;
  /** ราคาช่าง; 0 when none is set. */
  mechanicSatang: number;
  /** What this bill charges per unit: the list price, the mechanic price, or a typed one. */
  priceSatang: number;
  useMechanic: boolean;
  costSatang: number;
  /** Sellable stock when the line was added; null for a service. */
  onHand: number | null;
}

export interface Discount {
  kind: "thb" | "pct";
  value: string;
}

export interface BillState {
  doc: DocKind;
  buyer: Buyer;
  plate: string;
  province: string;
  customerName: string;
  phones: string[];
  /** "Toyota Vigo 2014" — brand, model, year, as printed on the bill. */
  car: string;
  /** As typed: "152,300". */
  mileage: string;
  mechanicName: string;
  lines: PosLine[];
  discount: Discount;
  /** หมายเหตุบนบิล — optional. */
  note: string;
}

export type Missing = "plate" | "car" | "mileage" | "lines";

export const lineTotal = (l: PosLine): number =>
  Math.max(0, Math.round(l.quantity)) * Math.max(0, Math.round(l.priceSatang));

export const subtotal = (lines: readonly PosLine[]): number =>
  lines.reduce((sum, l) => sum + lineTotal(l), 0);

/** ใช้ราคาช่าง on or off. A part with no mechanic price keeps its list price. */
export function withMechanicPrice(line: PosLine, on: boolean): PosLine {
  const useMechanic = on && line.mechanicSatang > 0;
  return {
    ...line,
    useMechanic,
    priceSatang: useMechanic ? line.mechanicSatang : line.walkInSatang,
  };
}

/** Switching ลูกค้า ↔ ช่าง re-prices every part; services keep their price. */
export function forBuyer(lines: readonly PosLine[], buyer: Buyer): PosLine[] {
  return lines.map((l) => (l.kind === "part" ? withMechanicPrice(l, buyer === "mechanic") : l));
}

/** The whole-bill discount in satang: baht or percent, never below 0 or above the subtotal. */
export function discountOf(subtotalSatang: number, d: Discount): number {
  const n = parseFloat(d.value.replace(/,/g, "")) || 0;
  if (n <= 0) return 0;
  const amount = d.kind === "pct" ? Math.round((subtotalSatang * n) / 100) : Math.round(n * 100);
  return Math.max(0, Math.min(subtotalSatang, amount));
}

/**
 * The bill discount spread over the lines by their size; the rounding left over goes to the biggest
 * line, so the parts add up to the discount exactly (the server's per-line profit relies on it).
 */
function spread(lineTotals: number[], discount: number): number[] {
  const total = lineTotals.reduce((a, b) => a + b, 0);
  if (total <= 0 || discount <= 0) return lineTotals.map(() => 0);
  const out = lineTotals.map((s) => Math.round((discount * s) / total));
  const diff = discount - out.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    const biggest = lineTotals.indexOf(Math.max(...lineTotals));
    out[biggest] = (out[biggest] ?? 0) + diff;
  }
  return out;
}

const MAX_MILEAGE = 9_999_999;

/** "152,300 km" → 152300. Anything that is not a reading → null. */
export function parseMileage(text: string): number | null {
  const digits = text.replace(/[,\s]|km/gi, "");
  if (!/^\d+$/.test(digits)) return null;
  const n = Number(digits);
  return n <= MAX_MILEAGE ? n : null;
}

/** What still has to be filled in before ชำระเงิน / บันทึกใบเสนอราคา (owner: only รถ + เลขไมล์). */
export function billMissing(b: BillState): Missing[] {
  const missing: Missing[] = [];
  if (b.buyer === "customer") {
    if (!b.plate.trim()) missing.push("plate");
    if (!b.car.trim()) missing.push("car");
    if (parseMileage(b.mileage) === null) missing.push("mileage");
  }
  if (b.lines.length === 0) missing.push("lines");
  return missing;
}

/** Parts asking for more than the shop had when they were added. */
export const shortLines = (lines: readonly PosLine[]): PosLine[] =>
  lines.filter((l) => l.kind === "part" && l.onHand !== null && l.quantity > l.onHand);

/** The line exactly as POST /sync and POST /onsite/drafts take it. */
export interface SaleLinePayload {
  productVariantId: string | null;
  lineType: "part" | "service";
  description: string;
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang: number;
  discountSatang?: number;
}

export interface BillSale {
  clientUuid: string;
  saleNumber: string;
  paymentMethod: "cash" | "promptpay";
  saleType: "parts" | "repair";
  licensePlate?: string;
  vehicle?: string;
  notes?: string;
  mileageKm: number | null;
  buyerName: string | null;
  lines: SaleLinePayload[];
}

export interface BillDraft {
  draftId: string;
  stage: "draft" | "quotation";
  saleNumber: string | null;
  saleType: "parts" | "repair";
  licensePlate: string | null;
  vehicle: string | null;
  notes: string | null;
  mileageKm: number | null;
  buyerName: string | null;
  lines: SaleLinePayload[];
  discountSatang: number;
  discountKind: string;
  discountValue: string;
}

const isCustomer = (b: BillState) => b.buyer === "customer";

/** A car on the bill, or any service, makes it a repair; parts over the counter are parts. */
function saleType(b: BillState): "parts" | "repair" {
  const car = isCustomer(b) && (b.plate.trim() !== "" || b.car.trim() !== "");
  return car || b.lines.some((l) => l.kind === "service") ? "repair" : "parts";
}

function payloadLine(l: PosLine): SaleLinePayload {
  return {
    productVariantId: l.kind === "part" ? l.variantId : null,
    lineType: l.kind,
    description: l.name,
    ...(l.barcode ? { barcodeValue: l.barcode } : {}),
    quantity: l.quantity,
    unitPriceSatang: l.priceSatang,
    unitCostSatang: l.costSatang,
  };
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

/** The issued bill for POST /sync. Who took the cash rides in the notes, as the web ทำบิล did. */
export function buildBillSale(
  b: BillState,
  o: {
    clientUuid: string;
    saleNumber: string;
    paymentMethod: "cash" | "promptpay";
    receivedBy: string;
  },
): BillSale {
  const totals = b.lines.map(lineTotal);
  const shares = spread(totals, discountOf(subtotal(b.lines), b.discount));
  const received = o.paymentMethod === "cash" ? orNull(o.receivedBy) : null;
  const notes = [orNull(b.note), received ? `รับเงินโดย ${received}` : null].filter(Boolean);
  const customer = isCustomer(b);
  return {
    clientUuid: o.clientUuid,
    saleNumber: o.saleNumber,
    paymentMethod: o.paymentMethod,
    saleType: saleType(b),
    licensePlate: customer ? (orNull(b.plate) ?? undefined) : undefined,
    vehicle: customer ? (orNull(b.car) ?? undefined) : undefined,
    notes: notes.length > 0 ? notes.join(" · ") : undefined,
    mileageKm: customer ? parseMileage(b.mileage) : null,
    buyerName: customer ? null : orNull(b.mechanicName),
    lines: b.lines.map((l, i) => ({ ...payloadLine(l), discountSatang: shares[i] ?? 0 })),
  };
}

/** A parked bill or a quotation. A quotation keeps its QT number for good, edits and resends too. */
export function buildBillDraft(
  b: BillState,
  o: { draftId: string; saleNumber: string | null },
): BillDraft {
  const customer = isCustomer(b);
  return {
    draftId: o.draftId,
    stage: b.doc === "quote" ? "quotation" : "draft",
    saleNumber: b.doc === "quote" ? o.saleNumber : null,
    saleType: saleType(b),
    licensePlate: customer ? orNull(b.plate) : null,
    vehicle: customer ? orNull(b.car) : null,
    notes: orNull(b.note),
    mileageKm: customer ? parseMileage(b.mileage) : null,
    buyerName: customer ? null : orNull(b.mechanicName),
    lines: b.lines.map(payloadLine),
    discountSatang: discountOf(subtotal(b.lines), b.discount),
    discountKind: b.discount.kind,
    discountValue: b.discount.value,
  };
}

export interface CustomerUpsert {
  licensePlate: string;
  plateProvince?: string;
  customerName?: string;
  phone?: string;
  carModel?: string;
  /** ลูกค้า's แก้ไข sets it; ทำบิล never sends it. */
  notes?: string;
}

/**
 * The car's record for PUT /customers/by-plate, sent when the bill is issued. Only what was filled in
 * goes, so a blank never wipes a known name. Phones share one column, comma-separated.
 */
export function customerUpsert(b: BillState): CustomerUpsert | null {
  if (!isCustomer(b)) return null;
  const licensePlate = b.plate.trim();
  if (!licensePlate) return null;
  const phones = [...new Set(b.phones.map((p) => p.trim()).filter(Boolean))];
  const fields: CustomerUpsert = { licensePlate };
  if (b.province.trim()) fields.plateProvince = b.province.trim();
  if (b.customerName.trim()) fields.customerName = b.customerName.trim();
  if (phones.length > 0) fields.phone = phones.join(", ");
  if (b.car.trim()) fields.carModel = b.car.trim();
  return fields;
}

const DOC_NUMBER = /^([A-Za-z]+)(\d{4})(\d{2})-(\d{2})(\d+)$/;
const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** The next DASyyyymm-ddnnn (bill) or QTyyyymm-ddnnn (quotation) after today's highest of that kind. */
export function nextDocNumber(
  prefix: string,
  known: readonly (string | null | undefined)[],
  now: number,
): string {
  const d = new Date(now);
  const [y, m, day] = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
  let highest = 0;
  for (const id of known) {
    const hit = id ? DOC_NUMBER.exec(id) : null;
    if (!hit || hit[1] !== prefix) continue;
    if (Number(hit[2]) !== y || Number(hit[3]) !== m || Number(hit[4]) !== day) continue;
    highest = Math.max(highest, Number(hit[5]));
  }
  return `${prefix}${y}${pad(m, 2)}-${pad(day, 2)}${pad(highest + 1, 3)}`;
}

export interface DraftRowSource {
  stage: "draft" | "quotation";
  saleNumber: string | null;
  licensePlate: string | null;
  vehicle: string | null;
  buyerName: string | null;
  createdAt: number;
}

/**
 * A row of the drafts list (owner, canvas: line 2 = plate · car, line 3 = date · time). `main` is
 * null when the bill has no plate and no name yet; the screen says so in words.
 */
export function draftRowText(
  d: DraftRowSource,
  now: number,
): { top: Phrase; main: string | null; when: Phrase } {
  const top: Phrase =
    d.stage === "quotation"
      ? { th: `ใบเสนอราคา · ${d.saleNumber ?? ""}`, en: `Quotation · ${d.saleNumber ?? ""}` }
      : { th: "ฉบับร่าง", en: "Draft" };
  const car = [d.licensePlate, d.vehicle].filter((x) => x && x.trim()).join(" · ");
  const main = car || d.buyerName?.trim() || null;
  const at = billDate(d.createdAt);
  const sameDay = new Date(d.createdAt).toDateString() === new Date(now).toDateString();
  const day = at.date.replace(/ \d{4}$/, "");
  const when: Phrase = sameDay
    ? { th: `วันนี้ · ${at.time}`, en: `Today · ${at.time}` }
    : { th: `${day} · ${at.time}`, en: `${day} · ${at.time}` };
  return { top, main, when };
}
