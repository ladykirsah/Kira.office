import { describe, it, expect } from "vitest";
import {
  faqPageJsonLd,
  faqAnswerPlainText,
  faqAnchorId,
  parseFaqAnswer,
  FAQ_SECTIONS,
  type FaqSection,
} from "./faq";

const MARKED = [
  "สั่งซื้อได้ตามขั้นตอนนี้:",
  "1. กด {r}ใส่ตะกร้า{/r} หรือ {r}ซื้อเลยตอนนี้{/r}",
  "2. เก็บเงินปลายทาง {b}ไม่มีค่าธรรมเนียมเพิ่ม{/b}",
  "ดูที่หน้า {r}วิธีสั่งซื้อ{/r}",
].join("\n");

const fixture: FaqSection[] = [
  {
    title: "A",
    titleEn: "A",
    items: [
      { q: "q1", a: "a1" },
      { q: "q2", a: "a2" },
    ],
  },
  { title: "B", titleEn: "B", items: [{ q: "q3", a: "a3" }] },
];

describe("faqPageJsonLd > flattens sections into one schema.org FAQPage", () => {
  it("emits FAQPage with one Question per Q&A across all sections", () => {
    const ld = faqPageJsonLd(fixture);
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("FAQPage");
    const main = ld.mainEntity as { "@type": string; name: string; acceptedAnswer: unknown }[];
    expect(main).toHaveLength(3);
    expect(main[0]).toEqual({
      "@type": "Question",
      name: "q1",
      acceptedAnswer: { "@type": "Answer", text: "a1" },
    });
    expect(main[2].name).toBe("q3");
  });
});

describe("faqAnswerPlainText > strips markup for JSON-LD", () => {
  it("given highlight tokens and step lines > returns space-joined text with no tokens", () => {
    expect(faqAnswerPlainText(MARKED)).toBe(
      "สั่งซื้อได้ตามขั้นตอนนี้: 1. กด ใส่ตะกร้า หรือ ซื้อเลยตอนนี้ 2. เก็บเงินปลายทาง ไม่มีค่าธรรมเนียมเพิ่ม ดูที่หน้า วิธีสั่งซื้อ",
    );
  });

  it("given a plain single-line answer > returns it unchanged", () => {
    expect(faqAnswerPlainText("a1")).toBe("a1");
  });
});

describe("parseFaqAnswer > structures answers for rendering", () => {
  it("given a plain answer > returns one paragraph block", () => {
    expect(parseFaqAnswer("a1")).toEqual([{ type: "p", parts: [{ text: "a1" }] }]);
  });

  it("given intro, numbered lines and outro > returns p / steps / p blocks", () => {
    const blocks = parseFaqAnswer(MARKED);
    expect(blocks.map((b) => b.type)).toEqual(["p", "steps", "p"]);
    const steps = blocks[1] as Extract<
      ReturnType<typeof parseFaqAnswer>[number],
      { type: "steps" }
    >;
    expect(steps.items).toHaveLength(2);
  });

  it("given {r} and {b} tokens > splits into colored parts without the numbering prefix", () => {
    const blocks = parseFaqAnswer(MARKED);
    const steps = blocks[1] as Extract<
      ReturnType<typeof parseFaqAnswer>[number],
      { type: "steps" }
    >;
    expect(steps.items[0]).toEqual([
      { text: "กด " },
      { text: "ใส่ตะกร้า", color: "red" },
      { text: " หรือ " },
      { text: "ซื้อเลยตอนนี้", color: "red" },
    ]);
    expect(steps.items[1]).toEqual([
      { text: "เก็บเงินปลายทาง " },
      { text: "ไม่มีค่าธรรมเนียมเพิ่ม", color: "blue" },
    ]);
    expect(blocks[2]).toEqual({
      type: "p",
      parts: [{ text: "ดูที่หน้า " }, { text: "วิธีสั่งซื้อ", color: "red" }],
    });
  });
});

describe("parseFaqAnswer > link tokens", () => {
  it("given {l:href} token > yields a part with href, and plain text strips it", () => {
    const a = "ดูที่หน้า {l:/how-to-order}วิธีสั่งซื้อ{/l} ได้เลย";
    expect(parseFaqAnswer(a)).toEqual([
      {
        type: "p",
        parts: [
          { text: "ดูที่หน้า " },
          { text: "วิธีสั่งซื้อ", href: "/how-to-order" },
          { text: " ได้เลย" },
        ],
      },
    ]);
    expect(faqAnswerPlainText(a)).toBe("ดูที่หน้า วิธีสั่งซื้อ ได้เลย");
  });
});

describe("parseFaqAnswer > external link tokens", () => {
  it("given an https URL with Thai path in {l:} > keeps the full URL as href", () => {
    const url = "https://th.carservicepartner.com/ร้านเด่นแอร์-สุรินทร์";
    expect(parseFaqAnswer(`พาร์ทเนอร์ของ {l:${url}}เด่นแอร์ เซอร์วิส{/l}`)).toEqual([
      {
        type: "p",
        parts: [{ text: "พาร์ทเนอร์ของ " }, { text: "เด่นแอร์ เซอร์วิส", href: url }],
      },
    ]);
  });
});

describe("faqPageJsonLd > answer text is plain", () => {
  it("given an answer with markup > acceptedAnswer.text has no tokens or newlines", () => {
    const ld = faqPageJsonLd([{ title: "M", titleEn: "M", items: [{ q: "qm", a: MARKED }] }]);
    const main = ld.mainEntity as { acceptedAnswer: { text: string } }[];
    expect(main[0].acceptedAnswer.text).not.toMatch(/[{}\n]/);
    expect(main[0].acceptedAnswer.text).toContain("ใส่ตะกร้า");
  });
});

describe("faqAnchorId > card anchors for in-page links", () => {
  it("given a question with spaces > replaces whitespace so the id is hash-linkable", () => {
    expect(faqAnchorId("สั่งไปแล้วเปลี่ยนใจ หรือสั่งผิด ทำอย่างไร?")).toBe(
      "สั่งไปแล้วเปลี่ยนใจ-หรือสั่งผิด-ทำอย่างไร?",
    );
  });

  it("given a question without spaces > returns it unchanged", () => {
    expect(faqAnchorId("สินค้ามีการรับประกันไหม?")).toBe("สินค้ามีการรับประกันไหม?");
  });
});

describe("FAQ_SECTIONS > is well-formed content", () => {
  it("has sections, each with non-empty Q and A", () => {
    expect(FAQ_SECTIONS.length).toBeGreaterThan(0);
    for (const s of FAQ_SECTIONS) {
      expect(s.items.length).toBeGreaterThan(0);
      for (const it of s.items) {
        expect(it.q.trim().length).toBeGreaterThan(0);
        expect(it.a.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
