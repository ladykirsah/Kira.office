import { canPerform, type AppAction, type AppRole } from "@l-shopee/core";

export type { AppAction, AppRole };

/** Resolved caller after Access JWT verification + optional users-table lookup. */
export interface ActorContext {
  email: string | null;
  userId: string | null;
  role: AppRole | null;
  /** False when Access secrets are unset (API stays open, same as today). */
  rbacEnforced: boolean;
}

export async function resolveActor(
  db: D1Database,
  accessEmail: string | null,
  accessConfigured: boolean,
): Promise<ActorContext> {
  if (!accessConfigured || !accessEmail) {
    return { email: accessEmail, userId: null, role: null, rbacEnforced: false };
  }
  const row = await db
    .prepare(`SELECT id, role FROM users WHERE email = ? AND status = 'active'`)
    .bind(accessEmail)
    .first<{ id: string; role: AppRole }>();
  if (!row) {
    return { email: accessEmail, userId: null, role: null, rbacEnforced: true };
  }
  return { email: accessEmail, userId: row.id, role: row.role, rbacEnforced: true };
}

/** Returns a 403 JSON Response when the actor lacks permission; null when allowed or RBAC is off. */
export function requireRole(
  actor: ActorContext,
  action: AppAction,
): { error: string; reason: string } | null {
  if (!actor.rbacEnforced) return null;
  if (!actor.role) return { error: "forbidden", reason: "unknown_user" };
  if (!canPerform(actor.role, action)) return { error: "forbidden", reason: "insufficient_role" };
  return null;
}
