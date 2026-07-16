/**
 * Product images are served by the EXISTING public route on the api Worker
 * (GET api.homeseeker.me/img/products/…, key-namespace restricted) — the storefront has no R2
 * binding of its own. In local dev those keys usually 404 (local-only R2 state) — the UI must
 * always render a graceful placeholder frame, never a broken image.
 */
const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE ?? "https://api.homeseeker.me";

export function imgUrl(imageKey: string): string {
  // Storefront-bundled assets (leading slash, e.g. the demo banners in /public) are served by the
  // app itself — never routed through the api Worker's R2 /img/ endpoint. Owner-uploaded images
  // keep their bare R2 key ("banners/…", "products/…") and go to the api Worker as before.
  if (imageKey.startsWith("/")) return imageKey;
  return `${IMG_BASE}/img/${imageKey}`;
}
