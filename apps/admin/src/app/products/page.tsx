import { fetchProducts } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  let products;
  try {
    products = await fetchProducts();
  } catch (err) {
    return (
      <main>
        <h1>Products</h1>
        <p style={{ color: "crimson" }}>Could not load products: {(err as Error).message}</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Products ({products.length})</h1>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Code</th>
            <th align="left">Name</th>
            <th align="left">Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
              <td>{p.productCode}</td>
              <td>{p.name}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
