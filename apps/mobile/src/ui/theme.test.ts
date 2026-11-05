import { describe, expect, it } from "vitest";
import { DARK, LIGHT, forScreen } from "./theme";

describe("forScreen (computer guide C · Mercury, 4 Nov 2026)", () => {
  it("given a phone > then the colours are the phone guide's, cards with no line", () => {
    const theme = forScreen(LIGHT, false);

    expect(theme).toEqual(LIGHT);
    expect(theme.cardLine).toBe(0);
  });

  it("given a computer > then the page is white and every white card gets a thin grey line", () => {
    const theme = forScreen(LIGHT, true);

    expect(theme.deskPage).toBe("#FFFFFF");
    expect(theme.cardLine).toBe(1);
    expect(theme.surface).toBe(LIGHT.surface);
  });

  it("given a computer in dark mode > then the page is black and the cards still get their line", () => {
    const theme = forScreen(DARK, true);

    expect(theme.deskPage).toBe("#000000");
    expect(theme.cardLine).toBe(1);
  });
});
