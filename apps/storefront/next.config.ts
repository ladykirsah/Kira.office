import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { securityHeaderRules } from "./src/lib/securityHeaders";

// TypeScript rather than .mjs (Next 15 loads either) purely so the security header policy can be
// imported from one tested module instead of being retyped here where nothing checks it.
const nextConfig: NextConfig = {
  // Deployed to Cloudflare Workers via the OpenNext adapter (see open-next.config.ts).
  reactStrictMode: true,
  // The only lockfile lives at the REPO ROOT, but `next build` runs from apps/*, so Next infers a
  // workspace root of its own and warns. Point it at the actual root — otherwise file tracing can
  // also miss workspace packages (@l-shopee/core) that the bundle genuinely needs.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // Verification builds set NEXT_DIST_DIR=.next-verify so they don't clobber the running
  // `next dev` output in .next. The real deploy build (OpenNext) uses the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // NOTE: these apply to responses Next renders. Files served straight off the Workers ASSETS
  // binding (/_next/static/*) bypass this — those are immutable hashed assets, but if a full CSP
  // is added later it will need the assets path covered too, e.g. via a public/_headers file.
  headers: securityHeaderRules,
};

// Make the Cloudflare bindings (D1/KV) available inside `next dev` via getCloudflareContext.
// persist.path points at the REPO-ROOT wrangler state so local dev shares the same local D1
// (with all migrations + seed data) that `wrangler d1 migrations apply --local` at the root uses.
initOpenNextCloudflareForDev({ persist: { path: "../../.wrangler/state/v3" } });

export default nextConfig;
