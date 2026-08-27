import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findUntranslated, isUserFacing } from "./untranslated";

describe("isUserFacing", () => {
  it("counts a phrase a person reads", () => {
    expect(isUserFacing("Save the refund")).toBe(true);
    expect(isUserFacing("เตรียมจัดส่ง")).toBe(true);
  });

  it("ignores what a machine matches, not a person", () => {
    expect(isUserFacing("btn-primary")).toBe(false);
    expect(isUserFacing("/orders/new")).toBe(false);
    expect(isUserFacing("PENDING")).toBe(false);
    expect(isUserFacing("var(--text)")).toBe(false);
  });

  /** A name is not a word. Translating "AirPlus" would be wrong, not merely unnecessary. */
  it("ignores the names of shops and channels", () => {
    expect(isUserFacing("AirPlus")).toBe(false);
    expect(isUserFacing("Shopee")).toBe(false);
    expect(isUserFacing("Den Air Service")).toBe(false);
  });
});

describe("findUntranslated", () => {
  it("finds a heading, an attribute and a bare Thai string", () => {
    const src = `
      <h2>Payments</h2>
      <input placeholder="Search here" />
      <span>{t({ th: "วันหยุด", en: "Days off" })}</span>
      const msg = "บันทึกแล้ว";
    `;
    const found = findUntranslated(src).map((f) => f.text);
    expect(found).toContain("Payments");
    expect(found).toContain('placeholder="Search here"');
    expect(found).toContain("bare Thai: บันทึกแล้ว");
  });

  it("says nothing about text already inside t({ th, en })", () => {
    const src = `<h2>{t({ th: "รายการจ่ายเงิน", en: "Payments" })}</h2>`;
    expect(findUntranslated(src)).toEqual([]);
  });

  it("ignores comments, which are for us and not for the screen", () => {
    expect(findUntranslated(`// Save the order first\n/* Then Publish it */`)).toEqual([]);
  });

  /**
   * A comment at the END of a line of code, which the first version did not strip. One of these —
   * `) : // Exchange resolution — ship the replacement …` — was reported as text on a screen.
   */
  it("ignores a comment sitting at the end of a line of code", () => {
    const src = [
      "        </div>",
      "      )",
      "    ) : // Exchange resolution — ship the replacement with a carrier.",
      "    !showResolve ? (",
      "      <div>",
    ].join("\n");
    expect(findUntranslated(src)).toEqual([]);
    // and does not mistake the slashes in a link for the start of one
    expect(findUntranslated(`const u = "https://airplusauto.com/Orders";`)).toEqual([]);
  });

  /**
   * THE FOUR BLIND SPOTS, found by reading the coupons screen after the finder called it clean
   * (2026-08-26). Each one had let real English through on screens already declared finished.
   */
  it("finds text that prettier wrapped onto its own line", () => {
    const src = [
      '<button className="btn-sm" onClick={() => arm(false)}>',
      "  Cancel",
      "</button>",
    ].join("\n");
    expect(findUntranslated(src).map((f) => f.text)).toContain("Cancel");
  });

  it("finds a sentence wrapped across several lines", () => {
    const src = ["<p>", "  No coupons yet.", "  Add one above.", "</p>"].join("\n");
    expect(findUntranslated(src).map((f) => f.text)).toContain("No coupons yet. Add one above.");
  });

  it("finds a phrase picked inside braces rather than written as JSX text", () => {
    const found = findUntranslated(`<button>{busy ? "Saving…" : "Save note"}</button>`).map(
      (f) => f.text,
    );
    expect(found).toContain("Saving…");
    expect(found).toContain("Save note");
  });

  /** A toast is a screen. It was invisible to the finder because it is not JSX at all. */
  it("finds the words in a message that pops up", () => {
    const src = `toast("Draft saved — reopen it any time.", "success");`;
    expect(findUntranslated(src).map((f) => f.text)).toContain("Draft saved — reopen it any time.");
  });

  it("finds a label built with a backtick", () => {
    expect(findUntranslated("const l = `Added ${p.name}`;").map((f) => f.text)).toContain(
      "Added ${p.name}",
    );
  });

  /**
   * AND THE FALSE ALARMS THAT COME WITH THEM. A finder that cries wolf gets ignored, which is the
   * same as not having one — so each of these is a test, not a note.
   */
  it("says nothing about the name of a key on the keyboard", () => {
    expect(findUntranslated(`if (e.key === "Escape") close();`)).toEqual([]);
    expect(findUntranslated(`if (e.key !== "Enter") return;`)).toEqual([]);
    expect(findUntranslated(`switch (e.key) { case "ArrowDown": next(); }`)).toEqual([]);
  });

  it("says nothing about the name of a font", () => {
    expect(findUntranslated(`fontFamily: "Helvetica Neue"`)).toEqual([]);
    expect(findUntranslated(`font: "12px Thonburi"`)).toEqual([]);
  });

  it("says nothing about the English half of a pair, however it is written", () => {
    expect(findUntranslated(`t({ th: "บันทึกแล้ว", en: "Saved" })`)).toEqual([]);
    expect(findUntranslated("t({ th: `หลักฐาน ${i}`, en: `Evidence ${i}` })")).toEqual([]);
    // prettier puts a long phrase on its own line, leaving `th:` a line behind it
    expect(
      findUntranslated(`t({\n  th: "รายการนี้ถูกลบไปแล้ว",\n  en: "That item is gone",\n})`),
    ).toEqual([]);
  });

  /**
   * A phrase does not have to start with a capital. `"paused — not for sale"` and `"hold to see
   * profit"` were both sitting in English under a product, and neither begins with one.
   */
  it("finds a phrase that happens to start lowercase", () => {
    const found = findUntranslated(`<span>{stopped ? "paused — not for sale" : ""}</span>`).map(
      (f) => f.text,
    );
    expect(found).toContain("paused — not for sale");
  });

  /**
   * Text with a NUMBER in the middle of it: `Items ({lines.length})`. The matcher ran from one tag
   * to the next, and an expression between them ended the run — so this heading sat in English on
   * the POS screen with everything around it in Thai.
   */
  it("finds text broken in half by a count", () => {
    const found = findUntranslated(`<div style={fieldLabel}>Items ({lines.length})</div>`).map(
      (f) => f.text,
    );
    expect(found.join(" ")).toContain("Items");
  });

  it("finds text that comes after the count rather than before it", () => {
    const found = findUntranslated(`<span>{held} on hold, separate</span>`).map((f) => f.text);
    expect(found.join(" ")).toContain("on hold, separate");
  });

  /**
   * `>` is a tag in JSX and GREATER-THAN in everything else. Reading `held > 0 ? …` as a tag turned
   * the middle of a comparison into a phrase.
   */
  it("says nothing about a greater-than sign", () => {
    expect(findUntranslated("const x = held > 0 ? `keep ${held}` : ``;")).toEqual([]);
    expect(findUntranslated("const y = n >= 3 ? `over ${n}` : ``;")).toEqual([]);
  });

  /**
   * The wrapped-text matcher reaches from one `>` to the next `<`, which can step straight over the
   * code BETWEEN two JSX branches: `); const p = detail.product; return (` was reported as a phrase.
   */
  it("says nothing about a ternary sitting between two pieces of JSX", () => {
    const src = ["      </p>", '    ) : (tab === "advance" ? paidA : paidB) ? (', "      <b>"].join(
      "\n",
    );
    expect(findUntranslated(src)).toEqual([]);
  });

  it("says nothing about the code sitting between two pieces of JSX", () => {
    const src = [
      "      </main>",
      "    );",
      "",
      "  const p = detail.product;",
      "",
      "  return (",
      "    <main>",
    ].join("\n");
    expect(findUntranslated(src)).toEqual([]);
  });

  /**
   * AND WHERE THAT STOPS. Two lowercase words is where class names live, so the line is drawn at
   * three — which means a two-word fragment like `" · editing now"` gets past this and has to be
   * caught by reading the file. A known hole, kept deliberately: the alternative reported every
   * `className="pill soft"` in the app and would have made the whole thing worth ignoring.
   */
  it("leaves two lowercase words alone, because that is what class names look like", () => {
    expect(findUntranslated(`<span className="pill soft" />`)).toEqual([]);
    expect(findUntranslated(`<button className="btn-danger btn-sm" />`)).toEqual([]);
  });

  /**
   * Two words was the whole guard, and a THIRD one walks straight past it: `"muted num
   * activity-time"` has no digit, starts lowercase, and counts three words of which two are long
   * enough — the exact shape of prose. The class list is not a shorter sentence, it is a different
   * kind of thing, so it is settled by WHERE it sits rather than by how many words it runs to.
   */
  it("leaves a class list alone however many names it runs to", () => {
    expect(findUntranslated(`<td className="muted num activity-time" />`)).toEqual([]);
    expect(findUntranslated(`<i className="icon-btn icon-btn-framed is-open" />`)).toEqual([]);
  });

  it("still says nothing about a style value, which is lowercase too", () => {
    expect(findUntranslated(`border: "1px solid var(--border)"`)).toEqual([]);
    expect(findUntranslated(`style={{ display: "inline-flex" }}`)).toEqual([]);
    expect(findUntranslated(`margin: "0 0 12px"`)).toEqual([]);
  });

  /** The words come out of `t({ })`; the backticks only glue them to a name. */
  it("says nothing about a backtick label whose words are already a pair", () => {
    const src =
      'aria-label={`${open ? t({ th: "ย่อ", en: "Collapse" }) : t({ th: "ขยาย", en: "Expand" })} ${name}`}';
    expect(findUntranslated(src)).toEqual([]);
  });

  /**
   * Two empty strings on one line — `` `ก ${d ?? ""}`, en: `Recorded ${d ?? ""}` `` — and the naive
   * quote pairing takes the SECOND quote of the first pair and the FIRST of the second, capturing
   * the code between two templates as if it were a sentence.
   */
  it("says nothing about the gap between two templates on one line", () => {
    const src =
      'text: (d) => ({ th: `ลบวันหยุด — ${d ?? ""}`, en: `Deleted a day off — ${d ?? ""}` }),';
    expect(findUntranslated(src)).toEqual([]);
  });

  it("says nothing about the key of an object, which no one reads", () => {
    expect(findUntranslated(`headers: { "Content-Type": "application/json" }`)).toEqual([]);
  });
});

