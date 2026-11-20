// Parts set B's colour names (gluestack-ui), each set to TeamPit's own colour from src/ui/theme.ts
// LIGHT (Palette A Racing Red), not the set's grey-black. src/ui/styleHelper.test.ts keeps them equal.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#D7191F",
        "primary-foreground": "#FFFFFF",
        background: "#F2F2F7",
        foreground: "#000000",
        card: "#FFFFFF",
        border: "#E5E5EA",
        input: "#E9E9EE",
        secondary: "#E9E9EE",
        "secondary-foreground": "#000000",
        muted: "#E9E9EE",
        "muted-foreground": "#8A8A8E",
        destructive: "#B3121A",
      },
    },
  },
};
