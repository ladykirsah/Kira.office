import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/staffSession";
import { safeNextPath, EXPIRED_PARAM } from "@/lib/signedInGate";
import { LoginForm } from "./LoginForm";
import { LanguageToggle } from "../LanguageToggle";
import { serverT } from "@/lib/serverLang";

// Always fresh: whether someone is already signed in decides whether this page should exist at all.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await serverT();
  return { title: t({ th: "เข้าใช้งาน — Kira.office", en: "Sign in — Kira.office" }) };
}

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
  const t = await serverT();

  return (
    <main className="login-page">
      <div className="login-box">
        {/* THE ONE SCREEN OUTSIDE THE APP FRAME, so it carries its own language button (owner,
            2026-08-26). Without it the choice could only be made after signing in — which is the
            wrong way round for the first screen anybody ever sees. */}
        <div style={{ display: "flex", marginBottom: 4 }}>
          <LanguageToggle />
        </div>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 22 }}>
            Kira.office
          </div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {t({
              th: "ระบบหลังร้าน Den Air Service + AirPlus",
              en: "Den Air Service + AirPlus back office",
            })}
          </div>
        </div>

        <div className="card">
          <LoginForm expired={expired} next={next} />
        </div>

        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 16 }}>
          {t({
            th: "ลืมรหัสผ่าน? ให้เจ้าของร้านตั้งให้ใหม่",
            en: "Forgotten your password? Ask the owner to set a new one.",
          })}
        </p>
      </div>
    </main>
  );
}
