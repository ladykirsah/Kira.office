const FALLBACK = "/account";
/** A made-up origin to read the path against; anything that leaves it is another site. */
const HERE = "https://same-site.invalid";

/**
 * Where a sign-in sends the customer back to: a path on this site, or the account page.
 *
 * Read the way a browser reads it, not by its first characters. "/\evil.example" and
 * "/<tab>/evil.example" both start with a single "/", yet a browser turns them into
 * "//evil.example" — another site (bug hunt 15 Nov 2026: an open redirect after LINE sign-in).
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return FALLBACK;
  let url: URL;
  try {
    url = new URL(raw, HERE);
  } catch {
    return FALLBACK;
  }
  if (url.origin !== HERE) return FALLBACK;
  // Check what we hand back too: "/.//evil.example" is a path here, but once its "." is cleaned up
  // it reads "//evil.example", which a browser takes as another site.
  const out = url.pathname + url.search + url.hash;
  return out.startsWith("//") ? FALLBACK : out;
}