/**
 * THE SCREENS THAT ARE DONE STAY DONE (owner, 2026-08-25: "re-check on every spot").
 *
 * The rest of the admin is still being worked through, so this guards only the folders that have
 * been finished. Add a folder here the moment its sweep is complete — that is what stops the next
 * screen from quietly undoing this one.
 */
const CLEARED = [
  "app/products",
  "app/orders",
  "app/nav.ts",
  "app/Sidebar.tsx",
  "app/MobileNav.tsx",
  "app/AppShell.tsx",
  "app/StaffChip.tsx",
  "app/ThemeToggle.tsx",
  "app/LanguageToggle.tsx",
  "app/Modal.tsx",
  "app/page.tsx",
  "app/pos",
  "app/settings/coupons",
  // The two screens OUTSIDE the app frame. They are the first thing anybody sees, and until
  // 2026-08-26 they were the only ones still entirely in English.
  "app/login",
  "app/recover",
  "app/settings/staff",
  "app/me",
  "app/customers",
  // Two of the four buttons on the phone's bottom bar, so they are touched constantly.
  "app/scan",
  "app/payment",
  "app/StaffChip.tsx",
  // Shared pieces the coupons screen renders, each of which was English on every screen using it.
  "app/ConfirmButton.tsx",
  "app/DateTimeField.tsx",
  "app/NoAccess.tsx",
];

