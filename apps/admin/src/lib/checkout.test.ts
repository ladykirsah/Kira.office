import { describe, it, expect } from "vitest";
import { buildCheckoutCustomerUpsert, finalizeParkedDraft, quoteNumberForExport } from "./checkout";
import type { OpenDraft } from "./api";

describe("quoteNumberForExport", () => {
  const now = Date.UTC(2026, 6, 29, 3, 0, 0); // 29 Jul 2026, local Bangkok morning

  it("given the bill has no quotation number yet > issues the next one", () => {
    expect(quoteNumberForExport(null, "QT202607-29004", now)).toBe("QT202607-29005");
  });

  it("given the bill was already exported > reuses its number, burning none", () => {
    // Saving PDF then PNG then PDF again must stay one entry, not three.
    expect(quoteNumberForExport("QT202607-29005", "QT202607-29009", now)).toBe("QT202607-29005");
  });

  it("given no quotation has ever been issued > starts the day's series", () => {
    expect(quoteNumberForExport(null, null, now)).toBe("QT202607-29001");
  });
});

describe("buildCheckoutCustomerUpsert", () => {
  it("builds a plate+province upsert, trimming both", () => {
    expect(buildCheckoutCustomerUpsert({ plate: " 6ฉฉ2345 ", province: " สุรินทร์ " })).toEqual({
      licensePlate: "6ฉฉ2345",
      plateProvince: "สุรินทร์",
    });
  });

  it("returns null when there is no plate to key on", () => {
    expect(buildCheckoutCustomerUpsert({ plate: "   ", province: "สุรินทร์" })).toBeNull();
  });

  it("returns null when the plate is all there is (nothing to enrich)", () => {
    expect(buildCheckoutCustomerUpsert({ plate: "6ฉฉ2345", province: "  " })).toBeNull();
  });

  it("saves the new customer's name and numbers, even with no province", () => {
    expect(
      buildCheckoutCustomerUpsert({
        plate: "6ฉฉ2345",
        province: "",
        customerName: " สมชาย ",
        phones: [" 081-234-5678 ", "", "02-111-2222"],
      }),
    ).toEqual({
      licensePlate: "6ฉฉ2345",
      customerName: "สมชาย",
      phone: "081-234-5678, 02-111-2222",
    });
  });

  it("saves the car onto the plate, so it prefills next visit", () => {
    expect(
      buildCheckoutCustomerUpsert({
        plate: "6ฉฉ2345",
        province: "",
        carModel: " Toyota Vigo 2012 ",
      }),
    ).toEqual({ licensePlate: "6ฉฉ2345", carModel: "Toyota Vigo 2012" });
  });

  it("leaves out the fields that were not filled in", () => {
    const out = buildCheckoutCustomerUpsert({
      plate: "6ฉฉ2345",
      province: "สุรินทร์",
      customerName: "  ",
      phones: ["  "],
    });
    expect(out).toEqual({ licensePlate: "6ฉฉ2345", plateProvince: "สุรินทร์" });
  });
});

/** Minimal OpenDraft fixture — only `id` matters to finalizeParkedDraft; the rest keeps the type honest. */
function draft(id: string): OpenDraft {
  return {
    id,
    saleNumber: null,
    saleType: "parts",
    licensePlate: null,
    vehicle: null,
    notes: null,
    stage: "draft",
    grandTotalSatang: 0,
    discountTotalSatang: 0,
    discountKind: null,
    discountValue: null,
    createdAt: 0,
    lines: [],
  };
}

/** In-memory stand-in for the POS page's draft state + server calls, so the transition is testable in node. */
function draftPanel(drafts: OpenDraft[], activeDraftId: string | null) {
  let currentDrafts = drafts;
  let currentActive = activeDraftId;
  const deleted: string[] = [];
  return {
    get drafts() {
      return currentDrafts;
    },
    get activeDraftId() {
      return currentActive;
    },
    deleted,
    opts: {
      activeDraftId,
      deleteDraft: async (id: string) => {
        deleted.push(id);
      },
      setDrafts: (updater: (d: OpenDraft[]) => OpenDraft[]) => {
        currentDrafts = updater(currentDrafts);
      },
      setActiveDraftId: (id: string | null) => {
        currentActive = id;
      },
    },
  };
}

describe("finalizeParkedDraft", () => {
  it("given a finalized parked draft > removes only that draft from the open list", async () => {
    const panel = draftPanel([draft("d1"), draft("d2"), draft("d3")], "d2");
    await finalizeParkedDraft(panel.opts);
    expect(panel.drafts.map((d) => d.id)).toEqual(["d1", "d3"]);
  });

  it("given a finalized parked draft > clears the active selection and deletes it server-side", async () => {
    const panel = draftPanel([draft("d1"), draft("d2")], "d1");
    await finalizeParkedDraft(panel.opts);
    expect(panel.activeDraftId).toBeNull();
    expect(panel.deleted).toEqual(["d1"]);
  });

  it("given the server delete fails > still drops the local copy so it can't be reopened", async () => {
    const panel = draftPanel([draft("d1"), draft("d2")], "d1");
    // The sale already succeeded — a server-side delete hiccup must not throw out of checkout, and
    // must not leave a reopenable ghost that could be checked out a second time.
    panel.opts.deleteDraft = async () => {
      throw new Error("network down");
    };
    await expect(finalizeParkedDraft(panel.opts)).resolves.toBeUndefined();
    expect(panel.drafts.map((d) => d.id)).toEqual(["d2"]);
    expect(panel.activeDraftId).toBeNull();
  });

  it("given no active draft (walk-in) > leaves the list and never calls deleteDraft", async () => {
    const panel = draftPanel([draft("d1"), draft("d2")], null);
    await finalizeParkedDraft(panel.opts);
    expect(panel.drafts.map((d) => d.id)).toEqual(["d1", "d2"]);
    expect(panel.deleted).toEqual([]);
  });
});
