"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { apiBase, uploadGalleryImage, deleteGalleryImage, type ProductImage } from "@/lib/api";
import { useToast } from "../ToastProvider";

const MAX = 10;

/** Editable 10-frame image gallery. The first image is the cover; also kept on products.image_key. */
export function ProductGallery({
  productId,
  initial,
  ensureProductId,
}: {
  productId: string;
  initial: ProductImage[];
  /** When productId is empty (e.g. the Add page), create the product on first upload and return its id. */
  ensureProductId?: () => Promise<string | null>;
}) {
  const [images, setImages] = useState<ProductImage[]>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const pid = productId || (ensureProductId ? await ensureProductId() : "");
      if (!pid) return;
      const img = await uploadGalleryImage(pid, file);
      setImages((prev) => [...prev, img]);
      toast("Image added ✓", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteGalleryImage(productId, id);
      setImages((prev) => prev.filter((x) => x.id !== id));
      toast("Image removed", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const canAdd = images.length < MAX;

  return (
    <div>
      <div className="frames">
        {images.map((img, i) => (
          <div className="frame" key={img.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${apiBase}/img/${img.imageKey}`} alt="" />
            {i === 0 && <span className="cover-badge">Cover</span>}
            <button
              type="button"
              className="frame-x"
              title="Remove"
              disabled={busy}
              onClick={() => remove(img.id)}
            >
              ✕
            </button>
          </div>
        ))}
        {/* A single "Add" tile at the end; disappears once all 10 are filled. */}
        {canAdd && (
          <button
            type="button"
            className="frame empty"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            aria-label="Add image"
          >
            +
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onPick}
        style={{ display: "none" }}
      />
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        {images.length}/{MAX} images · first is the cover · JPG/PNG/WebP, ≤5MB
      </p>
    </div>
  );
}
