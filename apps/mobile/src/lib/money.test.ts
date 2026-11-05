import { describe, expect, it } from "vitest";
import { formatBaht } from "./money";

describe("formatBaht", () => {
  it("given whole baht > then it groups thousands and drops .00", () => {
    expect(formatBaht(345000)).toBe("฿3,450");
    expect(formatBaht(0)).toBe("฿0");
  });

  it("given satang > then it shows both satang digits", () => {
    expect(formatBaht(281410)).toBe("฿2,814.10");
    expect(formatBaht(129050)).toBe("฿1,290.50");
    expect(formatBaht(5)).toBe("฿0.05");
  });
});
