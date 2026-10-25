import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// Flat config bridging Next's shareable config (still eslintrc-format) into ESLint 9.
//
// Added 2026-07-22. Until then the repo had NO eslint at all — `npm run lint` was prettier only —
// despite eslint-disable comments in the source implying otherwise. Nothing enforced React or
// hooks rules, so a regression could only be caught by a human reading the diff.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", ".next-verify/**", ".open-next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Prettier owns formatting; eslint here is strictly about correctness.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // OFF BY DESIGN, not by neglect. Every image here is an owner-uploaded R2 object served by
      // the api Worker's /img/ route. next/image's optimizer is not deployed on Cloudflare Workers,
      // so <Image /> would either proxy through an optimizer that does not exist or need a custom
      // loader that adds nothing over a plain <img>. The codebase already carried per-line disables
      // for this; one policy with a reason beats ten scattered ignores.
      "@next/next/no-img-element": "off",

      // Kept as WARN rather than promoted to error: the existing effects are deliberate
      // mount-once fetches, and mechanically adding the missing dep can turn one into an infinite
      // re-fetch loop. Each needs a human decision, so they stay visible without blocking CI.
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default config;
