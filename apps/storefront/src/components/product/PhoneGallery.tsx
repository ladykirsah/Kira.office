"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cartCount, useCart } from "@/lib/cart";
import { imgUrl } from "@/lib/img";
import { productShareTitle, shareOrCopy } from "@/lib/share";
import { Icon } from "@/components/Icon";

/** A product shows at most 10 photos (the computer gallery's rule). */
const MAX_IMAGES = 10;

/**
 * The phone product page's photos (board 3 · 3.1): square slides that fill the frame, ‹ back on the
 * left, แชร์ and 🛒 (→ ตะกร้า) on the right, the "1/7" count bottom-right. No photo → one grey ✦ slide.
 */
export function PhoneGallery({ keys, name }: { keys: string[]; name: string }) {
  const router = useRouter();
  const count = cartCount(useCart());
  const slides = keys.slice(0, MAX_IMAGES);
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const say = (msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  };
  const share = async () => {
    const outcome = await shareOrCopy(navigator, {
      title: productShareTitle(document.title),
      url: window.location.href,
    });
    // only say it copied when it did; the OS share sheet speaks for itself
    if (outcome === "copied") say("คัดลอกลิงก์แล้ว");
    else if (outcome === "unsupported") say("ไม่สามารถแชร์ได้ ลองอีกครั้ง");
  };

  return (
    <div className="pp-gal">
      <div className="pp-gal-track" ref={trackRef} onScroll={onScroll}>
        {slides.length === 0 ? (
          <div className="pp-gal-slide pp-gal-none" aria-hidden="true">
            ✦
          </div>
        ) : (
          slides.map((k, i) =>
            failed[k] ? (
              <div key={k} className="pp-gal-slide pp-gal-none" aria-hidden="true">
                ✦
              </div>
            ) : (
              <div key={k} className="pp-gal-slide">
                <img
                  src={imgUrl(k)}
                  alt={i === 0 ? name : ""}
                  loading={i === 0 ? "eager" : "lazy"}
                  onError={() => setFailed((f) => ({ ...f, [k]: true }))}
                />
              </div>
            ),
          )
        )}
      </div>
      <div className="pp-gal-top">
        <button type="button" className="pp-ov" aria-label="กลับ" onClick={back}>
          <Icon name="back" size={20} />
        </button>
        <span className="pp-gal-tools">
          <button type="button" className="pp-ov" aria-label="แชร์" onClick={() => void share()}>
            <Icon name="share" size={18} />
          </button>
          <Link href="/cart" className="pp-ov" aria-label={`ตะกร้า (${count} ชิ้น)`}>
            <Icon name="cart" size={18} />
            {count > 0 && <span className="pp-ov-badge">{count}</span>}
          </Link>
        </span>
      </div>
      {slides.length > 1 && (
        <span className="pp-gal-count" aria-live="polite">
          {idx + 1}/{slides.length}
        </span>
      )}
      {toast && (
        <div className="ap-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
