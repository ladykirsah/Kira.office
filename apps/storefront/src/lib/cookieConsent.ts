/**
 * Cookie-consent state — PDPA / PDPC 2565 opt-in model (see docs/policies/cookie-policy.md §3).
 * Non-essential categories default OFF; the banner is Design B and its "ตั้งค่า" opens Design C
 * (per-category). Pure helpers here are unit-tested; the thin localStorage wrappers sit at the
 * bottom. Bump CONSENT_VERSION when the cookie set / policy changes materially — an older stored
 * consent is then treated as absent so the banner re-appears.
 */
export type CookieCategory = "analytics" | "marketing" | "thirdParty";

export const OPTIONAL_CATEGORIES: readonly CookieCategory[] = [
  "analytics",
  "marketing",
  "thirdParty",
];

export interface CookieConsent {
  /** Strictly-necessary cookies always run and can't be turned off. */
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  thirdParty: boolean;
  /** Epoch ms the choice was made — logged as PDPA evidence of consent. */
  at: number;
  /** Consent schema version; a stored consent from an older version is treated as absent. */
  version: number;
}

export const CONSENT_VERSION = 1;
const STORAGE_KEY = "airplus.cookieConsent.v1";
/** Fired after a consent is written — future trackers (GA, pixels) can listen and (de)activate. */
export const CONSENT_EVENT = "airplus:cookieConsent";
/** Footer "ตั้งค่าคุกกี้" dispatches this to re-open the banner in Design-C settings mode. */
export const OPEN_SETTINGS_EVENT = "airplus:cookieSettings";

export type CategorySelection = Record<CookieCategory, boolean>;

export function makeConsent(sel: CategorySelection, at: number): CookieConsent {
  return {
    necessary: true,
    analytics: sel.analytics,
    marketing: sel.marketing,
    thirdParty: sel.thirdParty,
    at,
    version: CONSENT_VERSION,
  };
}

export function acceptAll(at: number): CookieConsent {
  return makeConsent({ analytics: true, marketing: true, thirdParty: true }, at);
}

export function rejectAll(at: number): CookieConsent {
  return makeConsent({ analytics: false, marketing: false, thirdParty: false }, at);
}

/** The per-category toggle state to seed Design C from (all false when no prior consent). */
export function selectionOf(c: CookieConsent | null): CategorySelection {
  return {
    analytics: c?.analytics ?? false,
    marketing: c?.marketing ?? false,
    thirdParty: c?.thirdParty ?? false,
  };
}

export function isValidConsent(v: unknown): v is CookieConsent {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    c.necessary === true &&
    typeof c.analytics === "boolean" &&
    typeof c.marketing === "boolean" &&
    typeof c.thirdParty === "boolean" &&
    typeof c.at === "number" &&
    c.version === CONSENT_VERSION
  );
}

export function parseConsent(raw: string | null): CookieConsent | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return isValidConsent(v) ? v : null;
  } catch {
    return null;
  }
}

/** True when the banner must be shown — no valid, current-version consent has been recorded. */
export function needsConsent(c: CookieConsent | null): boolean {
  return c === null;
}

/** Whether an optional category may run. Necessary is always allowed; unknown consent = deny. */
export function hasConsent(c: CookieConsent | null, cat: CookieCategory): boolean {
  return c ? c[cat] === true : false;
}

// ── client-only storage (thin wrappers over the pure helpers above) ──────────────────────────────
export function readStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseConsent(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeConsent(c: CookieConsent): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* persistence is best-effort (private mode / quota) */
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: c }));
  } catch {
    /* no-op */
  }
}
