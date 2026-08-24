"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { StaffRole } from "@l-shopee/core";

/**
 * Makes the signed-in person's role readable from client pages.
 *
 * Before this, the role reached only `AppShell` (for the menu) — so a client page had no way to
 * ask "may this person do X" without fetching `/staff/me` again on every screen.
 *
 * This is for SHOWING and HIDING only. Every rule it mirrors is enforced in the API, which is a
 * separate public hostname and cannot trust anything the browser says. A control hidden here is a
 * courtesy; the refusal that matters happens on the Worker.
 *
 * Null means "signed out, or not known yet" — callers must treat that as no permission, never as
 * permission withheld pending a load.
 */
const StaffRoleContext = createContext<StaffRole | null>(null);

export function StaffRoleProvider({
  role,
  children,
}: {
  role: StaffRole | null;
  children: ReactNode;
}) {
  return <StaffRoleContext.Provider value={role}>{children}</StaffRoleContext.Provider>;
}

/** The signed-in role, or null when nobody is signed in. */
export function useStaffRole(): StaffRole | null {
  return useContext(StaffRoleContext);
}
