import { NextResponse } from "next/server";
import { getDb, getProduct } from "@/lib/db";

/**
 * GET /api/products/:id/choices — a product's sizes, for the size sheet a card's 🛒 opens (board 3b,
 * 11 Nov 2026). Read-only and public (the same catalogue data the product page shows). 404 when the
 * product is gone or has nothing in stock, so the card can send the shopper to its page instead.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const detail = await getProduct(await getDb(), id);
    if (!detail) return NextResponse.json({ error: "ไม่พบสินค้า" }, { status: 404 });
    return NextResponse.json(
      {
        product: {
          productId: detail.productId,
          name: detail.name,
          productRef: detail.productRef,
          brandName: detail.brandName,
        },
        choices: detail.choices,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("[api/products/choices] failed", err);
    return NextResponse.json({ error: "โหลดไม่สำเร็จ กรุณาลองใหม่" }, { status: 500 });
  }
}
