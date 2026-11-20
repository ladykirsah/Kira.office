import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIGHT } from "./theme";

// Owner, 20 Nov 2026 (plan 11.1): parts set B, gluestack-ui, restyled to the rulebook. Its parts are
// styled through NativeWind (11.3 puts it in; pages start using the parts in 11.4). Its colour names
// are gluestack's own; their values are TeamPit's Racing Red palette, not the set's grey-black.

const APP = join(__dirname, "../..");
const require = createRequire(import.meta.url);
const read = (file: string) => readFileSync(join(APP, file), "utf8");

describe("style helper for parts set B", () => {
  it("its colours > given set B's colour names > then each is TeamPit's own colour", () => {
    const config = require(join(APP, "tailwind.config.js")) as {
      theme: { extend: { colors: object } };
    };
    expect(config.theme.extend.colors).toEqual({
      primary: LIGHT.primary,
      "primary-foreground": LIGHT.onPrimary,
      background: LIGHT.bg,
      foreground: LIGHT.text,
      card: LIGHT.surface,
      border: LIGHT.border,
      input: LIGHT.hover,
      secondary: LIGHT.hover,
      "secondary-foreground": LIGHT.text,
      muted: LIGHT.hover,
      "muted-foreground": LIGHT.textMuted,
      destructive: LIGHT.danger,
    });
  });

  it("its page sheet > given every page is already drawn > then it adds no reset that restyles them", () => {
    const css = read("global.css");
    expect(css).toMatch(/@tailwind\s+utilities/);
    expect(css).not.toMatch(/@tailwind\s+base/);
  });

  it("the app > given a part styled by class names > then the app loads the helper's sheet", () => {
    expect(read("src/app/_layout.tsx")).toMatch(/^import "\.\.\/\.\.\/global\.css";/m);
  });
});
