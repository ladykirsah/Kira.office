"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getProductDetail, type ProductDetail } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { PageHeader } from "../../PageHeader";
import { BackLink } from "../../BackLink";
import { useToast } from "../../ToastProvider";
import { ProductView } from "../ProductView";

/**
 * Read-only product detail. The products table and the "View product" scan mode land here; the
 * page shows the same overview as the editor's view mode (shared `ProductView`), with an Edit
 * button through to `/products/[id]/edit`.
 */
export default function ProductViewPage() {
  const id = useParams().id as string;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ProductDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProductDetail(id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) toast((err as Error).message, "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading)
    return (
      <main>
        <h1>Product</h1>
        <div className="skeleton skeleton-row" style={{ width: "50%" }} />
        <div className="skeleton skeleton-row" style={{ width: "90%" }} />
        <div className="skeleton skeleton-row" style={{ width: "70%" }} />
      </main>
    );

  if (!detail)
    return (
      <main>
        <h1>Product</h1>
        <p className="muted">Not found.</p>
        <p>
          <BackLink href="/products">Products</BackLink>
        </p>
      </main>
    );

  const p = detail.product;

  return (
    <main>
      <PageHeader
        title={p.name}
        subtitle={p.updatedAt ? `Last updated date: ${formatUpdatedAt(p.updatedAt)}` : p.productRef}
        below={<BackLink href="/products">Products</BackLink>}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
            <a className="btn-primary" href={`/products/${id}/edit?edit=1`}>
              Edit
            </a>
          </div>
        }
      />
      <ProductView detail={detail} />
    </main>
  );
}
