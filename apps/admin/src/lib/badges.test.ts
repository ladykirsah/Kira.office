import { describe, it, expect } from "vitest";
import {
  saleStatusPill,
  paymentPill,
  orderStatusPill,
  vehicleLabel,
  stripCarYear,
  carYearOf,
  saleTypeBadge,
} from "./badges";

describe("saleStatusPill", () => {
  it("given completed > then good", () => expect(saleStatusPill("completed")).toBe("good"));
  it("given refunded > then off", () => expect(saleStatusPill("refunded")).toBe("off"));
  it("given anything else > then warn", () => expect(saleStatusPill("pending")).toBe("warn"));
});

describe("paymentPill", () => {
  it("given paid > then good", () => expect(paymentPill("paid")).toBe("good"));
  it("given unpaid > then bad", () => expect(paymentPill("unpaid")).toBe("bad"));
  it("given pending > then warn", () => expect(paymentPill("pending")).toBe("warn"));
  it("given null > then off", () => expect(paymentPill(null)).toBe("off"));
});

describe("orderStatusPill", () => {
  it("given completed > then good", () => expect(orderStatusPill("completed")).toBe("good"));
  it("given shipped > then good", () => expect(orderStatusPill("shipped")).toBe("good"));
  it("given to_ship > then warn", () => expect(orderStatusPill("to_ship")).toBe("warn"));
  it("given cancelled > then bad", () => expect(orderStatusPill("cancelled")).toBe("bad"));
  it("given null > then off", () => expect(orderStatusPill(null)).toBe("off"));
});

describe("vehicleLabel", () => {
  it("given vehicle and plate > then joined with a dot", () =>
    expect(vehicleLabel("Toyota Vios 2014", "1กก 1234")).toBe("Toyota Vios 2014 · 1กก 1234"));
  it("given plate only > then plate", () =>
    expect(vehicleLabel(null, "1กก 1234")).toBe("1กก 1234"));
  it("given vehicle only > then vehicle", () =>
    expect(vehicleLabel("Honda City", "")).toBe("Honda City"));
  it("given neither > then empty string", () => expect(vehicleLabel(null, null)).toBe(""));
});

describe("stripCarYear", () => {
  it("given a model ending in a year > drops the year", () =>
    expect(stripCarYear("Toyota Vios 2014")).toBe("Toyota Vios"));
  it("given a model with no year > returns it unchanged", () =>
    expect(stripCarYear("Toyota Vios")).toBe("Toyota Vios"));
  it("given a model whose name contains a number > drops only the trailing year", () =>
    expect(stripCarYear("Mazda 2 2019")).toBe("Mazda 2"));
  it("given empty/nullish > then empty string", () => {
    expect(stripCarYear("")).toBe("");
    expect(stripCarYear(null)).toBe("");
    expect(stripCarYear(undefined)).toBe("");
  });
});

describe("carYearOf", () => {
  it("given a model ending in a year > returns just the year", () =>
    expect(carYearOf("Toyota Vios 2014")).toBe("2014"));
  it("given a model whose name contains a number > returns only the trailing year", () =>
    expect(carYearOf("Mazda 2 2019")).toBe("2019"));
  it("given no trailing year > returns empty string", () => {
    expect(carYearOf("Toyota Vios")).toBe("");
    expect(carYearOf("")).toBe("");
    expect(carYearOf(null)).toBe("");
  });
});

describe("saleTypeBadge", () => {
  it("given repair > then soft pill with Service label", () =>
    expect(saleTypeBadge("repair")).toEqual({ pill: "soft", label: "🔧 Service" }));
  it("given parts > then off pill with Products label", () =>
    expect(saleTypeBadge("parts")).toEqual({ pill: "off", label: "📦 Products" }));
  it("given null > then null", () => expect(saleTypeBadge(null)).toBeNull());
});
