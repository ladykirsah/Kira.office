import { describe, it, expect } from "vitest";
import { errorFor, type LoginError } from "./loginError";

const KEY_FAILED: LoginError = { door: "key", text: "That key does not open this." };
const FORM_FAILED: LoginError = { door: "form", text: "Wrong PIN." };

describe("errorFor", () => {
  it("given nothing has failed > then neither door says anything", () => {
    expect(errorFor("form", null)).toBeNull();
    expect(errorFor("key", null)).toBeNull();
  });

  it("given the everyday form refused > then the form says so", () =>
    expect(errorFor("form", FORM_FAILED)).toBe("Wrong PIN."));

  it("given the emergency key refused > then the key section says so", () =>
    expect(errorFor("key", KEY_FAILED)).toBe("That key does not open this."));

  /**
   * THE BUG. A verdict on a key appeared in the everyday form, above the Sign in button and
   * described BY the password field — a complaint about a key, read while looking at a password.
   */
  it("given the emergency key refused > then the everyday form stays silent", () =>
    expect(errorFor("form", KEY_FAILED)).toBeNull());

  it("given the everyday form refused > then the key section stays silent", () =>
    expect(errorFor("key", FORM_FAILED)).toBeNull());
});
