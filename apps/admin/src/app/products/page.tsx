import { apiBase, fetchProducts } from "@/lib/api";
import { ProductImageUpload } from "./ProductImageUpload";
import { ArchiveButton } from "./ArchiveButton";

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
      {products.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📦</div>No products yet. Add one or import a CSV.
        </div>
      ) : (
        <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Image</th>
              <th align="left">Code</th>
              <th align="left">Name</th>
              <th align="left">Status</th>
              <th align="left">Upload</th>
              <th align="left"></th>
              <th align="left"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td>
                  {p.imageKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${apiBase}/img/${p.imageKey}`}
                      alt={p.name}
                      width={40}
                      height={40}
                      style={{ objectFit: "cover", borderRadius: 4 }}
                    />
                  ) : (
                    <span style={{ color: "var(--text-faint)" }}>—</span>
                  )}
                </td>
                <td>{p.productCode}</td>
                <td>{p.name}</td>
                <td>{p.status}</td>
                <td>
                  <ProductImageUpload productId={p.id} />
                </td>
                <td>
                  <a href={`/products/${p.id}/edit`}>Edit</a>
                </td>
                <td>
                  <ArchiveButton productId={p.id} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
