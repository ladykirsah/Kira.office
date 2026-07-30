"use client";

import { useRef, useState } from "react";
import { CARRIERS, DEFAULT_CARRIER, toSatang } from "@l-shopee/core";
import { saveOrderDropOff, type OrderDetail, type ShopInfo } from "@/lib/api";
import { saveLabelPdf, saveLabelPng, shippingLabelFileName } from "@/lib/labelFile";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { card, sectionTitle } from "./cardStyles";

/**
 * Everything that happens to a parcel on its way out the door.
 *
 * While the order is To ship this is the FIRST section on the page (owner, 30 Jul 2026): print the
 * label you carry to the counter, then come back with the receipt and type in what Flash charged.
 * Once it ships the section goes away entirely and the Shipping card carries the record instead —
 * which is why the label export also exists on its own, as `LabelActions`.
 *
 * The label carries NO barcode and NO tracking number. Flash issues the tracking number at the
 * counter, so a label printed beforehand cannot have one; printing a fabricated number would put a
 * parcel into the world with an identifier that resolves to nothing.
 */

const field = { display: "flex", flexDirection: "column", gap: 4 } as const;

interface ShipmentProps {
  order: OrderDetail["order"];
  address: OrderDetail["address"];
  lines: OrderDetail["lines"];
  shop: ShopInfo;
  onError: (message: string) => void;
}

interface SectionProps extends ShipmentProps {
  /**
   * The order's own status badge, passed in rather than rebuilt here. Hardcoding "To ship" + the blue
   * pill would fork the colour mapping in lib/badges — the owner picked those colours deliberately
   * (only three states earn one) and a second copy would not follow when they change.
   */
  status: { pill: string; label: string };
}

/**
 * The label node plus its two exports.
 *
 * One node, shown or parked off-screen depending on the caller, and it is the SAME node both formats
 * rasterise — so what is on screen is what saves. html2canvas can only capture a node the browser has
 * actually laid out; a `display: none` label measures 0×0 and saves a blank file.
 */
function useLabelExport(orderRef: string, onError: (message: string) => void) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [busyFile, setBusyFile] = useState<"pdf" | "png" | null>(null);

  async function saveFile(kind: "pdf" | "png") {
    const node = labelRef.current;
    if (!node) return;
    setBusyFile(kind);
    try {
      const name = shippingLabelFileName(kind, orderRef);
      if (kind === "pdf") await saveLabelPdf(node, name);
      else await saveLabelPng(node, name);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyFile(null);
    }
  }

  return { labelRef, busyFile, saveFile };
}

function LabelButtons({
  busyFile,
  saveFile,
}: {
  busyFile: "pdf" | "png" | null;
  saveFile: (kind: "pdf" | "png") => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn-primary btn-sm"
        disabled={busyFile !== null}
        onClick={() => saveFile("pdf")}
      >
        {busyFile === "pdf" ? "Saving…" : "Save label PDF"}
      </button>
      <button
        type="button"
        className="btn-soft btn-sm"
        disabled={busyFile !== null}
        onClick={() => saveFile("png")}
      >
        {busyFile === "png" ? "Saving…" : "Save label PNG"}
      </button>
    </div>
  );
}

/** The full-width section at the top of the page, while the order is waiting to go out. */
export function ShipmentSection({ order, address, lines, shop, status, onError }: SectionProps) {
  const { labelRef, busyFile, saveFile } = useLabelExport(order.externalOrderId, onError);

  return (
    <>
      <div
        style={{
          ...card,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Shipment</div>
          <span className={`pill ${status.pill}`}>{status.label}</span>
        </div>
        <LabelButtons busyFile={busyFile} saveFile={saveFile} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
          alignItems: "start",
        }}
      >
        <DropOffCard order={order} onError={onError} />
        <div style={card}>
          <div style={sectionTitle}>Shipping label</div>
          {/* overflow-x rather than a fluid width: the label is a fixed 378px so the capture is
              predictable, and a squeezed column should scroll it, not reflow what gets printed. */}
          <div style={{ overflowX: "auto" }}>
            <ShippingLabel
              ref={labelRef}
              order={order}
              address={address}
              lines={lines}
              shop={shop}
            />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Label export with no drop-off form — for an order that has already shipped. Lives inside the
 * Shipping card so the label stays reachable at any point in the order's life, which is the whole
 * reason this is a separate export.
 */
export function LabelActions({ order, address, lines, shop, onError }: ShipmentProps) {
  const { labelRef, busyFile, saveFile } = useLabelExport(order.externalOrderId, onError);

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <LabelButtons busyFile={busyFile} saveFile={saveFile} />
      <div style={{ position: "absolute", left: -99999, top: 0 }} aria-hidden="true">
        <ShippingLabel ref={labelRef} order={order} address={address} lines={lines} shop={shop} />
      </div>
    </div>
  );
}

function DropOffCard({
  order,
  onError,
}: {
  order: OrderDetail["order"];
  onError: (message: string) => void;
}) {
  const [carrier, setCarrier] = useState<string>(order.carrier ?? DEFAULT_CARRIER);
  const [trackingNo, setTrackingNo] = useState(order.trackingNo ?? "");
  const [realBaht, setRealBaht] = useState("");
  const [saving, setSaving] = useState(false);

  const realSatang = parseBaht(realBaht);
  const canSave = trackingNo.trim().length > 0 && realSatang != null && !saving;

  async function save() {
    if (realSatang == null) return;
    setSaving(true);
    try {
      await saveOrderDropOff(order.id, {
        carrier,
        trackingNo: trackingNo.trim(),
        shippingRealSatang: realSatang,
      });
      location.reload();
    } catch (e) {
      onError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div style={card}>
      <div style={sectionTitle}>Record drop-off</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <label style={field}>
          <span style={tableText.subtitle}>Carrier</span>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} style={inputS}>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={field}>
          <span style={tableText.subtitle}>Tracking number</span>
          <input
            value={trackingNo}
            onChange={(e) => setTrackingNo(e.target.value)}
            placeholder="TH…"
            style={inputS}
          />
        </label>
        <label style={field}>
          <span style={tableText.subtitle}>Real charge ฿</span>
          {/* A placeholder, never a prefilled value: an amount nobody typed is an amount that could
              be saved by accident, and it lands in the owner's profit figure. */}
          <input
            value={realBaht}
            onChange={(e) => setRealBaht(e.target.value)}
            inputMode="decimal"
            placeholder="90.00"
            style={inputS}
          />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary btn-sm"
          disabled={!canSave}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save drop-off"}
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          alignItems: "baseline",
        }}
      >
        <span style={{ ...sectionTitle, marginBottom: 0, whiteSpace: "nowrap" }}>On save</span>
        <span style={tableText.subtitle}>
          Order moves to <strong>In transit</strong>, the timeline gets one “จัดส่งแล้ว” entry,{" "}
          <strong>On us</strong> and <strong>Profit</strong> recalculate, and the tracking link
          appears on this page.
        </span>
      </div>
    </div>
  );
}

