import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { refundSaleToDb } from "./index";
import {
  cancelTaxDocument,
  getTaxDocument,
  issueTaxInvoice,
  listTaxBuyers,
  listTaxDocuments,
  saveTaxBuyer,
  taxDocumentsCsv,
  type ShopTax,
} from "./taxDocs";

vi.mock("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
}));

// VAT billing (plan 10.2, owner 17 Nov 2026): B2C → cash bill; B2B → cash bill or tax invoice,
// picked per sale, the company kept in a book. Real schema, foreign keys on. Tax IDs are made up;
// only their check digit is real.

const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/db/migrations",
);

// 17 Nov 2026, 10:00 in Bangkok.
const T0 = Date.UTC(2026, 10, 17, 3, 0);
const at = (minutes: number) => ({ userId: "u-kae", now: T0 + minutes * 60_000 });

const DEN_AIR: ShopTax = {
  vatOn: true,
  taxId: "1234567890121",
  taxBranch: "",
  taxName: "บริษัท เด่นแอร์ เซอร์วิส จำกัด",
  taxAddress: "1 ถนนตัวอย่าง กรุงเทพฯ 10110",
};
const FLEET = {
  name: "บริษัท ขนส่งตัวอย่าง จำกัด",
  taxId: "0-1055-36000-31-3",
  branch: "00002",
  address: "99 ถนนตัวอย่าง เชียงใหม่ 50000",
};

function shop() {
  const raw = new DatabaseSync(":memory:");
  for (const f of readdirSync(migrationsDir)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    raw.exec(readFileSync(join(migrationsDir, f), "utf8"));
  }
  raw.exec("PRAGMA foreign_keys = ON");
  raw.exec(
    "INSERT INTO users (id, name, email, role, status, created_at) VALUES ('u-kae', 'เก๋', 'kae@shop.test', 'super_admin', 'active', 0)",
  );
  const db = {
    prepare: (sql: string) => {
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async all<T>() {
          return { results: raw.prepare(sql).all(...(binds as never[])) as T[] };
        },
        async first<T>() {
          return (raw.prepare(sql).get(...(binds as never[])) as T | undefined) ?? null;
        },
        async run() {
          return raw.prepare(sql).run(...(binds as never[]));
        },
        __exec() {
          return raw.prepare(sql).run(...(binds as never[]));
        },
      };
      return stmt;
    },
    async batch(stmts: { __exec: () => unknown }[]) {
      raw.exec("BEGIN");
      try {
        const out = stmts.map((s) => s.__exec());
        raw.exec("COMMIT");
        return out;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
  } as unknown as D1Database;
  return { raw, db };
}

/** A paid counter bill: ฿3,210 with ฿210 VAT inside (a part ฿2,140 + labour ฿1,070). */
function paidBill(raw: DatabaseSync, id: string, createdAt = T0) {
  raw
    .prepare(
      `INSERT INTO onsite_sales (id, client_uuid, sale_number, payment_method, sale_type, subtotal_satang,
         discount_total_satang, tax_total_satang, grand_total_satang, sale_status, created_at)
       VALUES (?, ?, ?, 'cash', 'repair', 321000, 0, 21000, 321000, 'completed', ?)`,
    )
    .run(id, `cu-${id}`, `DAS-${id}`, createdAt);
  raw
    .prepare(
      `INSERT INTO onsite_sale_lines (id, onsite_sale_id, line_type, description, quantity,
         unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
       VALUES (?, ?, 'service', 'ค่าแรงเปลี่ยนคอม', 1, 107000, 0, 7000, 0, 100000),
              (?, ?, 'service', 'ล้างแอร์', 1, 214000, 0, 14000, 0, 200000)`,
    )
    .run(`${id}-l1`, id, `${id}-l2`, id);
}

function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`expected ok, got ${(r as unknown as { error: string }).error}`);
  return r as Extract<T, { ok: true }>;
}

describe("the company book", () => {
  it("given a new company > then it is kept (tax ID as digits) and found by name or tax ID", async () => {
    const { db } = shop();
    const saved = ok(await saveTaxBuyer(db, FLEET, at(0)));
    expect(saved.buyer).toMatchObject({ taxId: "0105536000313", branch: "00002" });
    expect((await listTaxBuyers(db, "ขนส่ง")).map((b) => b.id)).toEqual([saved.buyer.id]);
    expect((await listTaxBuyers(db, "01055")).map((b) => b.id)).toEqual([saved.buyer.id]);
    expect(await listTaxBuyers(db, "ไม่มี")).toEqual([]);
  });

  it("given the same tax ID and branch again > then the one row is updated, not doubled", async () => {
    const { db } = shop();
    const first = ok(await saveTaxBuyer(db, FLEET, at(0)));
    const again = ok(await saveTaxBuyer(db, { ...FLEET, address: "ที่อยู่ใหม่" }, at(1)));
    expect(again.buyer.id).toBe(first.buyer.id);
    expect((await listTaxBuyers(db, "")).map((b) => b.address)).toEqual(["ที่อยู่ใหม่"]);
  });

  it("given a bad tax ID > then refused", async () => {
    const { db } = shop();
    expect(await saveTaxBuyer(db, { ...FLEET, taxId: "0105536000312" }, at(0))).toMatchObject({
      ok: false,
      status: 400,
      error: "tax ID check digit is wrong",
    });
  });
});

