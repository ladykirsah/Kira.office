/**
 * The owner's work history (staff_activity) — one writer for every module that adds a line.
 *
 * Its own module so both staffRoutes (profile edits, pay, PINs…) and staffSession (a sign-in that
 * trips the lock) can write through it without importing each other.
 */

/** A line in the owner's activity log. Best-effort: never fail a real action because logging did. */
export async function logActivity(
  db: D1Database,
  userId: string,
  kind: string,
  detail: string | null,
  now: number,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO staff_activity (id, user_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, kind, detail, now)
      .run();
  } catch (err) {
    console.error("staff_activity write failed:", err);
  }
}
