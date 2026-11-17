/**
 * VAT billing (plan 10.2, owner 17 Nov 2026) — the company book, tax invoices and credit notes in
 * D1. The rules are in @l-shopee/core (taxDocs.ts).
 *
 * The owner's model: B2C gets a cash bill; B2B gets a cash bill or a full tax invoice, picked per
 * sale, the company kept in a book for next time or typed on the spot. Global practice (PEAK,
 * FlowAccount): running numbers made by the system, never deleted, cancelled with a reason and
 * issued again, a credit note when an invoiced bill is refunded. Writes run through the StockLedger
 * Durable Object so two papers can never take the same number. Not tax advice.
 */
import {
  bangkokDay,
  branchCode,
  branchLabel,
  nextTaxDocNumber,
  normalizeTaxId,
  shopKey,
  shopTaxMissing,
  taxBuyerProblem,
  vatBillingOn,
  type TaxBuyerInput,
} from "@l-shopee/core";

/** The shop's VAT billing switch and the details every tax invoice prints (ข้อมูลร้าน). */
export interface ShopTax {
  vatOn: boolean;
  taxId: string;
  taxBranch: string;
  taxName: string;
  taxAddress: string;
}

export interface TaxActor {
  userId: string | null;
  now: number;
}

export interface TaxBuyer {
  id: string;
  name: string;
  taxId: string;
  branch: string;
  address: string;
  phone: string | null;
}

export interface TaxDocument {
  id: string;
  kind: "tax_invoice" | "credit_note";
  docNumber: string;
  saleId: string;
  refersToId: string | null;
  replacesId: string | null;
  status: "issued" | "cancelled";
  reason: string | null;
  cancelReason: string | null;
  cancelledAt: number | null;
  sellerName: string;
  sellerTaxId: string;
  sellerBranch: string;
  sellerAddress: string;
  buyerId: string | null;
  buyerName: string;
  buyerTaxId: string;
  buyerBranch: string;
  buyerAddress: string;
  beforeVatSatang: number;
  vatSatang: number;
  totalSatang: number;
  issuedAt: number;
}

type Fail = { ok: false; status: 400 | 404 | 409; error: string; missing?: string[] };
const fail = (status: 400 | 404 | 409, error: string, missing?: string[]): Fail =>
  missing ? { ok: false, status, error, missing } : { ok: false, status, error };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const MAX_REASON_CHARS = 300;
const BUYER_LIST_LIMIT = 50;

// ── The company book ──────────────────────────────────────────────────────────────────────────

const BUYER_COLUMNS = "id, name, tax_id AS taxId, branch, address, phone";

