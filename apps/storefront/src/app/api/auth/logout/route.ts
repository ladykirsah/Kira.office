import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/authCore";
import { guardMutation, revokeSessionByToken } from "@/lib/auth";
import { getDb } from "@/lib/db";

/** POST-only (a GET logout link would be CSRF-able AND fired by <Link> prefetch). */
export async function POST(req: Request): Promise<Response> {
  try {
    const guarded = guardMutation(req);
    if (guarded) return guarded;
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token && /^[0-9a-f]{64}$/.test(token)) {
      await revokeSessionByToken(await getDb(), token);
    }
    jar.delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/logout failed", err);
    return Response.json({ error: "เกิดข้อผิดพลาดในระบบ" }, { status: 500 });
  }
}
