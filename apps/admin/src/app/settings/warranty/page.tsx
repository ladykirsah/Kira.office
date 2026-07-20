import { redirect } from "next/navigation";

/**
 * Warranty windows moved onto the Product categories card in Part attributes (2026-07-20), so a
 * category is created complete — title + cover photo + warranty — in one place instead of three.
 * Kept as a redirect rather than deleted so existing bookmarks/links still land somewhere useful.
 */
export default function WarrantySettingsPage() {
  redirect("/settings/attributes");
}
