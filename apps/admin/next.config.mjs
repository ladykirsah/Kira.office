/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deployed to Cloudflare Workers via the OpenNext adapter (see open-next.config.ts).
  reactStrictMode: true,
  // Verification builds set NEXT_DIST_DIR=.next-verify so they don't clobber the running
  // `next dev` output in .next. The real deploy build (OpenNext) uses the default .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
