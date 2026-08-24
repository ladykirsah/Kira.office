import { describe, it, expect } from "vitest";
import { isDeleteConfirmed } from "./deleteConfirm";

/**
 * The word that arms a destructive action.
 *
 * Deleting a product is a one-way door in this admin: it sets `status='archived'`, every list
 * filters archived rows out, and NO screen can bring it back — recovery means going into the
 * database by hand. So the gesture has to be deliberate.
 *
 * But deliberate is not the same as fussy. The original inline check was `typed === "DELETE"`,
 * exact and case-sensitive; the owner, asked to describe this feature, wrote the word in lower
 * case. Rejecting "delete" teaches nothing and reads as a broken button — the intent is
 * unmistakable either way. Case and surrounding whitespace are forgiven; the WORD is not.
 */
describe("isDeleteConfirmed", () => {
  it("given the exact word in capitals > confirms", () => {
    expect(isDeleteConfirmed("DELETE")).toBe(true);
  });

  it("given lower case > confirms, the intent is identical", () => {
    expect(isDeleteConfirmed("delete")).toBe(true);
  });

  it("given mixed case > confirms", () => {
    expect(isDeleteConfirmed("Delete")).toBe(true);
  });

  it("given stray whitespace around it > confirms, a trailing space is not a decision", () => {
    expect(isDeleteConfirmed("  delete  ")).toBe(true);
  });

  it("given a partial word > refuses", () => {
    expect(isDeleteConfirmed("del")).toBe(false);
    expect(isDeleteConfirmed("delet")).toBe(false);
  });

  it("given empty or blank > refuses, so an untouched box never arms the button", () => {
    expect(isDeleteConfirmed("")).toBe(false);
    expect(isDeleteConfirmed("   ")).toBe(false);
  });

  it("given the word buried in other text > refuses, that is not a deliberate gesture", () => {
    expect(isDeleteConfirmed("delete this")).toBe(false);
    expect(isDeleteConfirmed("do not delete")).toBe(false);
  });

  it("given the Thai word > refuses; the box asks for one specific word", () => {
    // Guards against a future well-meaning translation quietly widening what arms the button.
    expect(isDeleteConfirmed("ลบ")).toBe(false);
  });
});
