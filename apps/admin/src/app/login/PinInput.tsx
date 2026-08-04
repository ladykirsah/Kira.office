"use client";

import { useRef } from "react";
import { PIN_LENGTH, boxDigits, setBoxDigit, spreadPaste } from "@/lib/pinBoxes";

/**
 * Six boxes, split 3 + 3 — a PIN pad rather than a text field (owner, 2026-08-04).
 *
 * One input per digit, because that is what makes a counter tablet's keypad behave: each box takes
 * one character and hands focus on. The behaviours people notice only when they are missing:
 *   · typing fills forward; backspace on an empty box steps back and clears the one before
 *   · arrow keys move without changing anything
 *   · pasting all six fills the row at once, wherever the cursor happens to be
 *
 * Moving focus to Sign in once the row is full belongs to the FORM, not here: the button is still
 * disabled while this component is handling the sixth keystroke, and a disabled button cannot be
 * focused.
 *
 * The positional arithmetic lives in `lib/pinBoxes` so it can be tested — in particular that
 * clearing a middle box leaves a hole instead of shuffling the later digits left.
 */
export function PinInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = boxDigits(value);

  function commit(next: string, focusIndex: number) {
    onChange(next);
    boxes.current[Math.min(Math.max(focusIndex, 0), PIN_LENGTH - 1)]?.focus();
  }

  function handleChange(index: number, raw: string) {
    const typed = raw.replace(/\D/g, "");
    if (!typed) return;
    // A whole PIN pasted, or a one-time code autofilled, arrives in a single box — spread it.
    if (typed.length > 1) {
      const filled = spreadPaste(typed);
      commit(filled, filled.length - 1);
      return;
    }
    commit(setBoxDigit(value, index, typed), index + 1);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        commit(setBoxDigit(value, index, ""), index);
      } else if (index > 0) {
        // Empty box: step back and clear that one, so a held backspace walks the row.
        commit(setBoxDigit(value, index - 1, ""), index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      boxes.current[index - 1]?.focus();
    }
    if (e.key === "ArrowRight" && index < PIN_LENGTH - 1) {
      e.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  }

  return (
    <div className="pin-boxes" role="group" aria-label="6-digit PIN">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          className="pin-box"
          value={digit}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          // No maxLength: it would silently truncate a pasted PIN before onChange ever sees it.
          aria-label={`PIN digit ${i + 1} of ${PIN_LENGTH}`}
          autoFocus={i === 0}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