describe("issueTaxInvoice > picked at payment for a company", () => {
  it("given a paid bill and a company typed on the spot > then TI…-0001 with both sides' details kept, and the company saved for next time", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    const out = ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(5)));
    expect(out.document).toMatchObject({
      kind: "tax_invoice",
      docNumber: "TI202611-0001",
      status: "issued",
      issuedAt: T0 + 5 * 60_000,
      sellerName: "บริษัท เด่นแอร์ เซอร์วิส จำกัด",
      sellerTaxId: "1234567890121",
      sellerBranch: "00000",
      buyerName: "บริษัท ขนส่งตัวอย่าง จำกัด",
      buyerTaxId: "0105536000313",
      buyerBranch: "00002",
      beforeVatSatang: 300_000,
      vatSatang: 21_000,
      totalSatang: 321_000,
    });
    expect((await listTaxBuyers(db, "ขนส่ง")).length).toBe(1);
  });

  it("given a company picked from the book > then the next number, and the book row linked", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    paidBill(raw, "b2");
    const buyer = ok(await saveTaxBuyer(db, FLEET, at(0))).buyer;
    ok(await issueTaxInvoice(db, { saleId: "b1", buyerId: buyer.id }, DEN_AIR, at(5)));
    const second = ok(
      await issueTaxInvoice(db, { saleId: "b2", buyerId: buyer.id }, DEN_AIR, at(6)),
    );
    expect(second.document).toMatchObject({ docNumber: "TI202611-0002", buyerId: buyer.id });
  });

  it("given the shop's switch off, or its tax details not filled in > then refused, naming what is missing", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    expect(
      await issueTaxInvoice(
        db,
        { saleId: "b1", buyer: FLEET },
        { ...DEN_AIR, vatOn: false },
        at(5),
      ),
    ).toMatchObject({ ok: false, status: 409, error: "vat_billing_off" });
    expect(
      await issueTaxInvoice(
        db,
        { saleId: "b1", buyer: FLEET },
        { ...DEN_AIR, taxId: "", taxAddress: " " },
        at(5),
      ),
    ).toMatchObject({
      ok: false,
      status: 409,
      error: "shop_tax_details_missing",
      missing: ["taxId", "taxAddress"],
    });
  });

  it("given a bill already with a live tax invoice, a refunded bill, or a bill from another day > then refused", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    paidBill(raw, "old", T0 - 24 * 60 * 60_000);
    paidBill(raw, "back");
    raw.exec("UPDATE onsite_sales SET sale_status = 'refunded' WHERE id = 'back'");
    ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(5)));
    expect(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(6))).toMatchObject(
      { ok: false, status: 409, error: "already_issued" },
    );
    expect(
      await issueTaxInvoice(db, { saleId: "back", buyer: FLEET }, DEN_AIR, at(6)),
    ).toMatchObject({ ok: false, status: 409, error: "not_a_paid_bill" });
    expect(
      await issueTaxInvoice(db, { saleId: "old", buyer: FLEET }, DEN_AIR, at(6)),
    ).toMatchObject({ ok: false, status: 409, error: "not_same_day" });
  });

  it("given no company, or a company with a gap > then refused", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    expect(await issueTaxInvoice(db, { saleId: "b1" }, DEN_AIR, at(5))).toMatchObject({
      ok: false,
      status: 400,
      error: "buyer_required",
    });
    expect(
      await issueTaxInvoice(db, { saleId: "b1", buyer: { ...FLEET, address: "" } }, DEN_AIR, at(5)),
    ).toMatchObject({ ok: false, status: 400, error: "address is required" });
  });
});

describe("cancelTaxDocument > never deleted; a mistake is cancelled and issued again", () => {
  it("given a reason > then kept as ยกเลิก, and a new one can be issued — even another day — naming the one it replaces", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    const first = ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(5)));
    const cancelled = ok(
      await cancelTaxDocument(db, first.document.id, "ที่อยู่ลูกค้าผิด", at(30)),
    );
    expect(cancelled.document).toMatchObject({
      status: "cancelled",
      cancelReason: "ที่อยู่ลูกค้าผิด",
      cancelledAt: T0 + 30 * 60_000,
    });
    const nextDay = { userId: "u-kae", now: T0 + 24 * 60 * 60_000 };
    const again = ok(
      await issueTaxInvoice(
        db,
        { saleId: "b1", buyer: { ...FLEET, address: "ที่อยู่ที่ถูก" } },
        DEN_AIR,
        nextDay,
      ),
    );
    expect(again.document).toMatchObject({
      docNumber: "TI202611-0002",
      replacesId: first.document.id,
      buyerAddress: "ที่อยู่ที่ถูก",
    });
  });

  it("given no reason, or one already cancelled > then refused", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    const doc = ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(5)));
    expect(await cancelTaxDocument(db, doc.document.id, " ", at(6))).toMatchObject({
      ok: false,
      status: 400,
      error: "reason_required",
    });
    ok(await cancelTaxDocument(db, doc.document.id, "ผิด", at(6)));
    expect(await cancelTaxDocument(db, doc.document.id, "ผิด", at(7))).toMatchObject({
      ok: false,
      status: 409,
      error: "already_cancelled",
    });
  });
});

