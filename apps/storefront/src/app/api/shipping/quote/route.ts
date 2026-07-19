import {
  FLASH_TH_RATE_CARD,
  FLASH_TH_REMOTE_POSTCODES,
  isRemotePostcode,
  quoteShippingSatang,
} from "@l-shopee/core";
import { getCheckoutPricing, getDb } from "@/lib/db";

/**
 * POST /api/shipping/quote — a shipping-fee ESTIMATE for the checkout summary.
 * Body: { lines: [{ variantId, qty }], postcode }. Returns { shippingSatang, isRemote }.
 *
 * Display-only: /api/checkout recomputes the authoritative fee at order time from
 * the same core calculator, so a tampered estimate can never change what's charged.
 * Weight/dims come from the shared checkout pricing fetch (active products only).
 */

interface QuoteLine {
  variantId: string;
  qty: number;
}

function parseLines(input: unknown): QuoteLine[] | null {
  if (!Array.isArray(input)) return null;
  const out: QuoteLine[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) return null;
    const { variantId, qty } = raw as Record<string, unknown>;
    if (typeof variantId !== "string" || !variantId) return null;
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return null;
    out.push({ variantId, qty: Math.floor(qty) });
  }
  return out;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => null)) as {
      lines?: unknown;
      postcode?: unknown;
    } | null;
    const lines = parseLines(body?.lines);
    if (!lines) return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    const postcode = typeof body?.postcode === "string" ? body.postcode.trim() : "";

    // Empty (or all-unavailable) cart → nothing to ship.
    if (lines.length === 0) return Response.json({ shippingSatang: 0, isRemote: false });

    const db = await getDb();
    const pricing = await getCheckoutPricing(
      db,
      lines.map((l) => l.variantId),
      Date.now(),
    );
    const items = lines
      .map((l) => {
        const row = pricing.get(l.variantId);
        if (!row) return null;
        return {
          weightGrams: row.weightGrams,
          dims: { widthMm: row.widthMm, lengthMm: row.lengthMm, heightMm: row.heightMm },
          qty: l.qty,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (items.length === 0) return Response.json({ shippingSatang: 0, isRemote: false });

    const isRemote = isRemotePostcode(postcode, FLASH_TH_REMOTE_POSTCODES);
    const shippingSatang = quoteShippingSatang(items, isRemote, FLASH_TH_RATE_CARD);
    return Response.json({ shippingSatang, isRemote });
  } catch (err) {
    console.error("POST /api/shipping/quote failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}
