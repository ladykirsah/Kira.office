import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import { SiteHeader } from "./SiteHeader";
import { CartHeader } from "./CartHeader";
import { InnerHeader } from "./InnerHeader";
import { SiteFooter } from "./SiteFooter";
import "./globals.css";

// Prompt is loaded ONLY as the cross-platform fallback for the CI's system-first stack (see
// --font-body in globals.css). Apple devices render SF Pro + Thonburi — identical to the locked
// CI preview; Android / Windows fall to this Prompt webfont ahead of their OS Thai defaults.
// Exposed as a CSS variable (not applied as a class) so the system fonts win when present.
const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AirPlus — อะไหล่แอร์รถยนต์",
  description:
    "AirPlus ร้านอะไหล่แอร์รถยนต์ออนไลน์ ของแท้ ราคาชัดเจน สั่งง่าย จ่ายผ่าน PromptPay โอนธนาคาร หรือเก็บเงินปลายทาง โดย Den Air Service",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={prompt.variable}>
      <body>
        <SiteHeader />
        <CartHeader />
        <InnerHeader />

        <main className="wrap" style={{ minHeight: "70vh", paddingTop: 16, paddingBottom: 16 }}>
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