/**
 * Resolved from THIS FILE, not from `process.cwd()`. Vitest runs from the repo root, so a
 * cwd-relative path pointed at a directory that does not exist, the scan found no files, and every
 * folder below passed while checking nothing. A test that cannot fail is worse than no test.
 */
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Text that is deliberately ONE language, with the reason. Not a to-do list — each of these would be
 * a bug if it were translated.
 */
interface Exception {
  reason: string;
  /**
   * When present, ONLY these exact strings are excused and the rest of the file is still guarded.
   * A whole-file exception would stop watching the screen that shares it — the POS bill lives in
   * the same file as the POS screen.
   */
  texts?: string[];
}

/** Written into the stock ledger as the REASON for a movement — stored, never shown to anyone. */
const AUDIT = (text: string): Exception => ({
  reason: "an audit trail written into the stock ledger, not a screen",
  texts: [text],
});

const DELIBERATE: Record<string, Exception> = {
  // The owner's transcription Google Sheet has these exact Thai column headers. They are matched
  // against a real file, not read off a screen — translating one would break the import silently.
  "app/customers/page.tsx": {
    reason: "the column headers in the owner's own transcription spreadsheet",
    texts: [
      "ทะเบียน",
      "จังหวัด",
      "ชื่อลูกค้า",
      "เบอร์โทร",
      "รุ่นรถ",
      "หมายเหตุ",
      "วันที่",
      "รายการ",
    ],
  },
  "app/products/StockCell.tsx": AUDIT("edited from products table"),
  "app/products/[id]/edit/page.tsx": AUDIT("edited from product page"),
  "app/products/new/page.tsx": AUDIT("created from Add product"),
  "app/scan/page.tsx": AUDIT("received via Scan here"),
  // The sticker that goes on the parcel. It is read by a Thai courier and a Thai recipient; which
  // language the person at the screen is reading has nothing to do with it.
  "app/orders/[id]/ShipmentActions.tsx": { reason: "the printed shipping label" },
  // The button that offers Thai says so IN Thai, exactly as the English side says "Switch to
  // English" in English. A label naming a language must be written in that language.
  "app/LanguageToggle.tsx": { reason: "each label names its own language" },
  // The POS bill and quotation already had their OWN Thai/English switch (`billLang`), chosen per
  // document. That language belongs to the CUSTOMER receiving the bill, not to whoever is standing
  // at the till — wiring the UI toggle into it would print English bills for Thai customers. Only
  // the document's own words are excused; the POS screen around them is still guarded.
  "app/pos/page.tsx": {
    reason: "the printed bill and quotation carry their own billLang",
    texts: [
      "ใบเสนอราคา",
      "บิลเงินสด",
      "เลขที่บิล",
      "วันที่",
      "รถ",
      "ทะเบียน",
      "เลขไมล์",
      "รายการ",
      "จำนวน",
      "ราคา",
      "รวม",
      "ยังไม่มีรายการ",
      "รวมย่อย",
      "ส่วนลด",
      "รวมทั้งสิ้น",
      "รวมโดยประมาณ",
      "หมายเหตุ",
      "*** ขอบคุณที่ใช้บริการ ***",
      "QR ติดต่อ",
      // …and the same document in English. The finder reads BOTH halves of the dictionary now, so
      // both halves have to be named here.
      "Sales ID",
      "Date",
      "Vehicle",
      "Plate",
      "Mileage",
      "Item",
      "Qty",
      "Price",
      "Amount",
      "No items yet",
      "Subtotal",
      "Discount",
      "Total",
      "Estimate",
      "Note",
      "*** Thank you ***",
      "Contact QR",
      // The billLang buttons: each names its own language, as the app's own toggle does.
      "ไทย",
      "English",
    ],
  },
};

