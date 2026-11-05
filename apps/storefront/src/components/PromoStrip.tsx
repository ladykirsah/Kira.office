import Link from "next/link";
import type { BannerRow } from "@/lib/db";
import { imgUrl } from "@/lib/img";

/** Promo strip: like a hero slide but static, wider ratio, one per row (server-safe). `phone` = the
 *  board 1 look (16px corners, no gap under it — the phone page spaces its own sections). */
export function PromoStrip({ banner, phone = false }: { banner: BannerRow; phone?: boolean }) {
  const image = (
    <div
      className="frame"
      style={{
        aspectRatio: "2659 / 984",
        borderRadius: phone ? 16 : "var(--radius)",
        marginBottom: phone ? 0 : 10,
      }}
    >
      {banner.imageKey ? (
        <img src={imgUrl(banner.imageKey)} alt="" loading="lazy" style={{ objectFit: "cover" }} />
      ) : (
        <span aria-hidden="true" style={{ color: "var(--brand)", fontSize: 44, lineHeight: 1 }}>
          ✦
        </span>
      )}
    </div>
  );
  if (banner.linkUrl && banner.linkUrl.startsWith("/")) {
    return (
      <Link href={banner.linkUrl} style={{ display: "block" }}>
        {image}
      </Link>
    );
  }
  if (banner.linkUrl && banner.linkUrl.startsWith("https://")) {
    return (
      <a href={banner.linkUrl} target="_blank" rel="noopener" style={{ display: "block" }}>
        {image}
      </a>
    );
  }
  return image;
}
