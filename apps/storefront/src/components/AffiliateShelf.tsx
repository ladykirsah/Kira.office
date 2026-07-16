import type { AffiliateItemRow } from "@/lib/db";
import { AffiliateCard } from "./AffiliateCard";

/**
 * Home "Mechanic Picks" shelf: a horizontal scroll-snap rail led by an editorial lead card (owner
 * voice + a one-time "these open external partner stores" disclosure), then the partner-tool cards.
 * The horizontal format itself signals "a curated few, not the catalogue," keeping this section
 * clearly distinct from the store's own product grids.
 */
export function AffiliateShelf({ items }: { items: AffiliateItemRow[] }) {
  return (
    <div className="rec-shelf">
      <div className="rec-lead">
        <div className="rec-lead-eye">AIRPLUS</div>
        <div className="rec-lead-title">
          ช่างเรา
          <br />
          ใช้จริง
        </div>
        <div className="rec-lead-note">เครื่องมือที่ช่างแอร์ของเราใช้จริง และคัดมาแนะนำ</div>
        <div className="rec-lead-tag">ลิงก์พาร์ทเนอร์ · เปิดหน้าร้านนอกเว็บ ↗</div>
      </div>
      {items.map((item) => (
        <AffiliateCard key={item.id} item={item} />
      ))}
    </div>
  );
}
