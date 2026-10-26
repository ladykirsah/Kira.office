import { describe, expect, it } from "vitest";
import { LANG_COOKIE, readLang, otherLang, say, type Phrase } from "./lang";

/**
 * Thai or English, chosen with a button and remembered (owner, 2026-08-25).
 *
 * The pure half lives here so the decision — which language is this page in — can be tested exactly,
 * away from cookies, React and the server.
 */
describe("readLang", () => {
  it("given a language that exists > then that one", () => {
    expect(readLang("th")).toBe("th");
    expect(readLang("en")).toBe("en");
  });

  /**
   * THAI IS THE DEFAULT (owner, 2026-08-25). A Thai mechanic signing in for the first time should
   * not have to find a button before the screen speaks to them; the owner reads both and can flip.
   */
  it("given nothing chosen yet > then Thai", () => {
    expect(readLang(null)).toBe("th");
    expect(readLang("")).toBe("th");
  });

  /**
   * A cookie is typed by whoever holds the browser, so it is untrusted input like any other. Junk
   * falls back rather than reaching a dictionary lookup as an unknown key.
   */
  it("given anything else > then Thai, never the raw value", () => {
    expect(readLang("EN")).toBe("th");
    expect(readLang("th-TH")).toBe("th");
    expect(readLang("fr")).toBe("th");
    expect(readLang("__proto__")).toBe("th");
  });
});

describe("otherLang", () => {
  it("names the one the button would switch to", () => {
    expect(otherLang("th")).toBe("en");
    expect(otherLang("en")).toBe("th");
  });
});

describe("say", () => {
  const payments: Phrase = { th: "การจ่ายเงิน", en: "Payments" };

  it("given a phrase > then the side asked for", () => {
    expect(say("th", payments)).toBe("การจ่ายเงิน");
    expect(say("en", payments)).toBe("Payments");
  });

  /**
   * Both sides are written together, at the point of use, on purpose: a phrase and its translation
   * that live on one line cannot drift apart, and nothing can be left behind as an orphan key in a
   * file nobody opens.
   */
  it("given a phrase that is the same in both > then it still reads it, not a fallback", () => {
    expect(say("th", { th: "AirPlus", en: "AirPlus" })).toBe("AirPlus");
  });
});

describe("LANG_COOKIE", () => {
  it("is a plain name a server and a browser can both use", () => {
    expect(LANG_COOKIE).toBe("kira-lang");
  });
});
