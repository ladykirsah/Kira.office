import { fetchProducts } from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { ProductsTable } from "./ProductsTable";
import { serverT } from "@/lib/serverLang";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const t = await serverT();
  let products;
  try {
    products = await fetchProducts();
  } catch (err) {
    return (
      <main>
        <h1>{t({ th: "สินค้า", en: "Products" })}</h1>
        <p style={{ color: "var(--danger)" }}>
          {t({ th: "โหลดรายการสินค้าไม่สำเร็จ", en: "Could not load products" })}:{" "}
          {(err as Error).message}
        </p>
      </main>
    );
  }

  return (
    <main>
      <PageHeader title={`${t({ th: "สินค้า", en: "Products" })} (${products.length})`} />
      <ProductsTable products={products} />
    </main>
  );
}