/** ฿ text → satang, or null when it is not a number we should send. */
function parseBaht(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return toSatang(n);
}

/**
 * A 100×150mm parcel label at 96dpi. Fixed width so the capture is predictable; a long item list is
 * allowed to grow the height rather than being clipped, which is why the PDF page is sized from the
 * captured canvas instead of assumed (see labelPage).
 */
function ShippingLabel({
  ref,
  order,
  address,
  lines,
  shop,
}: {
  ref: React.Ref<HTMLDivElement>;
  order: OrderDetail["order"];
  address: OrderDetail["address"];
  lines: OrderDetail["lines"];
  shop: ShopInfo;
}) {
  const to = [
    address?.addressLine1,
    address?.subdistrict,
    address?.district,
    address?.province,
    address?.postalCode,
  ]
    .filter(Boolean)
    .join(" ");

  // Literal colours, not tokens: this node is rasterised to a file that gets printed on white paper,
  // and it must not follow the operator's dark mode into an unreadable label.
  const ink = "#000000";
  const grey = "#555555";
  const role = {
    fontSize: 9,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: grey,
    marginBottom: 3,
  } as const;

  return (
    <div
      ref={ref}
      style={{
        border: `1px solid ${ink}`,
        background: "#ffffff",
        color: ink,
        width: 378,
        fontFamily: '-apple-system, "Helvetica Neue", "Thonburi", sans-serif',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: `1px solid ${ink}`,
          fontWeight: 700,
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>{shop.nameEn || shop.name || "AirPlus Auto"}</span>
        <span>{order.externalOrderId}</span>
      </div>

      <div style={{ padding: "8px 10px" }}>
        <div style={role}>From</div>
        <div style={{ fontWeight: 600 }}>
          {shop.name || "AirPlus Auto"}
          {shop.shipFromPhone ? ` · ${shop.shipFromPhone}` : ""}
        </div>
        <div>
          {shop.address}
          {shop.shipFromPostcode ? ` ${shop.shipFromPostcode}` : ""}
        </div>
      </div>

      <div style={{ padding: "8px 10px", borderTop: `1px dashed ${ink}` }}>
        <div style={role}>To</div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>
          {address?.recipientName ?? "—"}
          {address?.phone ? ` · ${address.phone}` : ""}
        </div>
        <div>{to || "No address on this order"}</div>
      </div>

      <div style={{ padding: "8px 10px", borderTop: `1px solid ${ink}` }}>
        <div style={role}>Contents</div>
        {lines.map((l) => (
          <div
            key={l.id}
            style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}
          >
            <span>
              {l.name ?? l.sku ?? l.variantId}
              {/* Brand under the name, regular weight and grey (owner, 30 Jul 2026) — it identifies
                  the part against a receipt without competing with the product name.
                  ALWAYS rendered, even when the product has no brand set: every line then has the
                  same two-row shape, and an em dash (the admin's convention for unknown) makes the
                  gap visible so the product record gets fixed. Hiding it would make an incomplete
                  product look like a deliberate blank. */}
              <span style={{ display: "block", fontWeight: 400, color: grey }}>
                {l.brand ?? "—"}
              </span>
            </span>
            <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              ×{l.quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
