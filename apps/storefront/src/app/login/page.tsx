"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OtpLogin } from "@/components/OtpLogin";

/** Centered login card. ?next= deep-links back to the page that demanded auth (checkout). */

/** Friendly message for a `?e=` code set by the LINE Login redirect routes. */
function lineErrorMessage(code: string | null): string | null {
  switch (code) {
    case "line_denied":
      return "การเข้าสู่ระบบด้วย LINE ถูกยกเลิก";
    case "line_unavailable":
      return "การเข้าสู่ระบบด้วย LINE ยังไม่พร้อมใช้งาน กรุณาใช้เบอร์โทรศัพท์";
    case "line_state":
    case "line_exchange":
    case "line_token":
      return "เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    default:
      return null;
  }
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";
  // Same-site relative paths only — never an open redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const lineError = lineErrorMessage(searchParams.get("e"));
  return (
    <div style={{ maxWidth: 420, margin: "24px auto 0" }}>
      <div className="card" style={{ padding: 24 }}>
        <h1 className="t-h1" style={{ margin: "0 0 6px", color: "var(--gray-dark)" }}>
          เข้าสู่ระบบ / สมัครสมาชิก
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.5, color: "var(--gray-mid)" }}>
          ใช้เบอร์โทรศัพท์รับรหัส OTP — ไม่ต้องตั้งรหัสผ่าน
        </p>
        {lineError && (
          <div
            role="alert"
            style={{
              margin: "0 0 14px",
              padding: "10px 14px",
              background: "var(--danger-soft)",
              color: "var(--danger)",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {lineError}
          </div>
        )}
        <OtpLogin onLoggedIn={() => router.push(target)} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="muted">กำลังโหลด…</p>}>
      <LoginContent />
    </Suspense>
  );
}
