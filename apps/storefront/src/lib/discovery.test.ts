import { describe, it, expect } from "vitest";
import { escapeXml, CORE_PAGES } from "./discovery";

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml("Toyota & Honda")).toBe("Toyota &amp; Honda");
    expect(escapeXml("<x>")).toBe("&lt;x&gt;");
    expect(escapeXml("\"q\" 'a'")).toBe("&quot;q&quot; &apos;a&apos;");
  });

  it("escapes every occurrence (global), left to right", () => {
    expect(escapeXml("a&b&c")).toBe("a&amp;b&amp;c");
  });

  it("does not double-escape an ampersand", () => {
    expect(escapeXml("A & B")).toBe("A &amp; B");
    expect(escapeXml("A &amp; B")).toBe("A &amp;amp; B");
  });

  it("leaves ordinary text (incl. Thai) and slashes untouched", () => {
    expect(escapeXml("ตู้แอร์ Vigo / Fortuner")).toBe("ตู้แอร์ Vigo / Fortuner");
    expect(escapeXml("")).toBe("");
  });
});

describe("CORE_PAGES (public discovery)", () => {
  it("lists only absolute, in-site paths", () => {
    for (const p of CORE_PAGES) {
      expect(p.path.startsWith("/"), p.path).toBe(true);
      expect(p.path).not.toContain("://");
      expect(p.title.length).toBeGreaterThan(0);
    }
  });

  it("never exposes authenticated or transient routes to crawlers/agents", () => {
    for (const p of CORE_PAGES) {
      expect(p.path, p.path).not.toMatch(/^\/(account|checkout|cart)(\/|$)/);
    }
  });
});
