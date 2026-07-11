import { getSession } from "@/lib/auth";

/** Read-only session probe for client components (checkout, header). */
export async function GET(): Promise<Response> {
  try {
    const customer = await getSession();
    return Response.json({ customer });
  } catch (err) {
    console.error("GET /api/auth/me failed", err);
    return Response.json({ customer: null });
  }
}
