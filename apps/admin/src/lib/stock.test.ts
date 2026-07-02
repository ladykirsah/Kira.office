import { describe, it, expect } from "vitest";
import { stockStatus, movementLabel, LOW_STOCK_THRESHOLD } from "./stock";

describe("stockStatus", () => {
  it("given onHand of zero or less > flags out", () => {
    expect(stockStatus(0)).toBe("out");
    expect(stockStatus(-1)).toBe("out");
  });

  it("given onHand at or below the threshold > flags low", () => {
    expect(stockStatus(LOW_STOCK_THRESHOLD)).toBe("low");
    expect(stockStatus(1)).toBe("low");
  });

  it("given onHand above the threshold > flags ok", () => {
    expect(stockStatus(LOW_STOCK_THRESHOLD + 1)).toBe("ok");
    expect(stockStatus(50)).toBe("ok");
  });

  it("honors a custom threshold", () => {
    expect(stockStatus(5, 10)).toBe("low");
    expect(stockStatus(11, 10)).toBe("ok");
  });
});

describe("movementLabel", () => {
  it("maps both legacy 'refund' and schema 'refund_return' to the same label", () => {
    expect(movementLabel("refund_return")).toBe("Refund / return");
    expect(movementLabel("refund")).toBe("Refund / return");
  });

  it("labels the common movement types", () => {
    expect(movementLabel("onsite_sale")).toBe("On-site sale");
    expect(movementLabel("online_sale")).toBe("Online sale");
    expect(movementLabel("manual_adjustment")).toBe("Manual adjustment");
    expect(movementLabel("receive")).toBe("Received");
    expect(movementLabel("write_off")).toBe("Write-off");
  });

  it("falls back to the raw type for unknown values", () => {
    expect(movementLabel("something_new")).toBe("something_new");
  });
});
