/** Typed client for the kiraoffice API Worker. */
export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://api.homeseeker.me";

export interface ProductRow {
  id: string;
  productCode: string;
  name: string;
  status: string;
}

export async function fetchProducts(): Promise<ProductRow[]> {
  const res = await fetch(`${apiBase}/products`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load products (HTTP ${res.status})`);
  const data = (await res.json()) as { products: ProductRow[] };
  return data.products;
}