function filesUnder(rel: string): string[] {
  const abs = join(SRC, rel);
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isFile()) return [abs];
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesUnder(join(rel, e.name))
      : /\.tsx?$/.test(e.name) && !e.name.includes(".test.")
        ? [join(abs, e.name)]
        : [],
  );
}

describe("the finished screens say everything in both languages", () => {
  // The guard against the bug this suite already had once: if the scan reads nothing, every
  // assertion below is vacuously true and the suite is decoration.
  it("every deliberate exception names a file that exists", () => {
    // An exception for a file that has been renamed away would silently stop guarding anything.
    const all = new Set(CLEARED.flatMap(filesUnder).map((f) => f.split("/src/")[1]!));
    expect(Object.keys(DELIBERATE).filter((k) => !all.has(k))).toEqual([]);
  });

  it("actually reads the source files", () => {
    const count = CLEARED.flatMap(filesUnder).length;
    expect(count).toBeGreaterThan(30);
  });

  for (const rel of CLEARED) {
    it(`${rel} has no untranslated text left`, () => {
      const misses = filesUnder(rel).flatMap((f) => {
        const key = f.split("/src/")[1]!;
        const ex = DELIBERATE[key];
        if (ex && !ex.texts) return [];
        const excused = new Set(ex?.texts ?? []);
        return findUntranslated(readFileSync(f, "utf8"))
          .filter((m) => !excused.has(m.text.replace(/^bare Thai: /, "")))
          .map((m) => `${key}:${m.line}: ${m.text}`);
      });
      expect(misses).toEqual([]);
    });
  }
});