/** Companies whose name or tax ID matches what was typed; the whole book (A–Z) when blank. */
export async function listTaxBuyers(db: D1Database, q: string): Promise<TaxBuyer[]> {
  const term = q.trim();
  const digits = normalizeTaxId(term);
  const rows = await db
    .prepare(
      `SELECT ${BUYER_COLUMNS} FROM tax_buyers
       WHERE ? = '' OR name LIKE ? OR (? != '' AND tax_id LIKE ?)
       ORDER BY name LIMIT ${BUYER_LIST_LIMIT}`,
    )
    .bind(term, `%${term}%`, /^\d+$/.test(digits) ? digits : "", `${digits}%`)
    .all<TaxBuyer>();
  return [...(rows.results ?? [])].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

/**
 * Keep a company in the book. The same tax ID and branch typed again updates the one row — a
 * company's address changes, it doesn't become a second company.
 */
async function buyerStatements(
  db: D1Database,
  input: TaxBuyerInput & { phone?: unknown },
  actor: TaxActor,
): Promise<{ buyer: TaxBuyer; statement: D1PreparedStatement } | Fail> {
  const problem = taxBuyerProblem(input);
  if (problem) return fail(400, problem);
  const taxId = normalizeTaxId(text(input.taxId));
  const branch = branchCode(text(input.branch));
  const existing = await db
    .prepare(`SELECT id FROM tax_buyers WHERE tax_id = ? AND branch = ?`)
    .bind(taxId, branch)
    .first<{ id: string }>();
  const buyer: TaxBuyer = {
    id: existing?.id ?? crypto.randomUUID(),
    name: text(input.name),
    taxId,
    branch,
    address: text(input.address),
    phone: text(input.phone) || null,
  };
  const statement = existing
    ? db
        .prepare(
          "UPDATE tax_buyers SET name = ?, address = ?, phone = ?, updated_at = ? WHERE id = ?",
        )
        .bind(buyer.name, buyer.address, buyer.phone, actor.now, buyer.id)
    : db
        .prepare(
          `INSERT INTO tax_buyers
             (id, name, tax_id, branch, address, phone, created_by_user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          buyer.id,
          buyer.name,
          taxId,
          branch,
          buyer.address,
          buyer.phone,
          actor.userId,
          actor.now,
          actor.now,
        );
  return { buyer, statement };
}

export async function saveTaxBuyer(
  db: D1Database,
  input: TaxBuyerInput & { phone?: unknown },
  actor: TaxActor,
): Promise<{ ok: true; buyer: TaxBuyer } | Fail> {
  const made = await buyerStatements(db, input, actor);
  if ("ok" in made) return made;
  await made.statement.run();
  return { ok: true, buyer: made.buyer };
}

// ── Papers ────────────────────────────────────────────────────────────────────────────────────

const DOC_COLUMNS = `id, kind, doc_number AS docNumber, sale_id AS saleId, refers_to_id AS refersToId,
  replaces_id AS replacesId, status, reason, cancel_reason AS cancelReason, cancelled_at AS cancelledAt,
  seller_name AS sellerName, seller_tax_id AS sellerTaxId, seller_branch AS sellerBranch,
  seller_address AS sellerAddress, buyer_id AS buyerId, buyer_name AS buyerName,
  buyer_tax_id AS buyerTaxId, buyer_branch AS buyerBranch, buyer_address AS buyerAddress,
  before_vat_satang AS beforeVatSatang, vat_satang AS vatSatang, total_satang AS totalSatang,
  issued_at AS issuedAt`;

async function readDocument(db: D1Database, id: string): Promise<TaxDocument | null> {
  return db.prepare(`SELECT ${DOC_COLUMNS} FROM tax_documents WHERE id = ?`).bind(id).first();
}

/** The next number of a kind, after this Thai month's highest (never reused, cancelled or not). */
async function nextNumber(db: D1Database, prefix: "TI" | "CN", now: number): Promise<string> {
  const monthPrefix = nextTaxDocNumber(prefix, [], now).slice(0, -4);
  const rows = await db
    .prepare("SELECT doc_number AS n FROM tax_documents WHERE doc_number LIKE ?")
    .bind(`${monthPrefix}%`)
    .all<{ n: string }>();
  return nextTaxDocNumber(
    prefix,
    (rows.results ?? []).map((r) => r.n),
    now,
  );
}

function insertDocument(db: D1Database, d: TaxDocument, actor: TaxActor): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO tax_documents
         (id, kind, doc_number, sale_id, refers_to_id, replaces_id, status, reason, seller_name,
          seller_tax_id, seller_branch, seller_address, buyer_id, buyer_name, buyer_tax_id,
          buyer_branch, buyer_address, before_vat_satang, vat_satang, total_satang,
          issued_by_user_id, issued_at)
       VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      d.id,
      d.kind,
      d.docNumber,
      d.saleId,
      d.refersToId,
      d.replacesId,
      d.reason,
      d.sellerName,
      d.sellerTaxId,
      d.sellerBranch,
      d.sellerAddress,
      d.buyerId,
      d.buyerName,
      d.buyerTaxId,
      d.buyerBranch,
      d.buyerAddress,
      d.beforeVatSatang,
      d.vatSatang,
      d.totalSatang,
      actor.userId,
      d.issuedAt,
    );
}

export interface IssueInput {
  saleId?: unknown;
  /** A company from the book … */
  buyerId?: unknown;
  /** … or one typed on the spot, saved to the book in the same write. */
  buyer?: TaxBuyerInput & { phone?: unknown };
}

/**
 * Make the full tax invoice for a paid bill (the counter's or a repair job's), picked at payment
 * for a company. The first one only on the bill's own day (turning an old cash bill into a tax
 * invoice is not part of 10.2); one issued again after a cancel may come later.
 */
export async function issueTaxInvoice(
  db: D1Database,
  input: IssueInput,
  shop: ShopTax,
  actor: TaxActor,
): Promise<{ ok: true; document: TaxDocument } | Fail> {
  if (!shop.vatOn) return fail(409, "vat_billing_off");
  const missing = shopTaxMissing(shop);
  if (missing.length > 0) return fail(409, "shop_tax_details_missing", missing);

  const saleId = text(input.saleId);
  const sale = await db
    .prepare(
      `SELECT id, stage, sale_status AS saleStatus, created_at AS createdAt,
              grand_total_satang AS totalSatang, tax_total_satang AS vatSatang
       FROM onsite_sales WHERE id = ?`,
    )
    .bind(saleId)
    .first<{
      id: string;
      stage: string;
      saleStatus: string;
      createdAt: number;
      totalSatang: number;
      vatSatang: number;
    }>();
  if (!sale) return fail(404, "sale_not_found");
  if (sale.stage !== "bill" || sale.saleStatus !== "completed") {
    return fail(409, "not_a_paid_bill");
  }
  const earlier = await db
    .prepare(
      `SELECT id, status FROM tax_documents WHERE sale_id = ? AND kind = 'tax_invoice'
       ORDER BY issued_at DESC`,
    )
    .bind(saleId)
    .all<{ id: string; status: string }>();
  const before = earlier.results ?? [];
  if (before.some((d) => d.status === "issued")) return fail(409, "already_issued");
  const replaces = before[0]?.id ?? null;
  if (!replaces && bangkokDay(sale.createdAt) !== bangkokDay(actor.now)) {
    return fail(409, "not_same_day");
  }

  let buyer: TaxBuyer;
  const statements: D1PreparedStatement[] = [];
  if (typeof input.buyerId === "string" && input.buyerId) {
    const row = await db
      .prepare(`SELECT ${BUYER_COLUMNS} FROM tax_buyers WHERE id = ?`)
      .bind(input.buyerId)
      .first<TaxBuyer>();
    if (!row) return fail(404, "no_such_buyer");
    buyer = row;
  } else if (input.buyer) {
    const made = await buyerStatements(db, input.buyer, actor);
    if ("ok" in made) return made;
    buyer = made.buyer;
    statements.push(made.statement);
  } else {
    return fail(400, "buyer_required");
  }

  const document: TaxDocument = {
    id: crypto.randomUUID(),
    kind: "tax_invoice",
    docNumber: await nextNumber(db, "TI", actor.now),
    saleId,
    refersToId: null,
    replacesId: replaces,
    status: "issued",
    reason: null,
    cancelReason: null,
    cancelledAt: null,
    sellerName: shop.taxName.trim(),
    sellerTaxId: normalizeTaxId(shop.taxId),
    sellerBranch: branchCode(shop.taxBranch),
    sellerAddress: shop.taxAddress.trim(),
    buyerId: buyer.id,
    buyerName: buyer.name,
    buyerTaxId: buyer.taxId,
    buyerBranch: buyer.branch,
    buyerAddress: buyer.address,
    beforeVatSatang: sale.totalSatang - sale.vatSatang,
    vatSatang: sale.vatSatang,
    totalSatang: sale.totalSatang,
    issuedAt: actor.now,
  };
  await db.batch([...statements, insertDocument(db, document, actor)]);
  return { ok: true, document };
}

/** Cancel a paper with a reason. It stays on the list, marked ยกเลิก; it is never deleted. */
export async function cancelTaxDocument(
  db: D1Database,
  id: string,
  reason: unknown,
  actor: TaxActor,
): Promise<{ ok: true; document: TaxDocument } | Fail> {
  const doc = await readDocument(db, id);
  if (!doc) return fail(404, "not_found");
  const why = text(reason);
  if (!why) return fail(400, "reason_required");
  if (Array.from(why).length > MAX_REASON_CHARS) return fail(400, "reason_too_long");
  if (doc.status === "cancelled") return fail(409, "already_cancelled");
  const credit = await db
    .prepare(
      "SELECT id FROM tax_documents WHERE refers_to_id = ? AND kind = 'credit_note' AND status = 'issued'",
    )
    .bind(id)
    .first<{ id: string }>();
  if (credit) return fail(409, "has_credit_note");
  await db
    .prepare(
      `UPDATE tax_documents SET status = 'cancelled', cancel_reason = ?, cancelled_at = ?,
         cancelled_by_user_id = ? WHERE id = ?`,
    )
    .bind(why, actor.now, actor.userId, id)
    .run();
  return {
    ok: true,
    document: { ...doc, status: "cancelled", cancelReason: why, cancelledAt: actor.now },
  };
}

/**
 * The ใบลดหนี้ written with a refund: when the bill has a live tax invoice, a credit note for the
 * whole bill (refunds are whole-bill), pointing at it, with the same seller and buyer. Returned as
 * statements so the refund writes it in the same batch.
 */
export async function creditNoteStatements(
  db: D1Database,
  saleId: string,
  reason: string | null,
  actor: TaxActor,
): Promise<{ statements: D1PreparedStatement[]; number: string | null }> {
  const invoice = await db
    .prepare(
      `SELECT ${DOC_COLUMNS} FROM tax_documents
       WHERE sale_id = ? AND kind = 'tax_invoice' AND status = 'issued'`,
    )
    .bind(saleId)
    .first<TaxDocument>();
  if (!invoice) return { statements: [], number: null };
  const note: TaxDocument = {
    ...invoice,
    id: crypto.randomUUID(),
    kind: "credit_note",
    docNumber: await nextNumber(db, "CN", actor.now),
    refersToId: invoice.id,
    replacesId: null,
    reason: text(reason) || "คืนเงินทั้งบิล",
    issuedAt: actor.now,
  };
  return { statements: [insertDocument(db, note, actor)], number: note.docNumber };
}

// ── Reading ───────────────────────────────────────────────────────────────────────────────────

export interface TaxDocumentPaper extends TaxDocument {
  saleNumber: string | null;
  refersToNumber: string | null;
  lines: {
    description: string | null;
    quantity: number;
    unitPriceSatang: number;
    discountSatang: number;
    taxSatang: number;
  }[];
}

/** One paper as it prints: both sides' details, the amounts, and the bill's lines. */
export async function getTaxDocument(db: D1Database, id: string): Promise<TaxDocumentPaper | null> {
  const doc = await readDocument(db, id);
  if (!doc) return null;
  const extra = await db
    .prepare(
      `SELECT s.sale_number AS saleNumber,
              (SELECT doc_number FROM tax_documents r WHERE r.id = ?) AS refersToNumber
       FROM onsite_sales s WHERE s.id = ?`,
    )
    .bind(doc.refersToId, doc.saleId)
    .first<{ saleNumber: string | null; refersToNumber: string | null }>();
  const lines = await db
    .prepare(
      `SELECT description, quantity, unit_price_satang AS unitPriceSatang,
              discount_satang AS discountSatang, tax_satang AS taxSatang
       FROM onsite_sale_lines WHERE onsite_sale_id = ? ORDER BY rowid`,
    )
    .bind(doc.saleId)
    .all<TaxDocumentPaper["lines"][number]>();
  return {
    ...doc,
    saleNumber: extra?.saleNumber ?? null,
    refersToNumber: extra?.refersToNumber ?? null,
    lines: lines.results ?? [],
  };
}

export interface TaxListRow extends TaxDocument {
  saleNumber: string | null;
  refersToNumber: string | null;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Every tax invoice and credit note of a Thai month (YYYY-MM), invoices then credit notes, each by
 * number — cancelled ones too, marked. Totals count live papers only; a credit note takes away.
 */
export async function listTaxDocuments(
  db: D1Database,
  month: string,
): Promise<{
  documents: TaxListRow[];
  totals: { beforeVatSatang: number; vatSatang: number; totalSatang: number };
}> {
  const zero = { beforeVatSatang: 0, vatSatang: 0, totalSatang: 0 };
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return { documents: [], totals: zero };
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) - BANGKOK_OFFSET_MS;
  const end = Date.UTC(Number(m[1]), Number(m[2]), 1) - BANGKOK_OFFSET_MS;
  const rows = await db
    .prepare(
      `SELECT ${DOC_COLUMNS.replace(/(^|,\s*)(\w+)/g, "$1d.$2")},
              s.sale_number AS saleNumber, r.doc_number AS refersToNumber
       FROM tax_documents d
       LEFT JOIN onsite_sales s ON s.id = d.sale_id
       LEFT JOIN tax_documents r ON r.id = d.refers_to_id
       WHERE d.issued_at >= ? AND d.issued_at < ?
       ORDER BY d.kind DESC, d.doc_number`,
    )
    .bind(start, end)
    .all<TaxListRow>();
  const documents = rows.results ?? [];
  const totals = documents
    .filter((d) => d.status === "issued")
    .reduce((t, d) => {
      const sign = d.kind === "credit_note" ? -1 : 1;
      return {
        beforeVatSatang: t.beforeVatSatang + sign * d.beforeVatSatang,
        vatSatang: t.vatSatang + sign * d.vatSatang,
        totalSatang: t.totalSatang + sign * d.totalSatang,
      };
    }, zero);
  return { documents, totals };
}

const baht = (satang: number) => (satang / 100).toFixed(2);
const quoted = (v: string) => `"${v.replace(/"/g, '""')}"`;
/** Quoted only when it has to be; a company's name always is (names hold commas). */
const csvCell = (v: string) => (/[",\n]/.test(v) ? quoted(v) : v);

/**
 * The month's list as a CSV the accountant opens in Excel (a byte-order mark so Thai shows right).
 * A plain list of issued papers — not the Revenue Department's sales-tax report form.
 */
export function taxDocumentsCsv(rows: readonly TaxListRow[]): string {
  const head = [
    "เลขที่",
    "ประเภท",
    "วันที่",
    "ลูกค้า",
    "เลขผู้เสียภาษี",
    "สาขา",
    "มูลค่าก่อน VAT",
    "VAT",
    "รวม",
    "สถานะ",
    "อ้างถึง",
    "เหตุผล",
    "บิล",
  ].join(",");
  const lines = rows.map((d) =>
    [
      d.docNumber,
      d.kind === "credit_note" ? "ใบลดหนี้" : "ใบกำกับภาษี",
      bangkokDay(d.issuedAt),
      quoted(d.buyerName),
      d.buyerTaxId,
      branchLabel(d.buyerBranch).th,
      baht(d.beforeVatSatang),
      baht(d.vatSatang),
      baht(d.totalSatang),
      d.status === "cancelled" ? "ยกเลิก" : "ใช้ได้",
      d.refersToNumber ?? "",
      csvCell(d.cancelReason ?? d.reason ?? ""),
      d.saleNumber ?? "",
    ].join(","),
  );
  return `﻿${[head, ...lines].join("\n")}\n`;
}

// ── One door for the StockLedger object ───────────────────────────────────────────────────────

/** Every tax-paper write, as the routes hand it to the StockLedger object. */
export type TaxAction =
  | { kind: "saveBuyer"; input: TaxBuyerInput & { phone?: unknown } }
  | { kind: "issue"; input: IssueInput }
  | { kind: "cancel"; id: string; reason: unknown };

export function runTaxAction(
  db: D1Database,
  action: TaxAction,
  shop: ShopTax,
  actor: TaxActor,
): Promise<{ ok: true } | Fail> {
  switch (action.kind) {
    case "saveBuyer":
      return saveTaxBuyer(db, action.input, actor);
    case "issue":
      return issueTaxInvoice(db, action.input, shop, actor);
    case "cancel":
      return cancelTaxDocument(db, action.id, action.reason, actor);
  }
}

/** Den Air's VAT billing switch and tax details, as ข้อมูลร้าน keeps them in KV. */
export async function readShopTax(kv: KVNamespace): Promise<ShopTax> {
  const [vatBilling, taxId, taxBranch, taxName, taxAddress] = await Promise.all(
    ["vatBilling", "taxId", "taxBranch", "taxName", "taxAddress"].map((f) =>
      kv.get(shopKey("denair", f)),
    ),
  );
  return {
    vatOn: vatBillingOn(vatBilling),
    taxId: taxId ?? "",
    taxBranch: taxBranch ?? "",
    taxName: taxName ?? "",
    taxAddress: taxAddress ?? "",
  };
}
