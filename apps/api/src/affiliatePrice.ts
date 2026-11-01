// The price for a สินค้านายหน้า card, read from its link (owner, 1 Nov 2026: "if it's available on the
// link make the link work > show lowest price", then picked A — Lazada only). Tested that day:
// - Lazada's product page carries the price it shows in its page data: "pdt_price":"฿1,965.00".
//   That is the price of the option Lazada shows first; the other options' prices load later in
//   the browser and are not on the page.
// - Shopee sends an empty page and its item API refuses (error 90309999), so a Shopee link is never
//   fetched — its price stays typed by hand.
// Whatever goes wrong (Lazada blocks us, changes its page, the network drops), the answer is "no
// price" and the person types it; this never fails the form.

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const MAX_HOPS = 5;
const TIMEOUT_MS = 8000;
/** A Lazada product page is ~250 KB; read no further than this. */
const MAX_BYTES = 2_000_000;
const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  "accept-language": "th-TH,th;q=0.9",
};

/**
 * Only Lazada Thailand, only https. The server follows nothing else: a link to any other host could
 * point it at a private address, so each redirect hop is checked against this too.
 */
export function isLazadaLink(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return url.hostname === "lazada.co.th" || url.hostname.endsWith(".lazada.co.th");
}

/** "฿1,965.00" → "฿1,965" (the shop's way: comma, no .00); null when the page has no price. */
export function lazadaPriceFromHtml(html: string): string | null {
  const m = /"pdt_price"\s*:\s*"฿?\s*([\d,]+(?:\.\d+)?)"/.exec(html);
  if (!m) return null;
  const baht = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(baht) || baht <= 0) return null;
  const whole = Number.isInteger(baht);
  return `฿${baht.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text;
}

/** The price on a Lazada link, following its redirects (short links) hop by hop; null otherwise. */
export async function priceFromLink(fetchFn: FetchFn, raw: string): Promise<string | null> {
  if (!isLazadaLink(raw)) return null;
  let url = new URL(raw.trim()).toString();
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const res = await fetchFn(url, {
        headers: HEADERS,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status >= 300 && res.status < 400) {
        const to = res.headers.get("location");
        if (!to) return null;
        const next = new URL(to, url).toString();
        if (!isLazadaLink(next)) return null;
        url = next;
        continue;
      }
      if (!res.ok) return null;
      return lazadaPriceFromHtml(await readCapped(res));
    }
    return null;
  } catch (err) {
    console.warn("affiliate price: could not read the link", { url, err: String(err) });
    return null;
  }
}
