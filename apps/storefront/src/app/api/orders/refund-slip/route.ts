import { getEnv } from "@/lib/db";
import { normalizePhone } from "@/lib/format";

/**
 * POST /api/orders/refund-slip — serve OUR outgoing refund transfer slip back to the customer as
 * evidence. Auth = the (order ref, phone) pair, same rule as /api/orders/lookup. POST, not GET, so
 * the phone never lands in a URL/query string. Returns the image bytes, or 404 for anything the pair
 * does not own (identical to a missing order — never reveals someone else's).
 */
const NOT_FOUND = new Response("Not found", { status: 404 });

export async function POST(req: Request): Promise<Response> {
  try {
    let b: Record<string, unknown>;
    try {
      b = (await req.json()) as Record<string, unknown>;
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const ref = typeof b.ref === "string" ? b.ref.trim().toUpperCase() : "";
    const phone = normalizePhone(typeof b.phone === "string" ? b.phone : "");
    if (!ref || !phone) return NOT_FOUND;

    const env = await getEnv();
    const order = await env.DB.prepare(
      `SELECT o.refund_slip_image_key AS slipKey, c.phone AS phone
       FROM sales_orders o
       JOIN storefront_customers c ON c.id = o.storefront_customer_id
       WHERE o.channel = 'airplus' AND o.external_order_id = ?`,
    )
      .bind(ref)
      .first<{ slipKey: string | null; phone: string }>();
    if (!order || normalizePhone(order.phone) !== phone || !order.slipKey) return NOT_FOUND;

    const obj = env.IMAGES ? await env.IMAGES.get(order.slipKey) : null;
    if (!obj) return NOT_FOUND;
    // arrayBuffer(), not obj.body: R2's ReadableStream and the DOM Response's BodyInit disagree under
    // the storefront's mixed workers-types + DOM lib, and a buffered read sidesteps the type clash.
    return new Response(await obj.arrayBuffer(), {
      headers: {
        "content-type": obj.httpMetadata?.contentType ?? "image/jpeg",
        // Private: the customer's own evidence, never a shared cache.
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
