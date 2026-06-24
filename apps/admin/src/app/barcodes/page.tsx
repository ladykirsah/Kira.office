import { fetchProducts, fetchBarcodes } from "@/lib/api";
import { LabelStudio, type StudioProduct } from "./LabelStudio";

export const dynamic = "force-dynamic";

export default async function BarcodesPage() {
  let products, barcodes;
  try {
    [products, barcodes] = await Promise.all([fetchProducts(), fetchBarcodes()]);
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
    barcode: barcodeByProduct.get(p.id) ?? null,
  }));

  return <LabelStudio products={studioProducts} />;
}
