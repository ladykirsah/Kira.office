"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CarModelOption } from "@/lib/db";
import { cartCount, useCart } from "@/lib/cart";
import { carName } from "@/lib/myCar";
import { Icon } from "@/components/Icon";
import { BrandLogo, CarPicker, MyCarSheet, type CarBrandOption } from "./CarSheets";
import { MyCarCard } from "./MyCarCard";
import { useMyCar } from "./MyCarProvider";
import { PhoneCard } from "./PhoneCard";

/** Sub-page bar (owner's pick B, 5 Nov 2026): the same grey as the page — ‹ back · title · search, cart. */
function SubHeader({ title }: { title: string }) {
  const router = useRouter();
  const count = cartCount(useCart());
  const back = () => (window.history.length > 1 ? router.back() : router.push("/"));
  return (
    <header className="sub-head">
      <button type="button" className="sub-head-btn" aria-label="กลับ" onClick={back}>
        <Icon name="back" size={22} />
      </button>
      <h1 className="sub-head-t">{title}</h1>
      <div className="sub-head-tools">
        <Link href="/search" className="sub-head-btn" aria-label="ค้นหา">
          <Icon name="search" size={22} />
        </Link>
        <Link href="/cart" className="sub-head-btn" aria-label={`ตะกร้า (${count} ชิ้น)`}>
          <Icon name="cart" size={22} />
          {count > 0 && <span className="sub-head-badge">{count}</span>}
        </Link>
      </div>
    </header>
  );
}

/**
 * Board 1 · 1.7: the saved car on a strip (เปลี่ยน → the รถของฉัน sheet), "ใส่ได้กับ … · N รายการ", then
 * every fitting part. No car saved → the รถของฉัน card so the shopper can pick one here.
 */
export function MyCarResults({
  brands,
  models,
}: {
  brands: CarBrandOption[];
  models: CarModelOption[];
}) {
  const { car, ready, fit, fitFailed } = useMyCar();
  const [open, setOpen] = useState<"pick" | "mine" | null>(null);
  const logo = car ? (brands.find((b) => b.brand === car.brand)?.logo ?? null) : null;
  const full = car ? `${carName(car)}${car.year === null ? "" : ` ${car.year}`}` : "";

  return (
    <div className="mycar-page">
      <SubHeader title="อะไหล่ที่ใส่ได้" />
      {ready && !car && <MyCarCard brands={brands} models={models} />}
      {car && (
        <>
          <div className="hm-strip">
            <BrandLogo src={logo} size={32} />
            <span className="hm-strip-text">
              <span className="hm-muted-sm">รถของฉัน</span>
              <b>{full}</b>
            </span>
            <button type="button" className="hm-link" onClick={() => setOpen("mine")}>
              เปลี่ยน
            </button>
          </div>
          {fitFailed && <p className="hm-note">โหลดรายการไม่สำเร็จ กรุณาลองใหม่</p>}
          {!fitFailed && !fit && <p className="hm-note">กำลังโหลด…</p>}
          {fit && (
            <>
              <p className="hm-note">
                ใส่ได้กับ {full} · {fit.count} รายการ
              </p>
              {fit.items.length === 0 ? (
                <p className="hm-empty">ยังไม่มีอะไหล่ที่ใส่ได้กับรถคันนี้</p>
              ) : (
                <div className="hm-grid2 hm-grid2--8 hm-pad">
                  {fit.items.map((item) => (
                    <PhoneCard key={item.variantId} item={item} />
                  ))}
                </div>
              )}
            </>
          )}
          {open === "pick" && (
            <CarPicker brands={brands} models={models} onClose={() => setOpen(null)} />
          )}
          {open === "mine" && (
            <MyCarSheet
              car={car}
              logo={logo}
              onClose={() => setOpen(null)}
              onPickOther={() => setOpen("pick")}
            />
          )}
        </>
      )}
    </div>
  );
}
