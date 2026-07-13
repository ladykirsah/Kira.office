import type { Metadata, Viewport } from "next";
import { Prompt } from "next/font/google";
import { SiteHeader } from "./SiteHeader";
import { CartHeader } from "./CartHeader";
import { InnerHeader } from "./InnerHeader";
import { SearchLandingBar } from "./search/SearchLandingBar";
import { SiteFooter } from "./SiteFooter";
import "./globals.css";

// Prompt is a genuine LAST-RESORT fallback for the CI's system-first stack (see --font-body in
// globals.css): every real platform has a Thai system font (Thonburi / Leelawadee / Noto) that is
// ordered BEFORE Prompt, so Prompt is essentially never rendered. `preload: false` therefore keeps
// its ~24 weight/style/subset files OFF the critical path — otherwise next/font preloads them on
// every page (network flood + a swap reflow = the "messy for a while" flash). With preload off they
// only fetch (via @font-face) on the rare device that truly lacks a Thai font. Exposed as a CSS
// variable so the system fonts still win when present.
const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-prompt",
  display: "swap",
  preload: false,
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
        <SearchLandingBar />

        <main className="wrap" style={{ minHeight: "70vh", paddingTop: 16, paddingBottom: 16 }}>
          {children}
        </main>

        <SiteFooter />
      </body>
    </html>
  );
}
