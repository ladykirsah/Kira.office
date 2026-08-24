import "./globals.css";
import type { ReactNode } from "react";
import { ToastProvider } from "./ToastProvider";
import { AppShell } from "./AppShell";
import { PracticeCopyBanner } from "./PracticeCopyBanner";
import { StaffChip } from "./StaffChip";
import { currentStaff } from "@/lib/staffSession";

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

  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Above everything, including /login, which renders outside AppShell. */}
        <PracticeCopyBanner />
        <ToastProvider>
          <AppShell role={staff?.role} identity={staff ? <StaffChip staff={staff} /> : null}>
            {children}
          </AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
