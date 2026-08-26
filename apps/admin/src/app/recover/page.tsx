import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/staffSession";
import { safeNextPath } from "@/lib/signedInGate";
import { RecoverForm } from "./RecoverForm";
import { LanguageToggle } from "../LanguageToggle";
import { serverT } from "@/lib/serverLang";

// Always fresh: whether someone is already signed in decides whether this page should exist at all.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await serverT();
  return { title: t({ th: "ทางเข้าฉุกเฉิน — Kira.office", en: "Owner rescue — Kira.office" }) };
}

/**
 * The rescue door (owner's decision, 2026-08-25).
 *
 * The everyday way into Kira.office is the PIN or the password. Both can be lost, and every
 * recovery path in the staff login ends at "ask a super admin to set a new one" — which is no
 * recovery at all when the person locked out IS the super admin, and there is no bootstrap: the
 * first super-admin row can only ever be written straight into D1.
 *
 * Cloudflare Access used to stand in front of the whole back office and therefore solved this by
 * accident. Now it covers this address alone: rare enough never to be in the way, present enough
 * that being locked out is never final. Reaching this page means Access already emailed a one-time
 * code and had it typed back correctly.
 */
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params["next"];
  // Sanitised here as well as on use: this value reaches a navigation, which is what an
  // open-redirect needs. `safeNextPath` only ever returns a path on this site.
  const next = safeNextPath(typeof raw === "string" ? raw : null);

  // Already signed in? Then this is not a rescue, and showing a "sign in as the owner" button to
  // someone who is already someone would only invite them to become somebody else.
  if (await currentStaff()) redirect(next);
  const t = await serverT();

  return (
    <main className="login-page">
      <div className="login-box">
        {/* Its own language button, for the same reason the sign-in page has one: this screen is
            outside the app frame, and somebody locked out cannot reach the frame's toggle. */}
        <div style={{ display: "flex", marginBottom: 4 }}>
          <LanguageToggle />
        </div>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div className="brand" style={{ fontSize: 22 }}>
            Kira.office
          </div>
          <div className="muted" style={{ fontSize: 13.5 }}>
            {t({ th: "ทางเข้าฉุกเฉิน", en: "Owner rescue" })}
          </div>
        </div>

        <div className="card">
          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6 }}>
            {t({
              th: "คุณเข้าหน้านี้ได้เพราะใส่รหัสที่ส่งไปยังอีเมลของเจ้าของร้านถูกต้อง ระบบจึงยืนยันตัวตนแล้ว การเข้าใช้งานตรงนี้จะกู้บัญชีเจ้าของร้านกลับมา และเปิดใช้งานให้ใหม่ถ้าเคยถูกล็อก ปิด หรือลบไป",
              en: "You reached this page by entering the code sent to the owner’s email, so your identity is already proven. Signing in here restores the owner account and switches it back on if it had been locked, deactivated or removed.",
            })}
          </p>
          <p className="muted" style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.6 }}>
            {t({
              th: "รหัส 6 หลักกับรหัสผ่านเดิมยังอยู่เหมือนเดิม เข้าไปได้แล้วค่อยตั้งใหม่ที่หน้าโปรไฟล์",
              en: "Your PIN and password are left exactly as they are. Set a new one from your profile once you are back in.",
            })}
          </p>
          <RecoverForm next={next} />
        </div>

        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 16 }}>
          {t({ th: "จำรหัส 6 หลักได้? ", en: "Know your PIN? " })}
          <a href="/login">{t({ th: "เข้าใช้งานตามปกติ", en: "Sign in normally" })}</a>.
        </p>
      </div>
    </main>
  );
}
