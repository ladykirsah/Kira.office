import { fetchProducts, fetchBarcodes, fetchShopInfo } from "@/lib/api";
import { LabelStudio, type StudioProduct } from "./LabelStudio";

export const dynamic = "force-dynamic";

export default async function BarcodesPage() {
  let products, barcodes, shopInfo;
  try {
    [products, barcodes, shopInfo] = await Promise.all([
      fetchProducts(),
      fetchBarcodes(),
      fetchShopInfo().catch(() => ({ name: "", address: "" })),
    ]);
  } catch (err) {
    return (
      <main>
        <h1>Barcode labels</h1>
        <p style={{ color: "var(--danger)" }}>Could not load: {(err as Error).message}</p>
      </main>
    );
  }

  const barcodeByProduct = new Map(barcodes.map((b) => [b.productId, b.barcode]));
  const studioProducts: StudioProduct[] = products.map((p) => ({
    id: p.id,
    code: p.productCode,
    name: p.name,
    imageKey: p.imageKey,
    tags: [p.brandName, p.usageName, p.typeName].filter((t): t is string => !!t),
    brandName: p.brandName,
    usageName: p.usageName,
    typeName: p.typeName,
    carBrands: p.carBrands,
    barcode: barcodeByProduct.get(p.id) ?? null,
  }));

  const shopName = shopInfo.name || "Den Air Service (Surin)";
  return <LabelStudio products={studioProducts} shopName={shopName} />;
}
