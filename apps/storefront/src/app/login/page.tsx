"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OtpLogin } from "@/components/OtpLogin";

/** Centered login card. ?next= deep-links back to the page that demanded auth (checkout). */

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/account";
  // Same-site relative paths only — never an open redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return (
    <div style={{ maxWidth: 420, margin: "24px auto 0" }}>
      <div className="card" style={{ padding: 24 }}>
        <h1 className="t-h3" style={{ margin: "0 0 4px" }}>
          เข้าสู่ระบบ / สมัครสมาชิก
        </h1>
        <p className="muted" style={{ margin: "0 0 16px" }}>
          ใช้เบอร์โทรศัพท์รับรหัส OTP — ไม่ต้องตั้งรหัสผ่าน
        </p>
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
