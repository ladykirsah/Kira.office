"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OtpLogin } from "@/components/OtpLogin";

/** Centered login card. ?next= deep-links back to the page that demanded auth (checkout). */

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"phone" | "code" | "name" | "address">("phone");
  const next = searchParams.get("next") ?? "/account";
  // Same-site relative paths only — never an open redirect.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  // The post-auth success screens (name / address) carry their own heading — the generic page header
  // would just be redundant clutter above them, so hide it there.
  const showHeader = step !== "name" && step !== "address";
  return (
    <div style={{ maxWidth: 420, margin: "24px auto 0" }}>
      <div className="card" style={{ padding: 24 }}>
        {showHeader && (
          <>
            <h1 className="t-h1" style={{ margin: "0 0 6px", color: "var(--gray-dark)" }}>
              เข้าสู่ระบบ / สมัครสมาชิก
            </h1>
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 15,
                lineHeight: 1.5,
                color: "var(--gray-mid)",
              }}
            >
              ใช้เบอร์โทรศัพท์รับรหัส OTP — ไม่ต้องตั้งรหัสผ่าน
            </p>
          </>
        )}
        <OtpLogin onLoggedIn={() => router.push(target)} onStepChange={setStep} />
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
