"use client";

import type { CSSProperties } from "react";
import type { Attributes } from "@/lib/api";
import { inputL } from "@/lib/inputStyles";
import {
  categoryNamesForSystem,
  systemChangePatch,
  categoryPickPatch,
} from "@/lib/categoryCascade";
import { Combobox } from "./Combobox";
import { BarcodePreview } from "./BarcodePreview";
import { useT } from "../LangProvider";

export interface PartForm {
  brand: string;
  usage: string;
  type: string;
}

const field: CSSProperties = { display: "grid", gap: 4 };
const names = (opts: { name: string }[] | undefined) => (opts ?? []).map((o) => o.name);

/** Part taxonomy dropdowns + identifiers (Product ID, Shopee ID) for the part. The barcode is the
 *  Product ID — there is no separate barcode field; it's previewed beside the Product ID input. */
export function PartDetails({
  value,
  onChange,
  attributes,
  productRef,
  onProductRefChange,
  shopeeActive,
  onShopeeActiveChange,
  airplusLive,
  onAirplusLiveChange,
  refWarning,
}: {
  value: PartForm;
  onChange: (patch: Partial<PartForm>) => void;
  attributes: Attributes | null;
  productRef: string;
  onProductRefChange: (v: string) => void;
  /** "Active on Shopee" (= live/listed on Shopee). Rendered only when a handler is supplied. */
  shopeeActive?: boolean;
  onShopeeActiveChange?: (v: boolean) => void;
  /** "Live on AirPlus" (= the storefront shows it). Rendered only when a handler is supplied. */
  airplusLive?: boolean;
  onAirplusLiveChange?: (v: boolean) => void;
  /** Optional "already used by …" warnings shown under the matching identifier field. */
  refWarning?: string | null;
  shopeeWarning?: string | null;
}) {
  const t = useT();
  const warn = (msg: string | null | undefined) =>
    msg ? <small style={{ color: "var(--danger)", fontSize: 12 }}>{msg}</small> : null;

  const composed = [value.brand, value.usage, value.type]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "14px 16px",
        background: "var(--surface)",
      }}
    >
      <span style={{ fontWeight: 600 }}>{t({ th: "รายละเอียดอะไหล่", en: "Part details" })}</span>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
          gap: 12,
        }}
      >
        <label style={field}>
          {t({ th: "ยี่ห้ออะไหล่", en: "Part brand" })}
          <Combobox
            value={value.brand}
            onChange={(v) => onChange({ brand: v })}
            options={names(attributes?.brands)}
            placeholder={t({ th: "เช่น DENSO", en: "e.g. DENSO" })}
          />
        </label>
        <label style={field}>
          {t({ th: "ระบบรถที่ใช้ได้", en: "Match car system" })}
          <Combobox
            value={value.usage}
            onChange={(v) => onChange(systemChangePatch(attributes, v, value.type))}
            options={names(attributes?.usages)}
            placeholder={t({ th: "เช่น แอร์", en: "e.g. A/C" })}
          />
        </label>
        <label style={field}>
          {t({ th: "ชื่ออะไหล่", en: "Part name" })}
          <Combobox
            value={value.type}
            onChange={(v) => onChange(categoryPickPatch(attributes, v, value.usage))}
            options={categoryNamesForSystem(attributes, value.usage)}
            placeholder={t({ th: "เช่น ตู้แอร์", en: "e.g. Evaporator" })}
          />
        </label>
      </div>
      <small className="muted">
        Category: {composed || "—"} · pick the car system first — the part list filters to it (or
        type a new value to add it under that system).
      </small>

      {/* The Product ID is the single identifier — type it, or scan the part's barcode (which encodes
          it). The barcode is created from this value and previewed beside it; there is no separate
          barcode field. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          alignItems: "center",
        }}
      >
        <label style={field}>
          {t({ th: "รหัสสินค้า", en: "Product ID" })}
          <input
            value={productRef}
            onChange={(e) => onProductRefChange(e.target.value)}
            onKeyDown={(e) => {
              // A USB scanner ends a scan with Enter — don't let that submit the form.
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={t({ th: "พิมพ์หรือสแกนรหัสอะไหล่", en: "type or scan the part no." })}
            style={inputL}
          />
          {warn(refWarning)}
          <small className="muted" style={{ fontSize: 12 }}>
            {t({
              th: "พิมพ์เอง หรือสแกนบาร์โค้ดของอะไหล่ — บาร์โค้ดสร้างจากรหัสนี้",
              en: "Type it, or scan the part’s barcode — the barcode is created from this.",
            })}
          </small>
        </label>
        {productRef.trim() ? <BarcodePreview value={productRef.trim()} /> : null}
      </div>

      {/* Shopee ID is not shown any more — there is no Shopee API to link to (owner, 2026-07-29).
          The value is still carried through save so existing ids are preserved, not wiped. */}

      {/* One switch per sales channel (owner, 2026-08-24). Each is rendered only when its handler
          is supplied, which is how the edit page withholds BOTH from anyone but the super admin —
          putting a product on or off a channel is the owner's call, and the API refuses the same
          save independently (refuseChannelChange). Add product supplies neither and keeps its own
          Save-as-draft / Publish buttons. They were not always separate: "Active on
          Shopee" used to also make the product live on-site, because there was no AirPlus control
          here and it was the only way to publish. That is what put products in front of AirPlus
          customers by surprise. Each switch now moves its own channel and nothing else. */}
      {onAirplusLiveChange ? (
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={!!airplusLive}
              onChange={(e) => onAirplusLiveChange(e.target.checked)}
            />
            <span className="slider" />
          </span>
          <span>{t({ th: "วางขายบน AirPlus", en: "Live on AirPlus" })}</span>
          <small className="muted" style={{ fontSize: 12 }}>
            {t({ th: "— ลูกค้าเห็นสินค้านี้ในร้าน", en: "— customers can see it in your shop" })}
          </small>
        </label>
      ) : null}

      {onShopeeActiveChange ? (
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="switch">
            <input
              type="checkbox"
              checked={!!shopeeActive}
              onChange={(e) => onShopeeActiveChange(e.target.checked)}
            />
            <span className="slider" />
          </span>
          <span>{t({ th: "วางขายบน Shopee", en: "Live on Shopee" })}</span>
          <small className="muted" style={{ fontSize: 12 }}>
            {t({
              th: "— ทำเครื่องหมายว่าลงขายแล้ว · ถ้าจะหยุดขายต้องไปปิดใน Shopee เอง",
              en: "— marks it listed; pause it on Shopee itself by hand",
            })}
          </small>
        </label>
      ) : null}
    </div>
  );
}
