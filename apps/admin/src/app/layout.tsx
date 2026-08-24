import "./globals.css";
import type { ReactNode } from "react";
import { ToastProvider } from "./ToastProvider";
import { AppShell } from "./AppShell";
import { PracticeCopyBanner } from "./PracticeCopyBanner";
import { StaffRoleProvider } from "./StaffRoleProvider";
import { StaffChip } from "./StaffChip";
import { currentStaff } from "@/lib/staffSession";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { mustSignIn, GATED_PATH_HEADER, EXPIRED_PARAM } from "@/lib/signedInGate";

export const metadata = {
  title: "Kira.office — Admin",
  description: "Den Air Service + AirPlus back office",
};

// Apply the saved theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Read once here rather than in every page: the top bar shows who is signed in on every screen,
  // which is what makes a shared counter tablet safe to use.
  const staff = await currentStaff();

  // And it is the sign-in check, because it is the only place that has asked the API who the token
  // belongs to. The middleware can only see that a cookie exists; a cookie outliving its session
  // used to buy a complete, silent, nameless back office (24 Aug 2026). If the API does not know
  // this token, the page is not drawn — no half-signed-in state, ever.
  const path = (await headers()).get(GATED_PATH_HEADER);
  if (mustSignIn(path, staff !== null)) {
    const next = path && path !== "/" ? `&next=${encodeURIComponent(path)}` : "";
    redirect(`/login?${EXPIRED_PARAM}=1${next}`);
  }

  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Above everything, including /login, which renders outside AppShell. */}
        <PracticeCopyBanner />
        <StaffRoleProvider role={staff?.role ?? null}>
          <ToastProvider>
            <AppShell role={staff?.role} identity={staff ? <StaffChip staff={staff} /> : null}>
              {children}
            </AppShell>
          </ToastProvider>
        </StaffRoleProvider>
      </body>
    </html>
  );
}
