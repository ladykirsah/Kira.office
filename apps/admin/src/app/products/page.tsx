import { fetchProducts } from "@/lib/api";
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
      <h1>Products ({products.length})</h1>
      <ProductsTable products={products} />
    </main>
  );
}
