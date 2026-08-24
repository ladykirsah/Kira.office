import { fetchProducts } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { ProductsTable } from "./ProductsTable";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products;
  try {
    // The only caller that wants archived rows — they live under the "Not live" tab.
    products = await fetchProducts({ includeArchived: true });
  } catch (err) {
    return (
      <main>
        <h1>Products</h1>
        <p style={{ color: "var(--danger)" }}>Could not load products: {(err as Error).message}</p>
      </main>
    );
  }

  return (
    <main>
      {/* Counts the catalog you have, not the archive: archived rows are fetched only so the
          "Not live" tab can list them, and would otherwise make this number climb as you delete. */}
      <PageHeader title={`Products (${products.filter((p) => p.status !== "archived").length})`} />
      <ProductsTable products={products} />
    </main>
  );
}
