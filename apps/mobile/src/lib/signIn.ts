export type Credentials =
  | { kind: "pin"; pin: string }
  | { kind: "password"; email: string; password: string }
  | { kind: "key"; key: string }
  | { kind: "practice" };

export function signInRequest(c: Credentials): { path: string; body: Record<string, string> } {
  switch (c.kind) {
    case "pin":
      return { path: "/staff/login-pin", body: { pin: c.pin } };
    case "password":
      return { path: "/staff/login", body: { email: c.email, password: c.password } };
    case "key":
      return { path: "/staff/login-recovery", body: { key: c.key } };
    case "practice":
      return { path: "/staff/login-practice", body: {} };
  }
}

export type StaffRole = "super_admin" | "admin" | "mechanic";

export interface SignedInStaff {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
}

export type SignInFailure =
  | "invalid"
  | "locked"
  | "needs_reset"
  | "pin_login_unavailable"
  | "too_many_attempts"
  | "not_available"
  | "unreachable";

export type SignInResult =
  { ok: true; token: string; staff: SignedInStaff } | { ok: false; failure: SignInFailure };

const ROLES: readonly StaffRole[] = ["super_admin", "admin", "mechanic"];
const NAMED_REASONS: readonly SignInFailure[] = ["locked", "needs_reset", "pin_login_unavailable"];

/** The server's reply is outside input: anything that is not exactly a signed-in person is a refusal. */
export function readStaff(raw: unknown): SignedInStaff | null {
  if (typeof raw !== "object" || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const fields = [s.userId, s.email, s.name];
  if (!fields.every((f) => typeof f === "string")) return null;
  if (!ROLES.includes(s.role as StaffRole)) return null;
  return {
    userId: s.userId as string,
    email: s.email as string,
    name: s.name as string,
    role: s.role as StaffRole,
  };
}

export function readSignInReply(status: number, body: unknown): SignInResult {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  if (status === 200) {
    const staff = readStaff(b.staff);
    return typeof b.token === "string" && b.token !== "" && staff
      ? { ok: true, token: b.token, staff }
      : { ok: false, failure: "invalid" };
  }
  if (status === 429) return { ok: false, failure: "too_many_attempts" };
  if (status === 404) return { ok: false, failure: "not_available" };
  // A missing PEPPER comes back as `error`, a refused credential as `reason` — read both.
  const named = NAMED_REASONS.find((r) => r === b.reason || r === b.error);
  return { ok: false, failure: named ?? "invalid" };
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Straight to the API — unlike the web back office, which relays through its own server so it can set
 * an httpOnly cookie. An app holds the token itself (secure storage on a phone), so there is nothing
 * to relay; the API stays the only thing that decides whether a credential is good.
 */
export async function signIn(
  fetchFn: FetchFn,
  base: string,
  c: Credentials,
): Promise<SignInResult> {
  const { path, body } = signInRequest(c);
  let res: Response;
  try {
    res = await fetchFn(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, failure: "unreachable" };
  }
  const reply: unknown = await res.json().catch(() => null);
  return readSignInReply(res.status, reply);
}
