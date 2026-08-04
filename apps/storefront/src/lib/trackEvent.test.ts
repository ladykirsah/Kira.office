import { describe, it, expect } from "vitest";
import { parseTrackBody, safePath, visitorHash } from "./trackEvent";

describe("parseTrackBody", () => {
  it("given a well-formed beacon > then accepts it", () => {
    expect(
      parseTrackBody({ kind: "product_view", path: "/products/abc", productId: "p1" }),
    ).toEqual({ kind: "product_view", path: "/products/abc", productId: "p1", referrer: null });
  });

  it("given a kind the table's CHECK would refuse > then rejects it here first", () => {
    // The beacon is a PUBLIC endpoint: anything can POST to it. Validating against the same closed
    // set the migration's CHECK uses means junk is a 400, not a 500 from D1.
    expect(parseTrackBody({ kind: "purchase" })).toBeNull();
    expect(parseTrackBody({ kind: "" })).toBeNull();
  });

  it("given a non-object or a missing kind > then rejects it", () => {
    expect(parseTrackBody(null)).toBeNull();
    expect(parseTrackBody("page_view")).toBeNull();
    expect(parseTrackBody({ path: "/" })).toBeNull();
  });

  it("given a path with a query string > then keeps only the path", () => {
    // A search page's ?q= carries what the visitor typed. That is their data, not our metric.
    expect(parseTrackBody({ kind: "page_view", path: "/search?q=compressor#top" })?.path).toBe(
      "/search",
    );
  });

  it("given a non-string productId > then drops it instead of storing junk", () => {
    expect(parseTrackBody({ kind: "click", productId: 42 })?.productId).toBeNull();
  });

  it("given an absurdly long path > then truncates rather than rejecting the visit", () => {
    const long = `/${"a".repeat(5000)}`;
    const parsed = parseTrackBody({ kind: "page_view", path: long });
    expect(parsed?.path?.length).toBeLessThanOrEqual(256);
  });
});

describe("safePath", () => {
  it("given a full URL > then returns the path alone", () => {
    expect(safePath("https://airplusauto.com/products/x?utm_source=fb")).toBe("/products/x");
  });

  it("given something unparseable > then returns null rather than throwing", () => {
    expect(safePath("%%%")).toBeNull();
  });
});

describe("visitorHash", () => {
  const SALT = "test-salt";
  const DAY = 1785776400000;

  it("given the same visitor on the same day > then the same hash, so they count once", () => {
    return Promise.all([
      visitorHash(DAY, "1.2.3.4", "Mozilla/5.0", SALT),
      visitorHash(DAY, "1.2.3.4", "Mozilla/5.0", SALT),
    ]).then(([a, b]) => expect(a).toBe(b));
  });

  it("given the same visitor tomorrow > then a DIFFERENT hash", async () => {
    // The whole privacy design rests on this: the identifier cannot follow anybody across a day,
    // so it can never be used to build a profile.
    const today = await visitorHash(DAY, "1.2.3.4", "Mozilla/5.0", SALT);
    const tomorrow = await visitorHash(DAY + 86400000, "1.2.3.4", "Mozilla/5.0", SALT);
    expect(tomorrow).not.toBe(today);
  });

  it("given different people on one day > then different hashes", async () => {
    const a = await visitorHash(DAY, "1.2.3.4", "Mozilla/5.0", SALT);
    const b = await visitorHash(DAY, "5.6.7.8", "Mozilla/5.0", SALT);
    expect(a).not.toBe(b);
  });

  it("given any input > then the hash never contains the raw IP", async () => {
    const h = await visitorHash(DAY, "203.0.113.9", "Mozilla/5.0", SALT);
    expect(h).not.toContain("203.0.113.9");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("parseTrackBody > referrer", () => {
  it("given a referrer > then it is carried through for classification", () => {
    // It must come from the BODY, not the request's Referer header: on a beacon POST that header is
    // the page doing the sending — our own — so classifying it would label every arrival in the
    // world as "internal" and leave the traffic-source table permanently empty.
    expect(
      parseTrackBody({ kind: "page_view", referrer: "https://www.google.com/" })?.referrer,
    ).toBe("https://www.google.com/");
  });

  it("given no referrer > then null, which classifies as direct", () => {
    expect(parseTrackBody({ kind: "page_view" })?.referrer).toBeNull();
  });

  it("given a non-string referrer > then null rather than junk", () => {
    expect(parseTrackBody({ kind: "page_view", referrer: 99 })?.referrer).toBeNull();
  });

  it("given an over-long referrer > then truncated, so a huge header cannot be posted at us", () => {
    const long = `https://x.com/${"a".repeat(5000)}`;
    expect(
      parseTrackBody({ kind: "page_view", referrer: long })?.referrer?.length,
    ).toBeLessThanOrEqual(512);
  });
});
