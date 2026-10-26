import { describe, expect, it } from "vitest";
import { formatBaht } from "./money";

describe("formatBaht", () => {
  it("given whole baht > then it groups thousands and drops .00", () => {
    expect(formatBaht(345000)).toBe("฿3,450");
    expect(formatBaht(0)).toBe("฿0");
  });

  it("given satang > then it keeps them without trailing zeros", () => {
    expect(formatBaht(129050)).toBe("฿1,290.5");
    expect(formatBaht(5)).toBe("฿0.05");
  });
});
