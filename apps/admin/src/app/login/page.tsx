import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/staffSession";
import { safeNextPath, EXPIRED_PARAM } from "@/lib/signedInGate";
import { LoginForm } from "./LoginForm";

// Always fresh: whether someone is already signed in decides whether this page should exist at all.
export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in — Kira.office" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string): string | null => {
    const v = params[key];
    return typeof v === "string" ? v : null;
  };
  // Sanitised here as well as on use: this value reaches a redirect, and a redirect is exactly what
  // an open-redirect needs. `safeNextPath` only ever returns a path on this site.
  const next = safeNextPath(one("next"));

  // Already signed in? Don't show a login form — send them where they were going, which until now
  // was always the dashboard no matter what `?next=` said.
  if (await currentStaff()) redirect(next);

  /**
   * Landed here holding a cookie the API does not recognise — an expired session, one revoked from
   * another device, or an account that has since been switched off. Saying so is the whole point:
   * the alternative is what happened on 24 Aug 2026, when a dead session drew the back office with
   * an empty name badge and no explanation at all.
   */
  const expired = one(EXPIRED_PARAM) === "1";

  return (
    <main className="login-page">
      <div className="login-box">
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 22 }}>
            Kira.office
          </div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            Den Air Service + AirPlus back office
          </div>
        </div>

        <div className="card">
          <LoginForm expired={expired} next={next} />
        </div>

        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 16 }}>
          Forgotten your password? Ask the owner to set a new one.
        </p>
      </div>
    </main>
  );
}
