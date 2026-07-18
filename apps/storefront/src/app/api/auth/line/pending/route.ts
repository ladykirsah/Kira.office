import { cookies } from "next/headers";
import { getEnv } from "@/lib/db";
import { LINE_PENDING_COOKIE, peekLinePending } from "@/lib/lineAuth";

/**
 * GET /api/auth/line/pending — the display name from the in-flight LINE signup, so the
 * /register/line form can pre-fill the username. Reads (does not consume) the pending
 * record keyed by the httpOnly cookie /callback set. Returns { name: null } when there's
 * no pending signup.
 */
export async function GET(): Promise<Response> {
  const token = (await cookies()).get(LINE_PENDING_COOKIE)?.value;
  if (!token) return Response.json({ name: null });
  const env = await getEnv();
  const pending = await peekLinePending(env, token);
  return Response.json({ name: pending?.name ?? null });
}
