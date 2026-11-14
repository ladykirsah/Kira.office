"use client";

import { useState } from "react";
import Link from "next/link";
import { infoRows, type InfoRow } from "@/lib/productPage";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/home/CarSheets";

/**
 * การจัดส่ง · รับประกัน · เงื่อนไข · คืน·เคลม in ONE card (owner, 14 Nov 2026: "put topic in pic2 and the
 * other 2 topics on pic1 to be in the same section"); every row opens its sheet (board 3 · 3.2–3.4).
 * รับประกัน and คืน·เคลม open the same policy sheet, titled by the row tapped.
 */
export function InfoCard({
  warrantyDays,
  warrantyText,
  terms,
  categoryName,
}: {
  warrantyDays: number | null;
  /** "3 เดือน" — the same words as the row */
  warrantyText: string | null;
  /** the category's เงื่อนไข filled in for this product; null = no row */
  terms: string | null;
  categoryName: string | null;
}) {
  const [open, setOpen] = useState<InfoRow | null>(null);
  const rows = infoRows({ warrantyDays, hasTerms: terms !== null, categoryName });
  const close = () => setOpen(null);

  return (
    <>
      {/* Settings rows (board 3A): black name · grey value · › — a gap, no heading, above the card */}
      <div className="pp-group pp-group--plain">
        <div className="pp-card">
          {rows.map((r) => (
            <button key={r.key} type="button" className="pp-row" onClick={() => setOpen(r)}>
              <span className="pp-row-in">
                <span className="pp-row-l">{r.label}</span>
                <span className="pp-row-v">{r.value}</span>
                <Icon name="chevron" size={15} />
              </span>
            </button>
          ))}
        </div>
      </div>
      {open?.key === "ship" && (
        <Sheet title="การจัดส่ง" left="ยกเลิก" onLeft={close}>
          <div className="pp-sh pp-sh--list">
            <div className="pp-sh-item">
              <Icon name="truck" size={22} />
              <span>
                <b>Flash Express</b>
                <span>แพ็คส่งภายใน 1-2 วันทำการ · ค่าส่งตามน้ำหนักและปลายทาง เห็นตอนชำระเงิน</span>
              </span>
            </div>
            <div className="pp-sh-item">
              <Icon name="card" size={22} />
              <span>
                <b>จ่ายได้ 3 ทาง</b>
                <span>PromptPay · โอนเข้าบัญชีร้าน · เก็บเงินปลายทาง</span>
              </span>
            </div>
          </div>
        </Sheet>
      )}
      {(open?.key === "warranty" || open?.key === "returns") && (
        <Sheet title={open.label} left="ยกเลิก" onLeft={close}>
          <div className="pp-sh">
            {warrantyText && <b>รับประกัน {warrantyText}</b>}
            <p>
              สินค้าชำรุด เสียหายจากการขนส่ง หรือไม่ตรงตามที่แจ้ง — แจ้งเคลมพร้อมรูปถ่ายได้
              ช่างของเราตรวจสอบและคืนเงินภายใน 2-3 วันทำการเมื่ออนุมัติ
            </p>
            <Link href="/returns" className="pp-link">
              อ่านนโยบายการคืน ยกเลิก เคลม
            </Link>
          </div>
        </Sheet>
      )}
      {open?.key === "terms" && terms && (
        <Sheet title="เงื่อนไข" sub={categoryName ?? undefined} left="ยกเลิก" onLeft={close}>
          <div className="pp-sh">
            <p className="pp-pre">{terms}</p>
          </div>
        </Sheet>
      )}
    </>
  );
}
