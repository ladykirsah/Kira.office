"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { apiBase, uploadGalleryImage, deleteGalleryImage, type ProductImage } from "@/lib/api";
import { addToBuffer, type BufferPhoto } from "@/lib/photoBuffer";
import { useToast } from "../ToastProvider";
import { useT } from "../LangProvider";

const MAX = 10;

/** Editable 10-frame image gallery. The first image is the cover; also kept on products.image_key.
 *
 * Two modes:
 *  - Upload mode (edit page): a product already exists, so each pick uploads immediately.
 *  - Buffer mode (Add page): pass `buffer` + `onBufferChange` and photos are held locally as
 *    object-URL previews, to be uploaded by the parent on Save. This lets photos be added before the
 *    product exists — any order, no product created just to hold an image.
 */
export function ProductGallery({
  productId,
  initial,
  buffer,
  onBufferChange,
}: {
  productId: string;
  initial: ProductImage[];
  buffer?: BufferPhoto[];
  onBufferChange?: (next: BufferPhoto[]) => void;
}) {
  const t = useT();
  const bufferMode = buffer !== undefined && onBufferChange !== undefined;
  const [images, setImages] = useState<ProductImage[]>(initial);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (bufferMode) {
      // Hold locally; the parent creates the product and uploads these on Save.
      const next = addToBuffer(
        buffer,
        { id: crypto.randomUUID(), file, url: URL.createObjectURL(file) },
        MAX,
      );
      if (next === buffer) {
        toast(t({ th: `ใส่รูปได้สูงสุด ${MAX} รูป`, en: `Up to ${MAX} images` }), "error");
        return;
      }
      onBufferChange(next);
      return;
    }

    setBusy(true);
    try {
      const img = await uploadGalleryImage(productId, file);
      setImages((prev) => [...prev, img]);
      toast(t({ th: "เพิ่มรูปแล้ว ✓", en: "Image added ✓" }), "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function removeBuffered(id: string) {
    if (!bufferMode) return;
    const target = buffer.find((b) => b.id === id);
    if (target) URL.revokeObjectURL(target.url);
    onBufferChange(buffer.filter((b) => b.id !== id));
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteGalleryImage(productId, id);
      setImages((prev) => prev.filter((x) => x.id !== id));
      toast(t({ th: "ลบรูปแล้ว", en: "Image removed" }), "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  // The frames are the buffered previews (Add page) or the uploaded images (edit page).
  const frames = bufferMode
    ? buffer.map((b) => ({ key: b.id, src: b.url, onRemove: () => removeBuffered(b.id) }))
    : images.map((img) => ({
        key: img.id,
        src: `${apiBase}/img/${img.imageKey}`,
        onRemove: () => remove(img.id),
      }));
  const canAdd = frames.length < MAX;

  return (
    <div>
      <div className="frames">
        {frames.map((f, i) => (
          <div className="frame" key={f.key}>
            <img src={f.src} alt="" />
            {i === 0 && <span className="cover-badge">{t({ th: "รูปหลัก", en: "Cover" })}</span>}
            <button
              type="button"
              className="frame-x"
              title={t({ th: "ลบ", en: "Remove" })}
              disabled={busy}
              onClick={f.onRemove}
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
            aria-label={t({ th: "เพิ่มรูป", en: "Add image" })}
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
        {frames.length}/{MAX}{" "}
        {t({
          th: "รูป · รูปแรกคือรูปหลัก · JPG/PNG/WebP, ไม่เกิน 5MB",
          en: "images · first is the cover · JPG/PNG/WebP, ≤5MB",
        })}
      </p>
    </div>
  );
}
