import type { Metadata } from "next";
import { carBrandTiles, carModelOptions, getDb } from "@/lib/db";
import { resolveBrandLogo } from "@/lib/brandLogo";
import { MyCarProvider } from "@/components/home/MyCarProvider";
import { MyCarResults } from "@/components/home/MyCarResults";

// Live car taxonomy from D1 — render per request, never at build time.
export const dynamic = "force-dynamic";

// The shopper's own car lives on their phone only — nothing here for search engines.
export const metadata: Metadata = {
  title: "อะไหล่ที่ใส่ได้กับรถของฉัน — AirPlus",
  robots: { index: false, follow: true },
};

/** Board 1 · 1.7 "ดูอะไหล่ที่ใส่ได้": every part that fits the car saved on this phone. */
export default async function MyCarPage() {
  const db = await getDb();
  const [brands, models] = await Promise.all([carBrandTiles(db, 64), carModelOptions(db)]);
  return (
    <MyCarProvider>
      <MyCarResults
        brands={brands.map((b) => ({
          brand: b.brand,
          nameTh: b.nameTh,
          logo: resolveBrandLogo(b.brand, b.imageKey),
          productCount: b.productCount,
        }))}
        models={models}
      />
    </MyCarProvider>
  );
}
