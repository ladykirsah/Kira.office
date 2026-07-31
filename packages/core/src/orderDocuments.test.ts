import { describe, it, expect } from "vitest";
import { orderDocuments } from "./orderDocuments";

const kinds = (input: Parameters<typeof orderDocuments>[0]) =>
  orderDocuments(input).map((d) => d.kind);

describe("orderDocuments", () => {
  it("every order > lists the shipping label first, always available", () => {
    const docs = orderDocuments({ paymentStatus: "paid", hasSlipImage: false, claimPhotoCount: 0 });
    expect(docs[0]).toMatchObject({ kind: "shipping_label", available: true });
  });

  it("prepaid order > offers a payment-slip row", () => {
    expect(kinds({ paymentStatus: "paid", hasSlipImage: false, claimPhotoCount: 0 })).toContain(
      "payment_slip",
    );
  });

  it("prepaid, no slip stored yet > slip row is present but not available", () => {
    const slip = orderDocuments({
      paymentStatus: "paid",
      hasSlipImage: false,
      claimPhotoCount: 0,
    }).find((d) => d.kind === "payment_slip");
    expect(slip).toMatchObject({ available: false });
  });

  it("prepaid, slip stored > slip row is available", () => {
    const slip = orderDocuments({
      paymentStatus: "verifying",
      hasSlipImage: true,
      claimPhotoCount: 0,
    }).find((d) => d.kind === "payment_slip");
    expect(slip).toMatchObject({ available: true });
  });

  it("COD order > has no payment-slip row (COD never has a slip)", () => {
    for (const paymentStatus of ["cod", "cod_confirmed", "cod_collected"]) {
      expect(kinds({ paymentStatus, hasSlipImage: false, claimPhotoCount: 0 })).not.toContain(
        "payment_slip",
      );
    }
  });

  it("no claim photos > no claim-evidence row", () => {
    expect(kinds({ paymentStatus: "paid", hasSlipImage: true, claimPhotoCount: 0 })).not.toContain(
      "claim_evidence",
    );
  });

  it("claim photos present > claim-evidence row carries the count", () => {
    const claim = orderDocuments({
      paymentStatus: "paid",
      hasSlipImage: true,
      claimPhotoCount: 3,
    }).find((d) => d.kind === "claim_evidence");
    expect(claim).toMatchObject({ kind: "claim_evidence", available: true, count: 3 });
  });

  it("every row > carries a non-empty Thai label", () => {
    const docs = orderDocuments({ paymentStatus: "paid", hasSlipImage: true, claimPhotoCount: 2 });
    expect(docs).toHaveLength(3);
    for (const d of docs) expect(d.label.length).toBeGreaterThan(0);
  });
});
