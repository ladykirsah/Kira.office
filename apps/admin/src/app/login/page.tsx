import { redirect } from "next/navigation";
import { currentStaff } from "@/lib/staffSession";
import { LoginForm } from "./LoginForm";

// Always fresh: whether someone is already signed in decides whether this page should exist at all.
export const dynamic = "force-dynamic";

export const metadata = { title: "Sign in — Kira.office" };

export default async function LoginPage() {
  // Already signed in? Don't show a login form — send them where they were going.
  if (await currentStaff()) redirect("/");

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
          <LoginForm />
        </div>

        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 16 }}>
          Forgotten your password? Ask the owner to set a new one.
        </p>
      </div>
    </main>
  );
}
