import { describe, it, expect } from "vitest";
import { faqPageJsonLd, FAQ_SECTIONS, type FaqSection } from "./faq";

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
