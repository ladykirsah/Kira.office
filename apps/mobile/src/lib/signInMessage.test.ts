import { describe, expect, it } from "vitest";
import { signInMessage } from "./signInMessage";

/**
 * The same words the web back office's sign-in card uses (apps/admin/src/app/login/LoginForm.tsx),
 * so staff moving between the two never meet a second vocabulary for the same refusal.
 */
describe("signInMessage", () => {
  it("given a plain refusal > names what was wrong for the way they tried", () => {
    expect(signInMessage("pin", "invalid").en).toBe("That PIN doesn't match anyone.");
    expect(signInMessage("password", "invalid").en).toBe("Email or password is wrong.");
    expect(signInMessage("key", "invalid").en).toBe("That key does not open this.");
    expect(signInMessage("pin", "invalid").th).toBe("ไม่มีใครใช้รหัสนี้");
  });

  it("given a refusal that is not about the credential > never says it was wrong", () => {
    expect(signInMessage("pin", "unreachable").en).toBe(
      "Can't reach the server. Check the connection and try again.",
    );
    expect(signInMessage("password", "locked").en).toBe(
      "This account is locked for 24 hours after 3 failed tries.",
    );
    expect(signInMessage("password", "needs_reset").th).toMatch(/^บัญชีนี้ต้องตั้งรหัสใหม่/);
    expect(signInMessage("pin", "pin_login_unavailable").en).toBe(
      "PIN sign-in isn't set up yet. Use email and password.",
    );
    expect(signInMessage("pin", "too_many_attempts").en).toBe(
      "Too many tries. Wait about 15 minutes, then try again.",
    );
    expect(signInMessage("practice", "not_available").en).toMatch(
      /not set up for one-click sign-in/,
    );
  });
});
