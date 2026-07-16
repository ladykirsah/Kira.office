// Pure input logic for the 6-box OTP entry (components/OtpLogin.tsx). Kept framework-free and
// tested so the fiddly bits — type-to-advance, backspace-to-previous, and multi-char paste / iOS
// SMS one-time-code autofill dumped into a single box — behave correctly on the auth path. The React
// component owns only DOM focus and state; the "what happens on this keystroke" decisions live here.

export const OTP_LEN = 6;

/** A fresh set of 6 empty slots. */
export function emptyOtp(): string[] {
  return Array.from({ length: OTP_LEN }, () => "");
}

/**
 * Apply an input event on box `index` whose raw new value is `raw`. A single digit fills the box and
 * advances; multiple digits (paste or autofill) distribute from `index` onward; non-digits are
 * stripped, so a value that reduces to nothing clears the box. Focus lands on the next empty-ish box,
 * clamped to the last slot.
 */
export function spreadOtp(
  current: string[],
  index: number,
  raw: string,
): { digits: string[]; focus: number } {
  const only = raw.replace(/\D/g, "");
  const digits = current.slice(0, OTP_LEN);
  while (digits.length < OTP_LEN) digits.push("");

  if (only.length === 0) {
    digits[index] = "";
    return { digits, focus: index };
  }

  let last = index;
  for (let i = 0; i < only.length && index + i < OTP_LEN; i++) {
    digits[index + i] = only[i];
    last = index + i;
  }
  const focus =
    only.length === 1 ? Math.min(index + 1, OTP_LEN - 1) : Math.min(last + 1, OTP_LEN - 1);
  return { digits, focus };
}

/**
 * Backspace on box `index`: if it holds a digit, clear it in place; if it is already empty, clear the
 * previous box and move focus back. Never moves before box 0.
 */
export function backspaceOtp(
  current: string[],
  index: number,
): { digits: string[]; focus: number } {
  const digits = current.slice(0, OTP_LEN);
  while (digits.length < OTP_LEN) digits.push("");

  if (digits[index]) {
    digits[index] = "";
    return { digits, focus: index };
  }
  const prev = Math.max(index - 1, 0);
  digits[prev] = "";
  return { digits, focus: prev };
}

/** Join slots into the code string; an incomplete set can never match /^\d{6}$/. */
export function otpCode(digits: string[]): string {
  return digits.join("");
}
