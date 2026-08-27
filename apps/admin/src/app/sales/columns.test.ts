import { describe, it, expect } from "vitest";
import { COLUMN, EXPENSE_COLUMNS } from "./columns";

describe("the Finance tables' shared column words", () => {
  it("gives every column both halves, so a card is never blank in one language", () => {
    for (const [key, phrase] of Object.entries(COLUMN)) {
      expect(phrase.th, `${key} has no Thai`).toBeTruthy();
      expect(phrase.en, `${key} has no English`).toBeTruthy();
    }
  });

  /**
   * The bug this pins: an expense row rendered its cells with no `data-label`, so on a phone it was
   * a column of bare numbers under no words at all while the sale rows above it read fine. Every
   * column an expense row fills has to have a word here for it to borrow.
   */
  it("has a word for every column an expense row fills", () => {
    for (const key of EXPENSE_COLUMNS) expect(COLUMN[key]).toBeDefined();
  });

  it("does not claim an expense has a Sales figure it could be confused with", () => {
    // It fills the Sales column with an em dash — the column is there, the figure is not.
    expect(EXPENSE_COLUMNS).toContain("sales");
    expect(EXPENSE_COLUMNS).not.toContain("job");
    expect(EXPENSE_COLUMNS).not.toContain("orderId");
  });
});
