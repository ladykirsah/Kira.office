import { fetchProducts } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { ProductsTable } from "./ProductsTable";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products;
  try {
    products = await fetchProducts();
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
      <PageHeader title={`Products (${products.length})`} />
      <ProductsTable products={products} />
    </main>
  );
}
