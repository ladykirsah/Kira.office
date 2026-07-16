import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deployed to Cloudflare Workers via the OpenNext adapter (see open-next.config.ts).
  reactStrictMode: true,
  // Verification builds set NEXT_DIST_DIR=.next-verify so they don't clobber the running
  // `next dev` output in .next. The real deploy build (OpenNext) uses the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

// Make the Cloudflare bindings (D1/KV) available inside `next dev` via getCloudflareContext.
// persist.path points at the REPO-ROOT wrangler state so local dev shares the same local D1
// (with all migrations + seed data) that `wrangler d1 migrations apply --local` at the root uses.
initOpenNextCloudflareForDev({ persist: { path: "../../.wrangler/state/v3" } });

export default nextConfig;