describe("refund > a bill with a tax invoice gets a ใบลดหนี้", () => {
  it("given the bill refunded > then CN…-0001 for the whole bill, pointing at the invoice, and the invoice can't be cancelled any more", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    const invoice = ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(5)));
    const refund = await refundSaleToDb(db, "b1", { userId: "u-kae", reason: "ลูกค้าคืนของ" });
    expect(refund).toMatchObject({ applied: true, creditNoteNumber: "CN202611-0001" });
    const month = await listTaxDocuments(db, "2026-11");
    expect(month.documents.map((d) => [d.docNumber, d.kind, d.refersToNumber, d.reason])).toEqual([
      ["TI202611-0001", "tax_invoice", null, null],
      ["CN202611-0001", "credit_note", "TI202611-0001", "ลูกค้าคืนของ"],
    ]);
    expect(await cancelTaxDocument(db, invoice.document.id, "ผิด", at(60))).toMatchObject({
      ok: false,
      status: 409,
      error: "has_credit_note",
    });
  });

  it("given a bill with no tax invoice > then the refund makes no credit note", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    const refund = await refundSaleToDb(db, "b1", { userId: "u-kae", reason: null });
    expect(refund).toMatchObject({ applied: true });
    expect(refund.creditNoteNumber).toBeUndefined();
  });
});

describe("the monthly list for the accountant", () => {
  it("given invoices, a cancelled one and a credit note > then all listed, totals count only live ones (credit notes take away)", async () => {
    const { raw, db } = shop();
    for (const id of ["b1", "b2", "b3"]) paidBill(raw, id);
    const one = ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(1)));
    ok(await issueTaxInvoice(db, { saleId: "b2", buyer: FLEET }, DEN_AIR, at(2)));
    ok(await issueTaxInvoice(db, { saleId: "b3", buyer: FLEET }, DEN_AIR, at(3)));
    await refundSaleToDb(db, "b2", { userId: "u-kae", reason: null });
    ok(await cancelTaxDocument(db, one.document.id, "ชื่อบริษัทผิด", at(4)));

    const month = await listTaxDocuments(db, "2026-11");
    expect(month.documents.map((d) => [d.docNumber, d.status])).toEqual([
      ["TI202611-0001", "cancelled"],
      ["TI202611-0002", "issued"],
      ["TI202611-0003", "issued"],
      ["CN202611-0001", "issued"],
    ]);
    // Live: two invoices (b2, b3) less one credit note (b2) = one bill's worth.
    expect(month.totals).toEqual({
      beforeVatSatang: 300_000,
      vatSatang: 21_000,
      totalSatang: 321_000,
    });
    expect((await listTaxDocuments(db, "2026-10")).documents).toEqual([]);
  });

  it("given the CSV > then a header and one line per paper, in baht, Thai-readable in Excel", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(1)));
    const csv = taxDocumentsCsv((await listTaxDocuments(db, "2026-11")).documents);
    const [head, row] = csv.replace(/^﻿/, "").trim().split("\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(head).toBe(
      "เลขที่,ประเภท,วันที่,ลูกค้า,เลขผู้เสียภาษี,สาขา,มูลค่าก่อน VAT,VAT,รวม,สถานะ,อ้างถึง,เหตุผล,บิล",
    );
    expect(row).toBe(
      'TI202611-0001,ใบกำกับภาษี,2026-11-17,"บริษัท ขนส่งตัวอย่าง จำกัด",0105536000313,สาขาที่ 00002,3000.00,210.00,3210.00,ใช้ได้,,,DAS-b1',
    );
  });

  it("given a month that isn't YYYY-MM > then nothing", async () => {
    const { db } = shop();
    expect((await listTaxDocuments(db, "Nov")).documents).toEqual([]);
  });
});

describe("getTaxDocument > what the paper prints", () => {
  it("given a tax invoice > then its details and the bill's lines", async () => {
    const { raw, db } = shop();
    paidBill(raw, "b1");
    const doc = ok(await issueTaxInvoice(db, { saleId: "b1", buyer: FLEET }, DEN_AIR, at(1)));
    const paper = await getTaxDocument(db, doc.document.id);
    expect(paper).toMatchObject({ docNumber: "TI202611-0001", saleNumber: "DAS-b1" });
    expect(
      paper?.lines.map((l) => [l.description, l.quantity, l.unitPriceSatang, l.taxSatang]),
    ).toEqual([
      ["ค่าแรงเปลี่ยนคอม", 1, 107_000, 7_000],
      ["ล้างแอร์", 1, 214_000, 14_000],
    ]);
    expect(await getTaxDocument(db, "nope")).toBeNull();
  });
});
