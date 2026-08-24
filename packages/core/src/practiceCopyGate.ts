/**
 * The gate on the practice copy's one-click sign-in.
 *
 * WHAT IT UNLOCKS, AND WHY IT IS THIS PARANOID. Behind this gate sits a route that hands out a
 * super-admin session with no credential at all. On a throwaway database running on the owner's own
 * laptop that is correct: there is nothing there to protect, and a password only locks the owner out
 * of their own practice (which it did, twice on 2026-08-24). Anywhere else it would be a
 * catastrophe. So this has to be provably impossible to satisfy in production.
 *
 * TWO conditions, BOTH required:
 *
 *   1. `PRACTICE_COPY === "1"`. Production does not leave this UNSET — it ships it explicitly as
 *      `"0"` in `wrangler.jsonc`'s deployed `vars`, and `configDeniesPracticeCopy` is asserted by a
 *      test over that file. An absent variable and a deployed variable are very different promises:
 *      the first is "nobody happened to set it", the second is "this deployment says no". Local dev
 *      overrides it to "1" from `.dev.vars`, which is gitignored and never deployed.
 *   2. Cloudflare Access not configured. A deployment behind Access is by definition the real one.
 *
 * THERE IS NO HOSTNAME CONDITION, and that is deliberate rather than an oversight. `wrangler dev`
 * rewrites BOTH `request.url` and the `Host` header to the first hostname in the Worker's `routes`
 * — locally this Worker sees `api.homeseeker.me`, a genuine production hostname. So inside the
 * Worker there is no signal that distinguishes local from deployed, and any allowlist that made the
 * local case work would have to admit a real production host. A guard that cannot be made correct
 * is worse than no guard, because it is trusted without being load-bearing. Verified empirically,
 * 2026-08-24; do not re-add one without re-checking that claim.
 *
 * NOTE THE SHAPE, because the codebase has been bitten twice by the opposite one. `requireAccess`
 * reads "ACCESS_* is unset" as permission to proceed, and `viewerRole` once read an unconfigured
 * environment as super_admin; both fail OPEN when configuration goes missing. Nothing here opens
 * because something is absent — condition 2 can only ever refuse, and the only thing that grants is
 * a value somebody had to deliberately write down.
 */

export interface PracticeCopyEnv {
  /** Exactly "1" enables the passwordless sign-in. Production ships "0". */
  PRACTICE_COPY?: string;
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
}

export function isPracticeCopy(env: PracticeCopyEnv): boolean {
  // The opt-in. Exactly "1" — not "true", not "yes" — so a half-remembered value fails closed.
  if (env.PRACTICE_COPY !== "1") return false;
  // Anything behind Access is the real thing, whatever else is set.
  if (env.ACCESS_AUD || env.ACCESS_TEAM_DOMAIN) return false;
  return true;
}

/**
 * Does a deployed wrangler config explicitly REFUSE the practice door?
 *
 * Every deployable environment must set `vars.PRACTICE_COPY` to `"0"` — the top-level config and
 * every named env under `env`. Asserted by a test against the real `wrangler.jsonc`, in the same
 * spirit as the BACKUP_TABLES drift test: a new environment added without this line fails the
 * build rather than quietly shipping a deployment whose only protection is that nobody set a
 * variable.
 */
export function configDeniesPracticeCopy(config: {
  vars?: Record<string, unknown>;
  env?: Record<string, { vars?: Record<string, unknown> }>;
}): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (config.vars?.PRACTICE_COPY !== "0") missing.push("(top level)");
  for (const [name, e] of Object.entries(config.env ?? {})) {
    if (e?.vars?.PRACTICE_COPY !== "0") missing.push(name);
  }
  return { ok: missing.length === 0, missing };
}
