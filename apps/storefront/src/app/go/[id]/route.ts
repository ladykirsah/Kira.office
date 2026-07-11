import { getAffiliateTarget, getDb } from "@/lib/db";

// Affiliate outbound redirect (/go/:id → partner URL).
//
// This is deliberately the ONE state-changing GET in the storefront: the INSERT below is click
// ANALYTICS (correlating outbound clicks with recorded affiliate income), not user state — the
// link must stay a plain shareable <a href>, and an over-counted click (prefetch, retry) is
// harmless. Open-redirect safety: we 302 ONLY to the target_url STORED in D1 for this id; nothing
// from the request ever becomes a redirect destination.
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await props.params;
  const db = await getDb();
  const target = await getAffiliateTarget(db, id);
  if (!target) return Response.redirect(new URL("/tools", req.url), 302);
  try {
    await db
      .prepare(`INSERT INTO affiliate_clicks (id, item_id, created_at) VALUES (?, ?, ?)`)
      .bind(crypto.randomUUID(), target.id, Date.now())
      .run();
  } catch (err) {
    // Best-effort analytics — a failed click log must never block the customer's outbound hop.
    console.error("GET /go/:id click log failed", { id, err });
  }
  return Response.redirect(target.targetUrl, 302);
}
