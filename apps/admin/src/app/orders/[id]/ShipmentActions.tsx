"use client";

import { useMemo, useRef, useState } from "react";
import { CARRIERS, DEFAULT_CARRIER, toSatang } from "@l-shopee/core";
import qrcode from "qrcode-generator";
import { saveOrderDropOff, type OrderDetail, type ShopInfo } from "@/lib/api";
import { saveLabelPdf, saveLabelPng, shippingLabelFileName } from "@/lib/labelFile";
import { formatBahtTrim } from "@/lib/format";
import { tableText } from "@/lib/tableText";
import { inputS } from "@/lib/inputStyles";
import { card, sectionTitle } from "./cardStyles";
import { DocRow, Modal } from "./docKit";
import { Icon } from "../../Icon";
import { useT } from "../../LangProvider";

/**
 * Everything that happens to a parcel on its way out the door.
 *
 * While the order is To ship this is the FIRST section on the page (owner, 30 Jul 2026): print the
 * label you carry to the counter, then come back with the receipt and type in what Flash charged.
 * Once it ships the section goes away entirely and the Shipping card carries the record instead —
 * which is why the label export also exists on its own, as `LabelActions`.
 *
 * The label carries NO shipping barcode and NO tracking number. Flash issues the tracking number at
 * the counter, so a label printed beforehand cannot have one; printing a fabricated number would put
 * a parcel into the world with an identifier that resolves to nothing. The only code is a LINE
 * support QR (shop.lineUrl) — a way to reach the shop, never a parcel identifier. It exists for the
 * label's two real jobs: a packing guide + the addresses Flash rates the parcel from.
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
  /** Already translated by OrderDetailView — see the note there. */
  /** Already translated by OrderDetailView — see the note there. */
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
  const t = useT();
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="btn-primary btn-sm"
        disabled={busyFile !== null}
        onClick={() => saveFile("pdf")}
      >
        {busyFile === "pdf"
          ? t({ th: "กำลังบันทึก…", en: "Saving…" })
          : t({ th: "บันทึกใบปะหน้า PDF", en: "Save label PDF" })}
      </button>
      <button
        type="button"
        className="btn-soft btn-sm"
        disabled={busyFile !== null}
        onClick={() => saveFile("png")}
      >
        {busyFile === "png"
          ? t({ th: "กำลังบันทึก…", en: "Saving…" })
          : t({ th: "บันทึกใบปะหน้า PNG", en: "Save label PNG" })}
      </button>
    </div>
  );
}

/** The full-width section at the top of the page, while the order is waiting to go out. */
export function ShipmentSection({ order, address, lines, shop, status, onError }: SectionProps) {
  const t = useT();
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
          <div style={{ ...sectionTitle, marginBottom: 6 }}>
            {t({ th: "การจัดส่ง", en: "Shipment" })}
          </div>
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
        {/* OFF-SCREEN ON A PHONE, not hidden (owner: hide it there, 27 Aug 2026). The label is a
            fixed 378px so it never fitted a 375px screen anyway — it sat in a sideways scroller
            nobody scrolls, under the two buttons that already save it.

            `display: none` would have broken those buttons: `saveFile` rasterises THIS node with
            html2canvas, and a hidden node has no layout to rasterise. So the phone rule moves it
            out of view while leaving it laid out — the same trick the Documents card's own copy
            uses a few lines below, and for the same reason. */}
        <div className="phone-offscreen" style={card}>
          <div style={sectionTitle}>{t({ th: "ใบปะหน้าพัสดุ", en: "Shipping label" })}</div>
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
 * The shipping-label row for the Documents section: View (preview in a modal) + Save (PDF). The label
 * is generated, not stored, so it is always available. An off-screen copy is always mounted so Save
 * captures a laid-out node whether or not the preview is open (html2canvas can't rasterise a hidden
 * one). Lives here, beside the label internals, rather than in the Documents card.
 */
export function ShippingLabelDoc({
  label,
  first,
  order,
  address,
  lines,
  shop,
  onError,
}: ShipmentProps & { label: string; first?: boolean }) {
  const t = useT();
  const { labelRef, busyFile, saveFile } = useLabelExport(order.externalOrderId, onError);
  const [open, setOpen] = useState(false);

  return (
    <>
      <DocRow
        label={label}
        first={first}
        actions={
          <>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(true)}
              aria-label={t({ th: "ดู", en: "View" })}
              title={t({ th: "ดู", en: "View" })}
            >
              <Icon name="view" />
            </button>
            <button
              type="button"
              className="icon-btn"
              disabled={busyFile !== null}
              onClick={() => saveFile("png")}
              aria-label={t({ th: "บันทึก PNG", en: "Save PNG" })}
              title={
                busyFile === "png"
                  ? t({ th: "กำลังบันทึก…", en: "Saving…" })
                  : t({ th: "บันทึก PNG", en: "Save PNG" })
              }
            >
              <Icon name="save" />
            </button>
          </>
        }
      />
      <div style={{ position: "absolute", left: -99999, top: 0 }} aria-hidden="true">
        <ShippingLabel ref={labelRef} order={order} address={address} lines={lines} shop={shop} />
      </div>
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <div style={{ overflowX: "auto" }}>
            <ShippingLabel order={order} address={address} lines={lines} shop={shop} />
          </div>
        </Modal>
      )}
    </>
  );
}

function DropOffCard({
  order,
  onError,
}: {
  order: OrderDetail["order"];
  onError: (message: string) => void;
}) {
  const t = useT();
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
      <div style={sectionTitle}>{t({ th: "บันทึกการส่งของ", en: "Record drop-off" })}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <label style={field}>
          <span style={tableText.subtitle}>{t({ th: "ขนส่ง", en: "Carrier" })}</span>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} style={inputS}>
            {CARRIERS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={field}>
          <span style={tableText.subtitle}>{t({ th: "เลขพัสดุ", en: "Tracking number" })}</span>
          <input
            value={trackingNo}
            onChange={(e) => setTrackingNo(e.target.value)}
            placeholder="TH…"
            style={inputS}
          />
        </label>
        <label style={field}>
          <span style={tableText.subtitle}>{t({ th: "ค่าส่งจริง ฿", en: "Real charge ฿" })}</span>
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
          {saving
            ? t({ th: "กำลังบันทึก…", en: "Saving…" })
            : t({ th: "บันทึกการส่งของ", en: "Save drop-off" })}
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
        <span style={{ ...sectionTitle, marginBottom: 0, whiteSpace: "nowrap" }}>
          {t({ th: "เมื่อบันทึก", en: "On save" })}
        </span>
        <span style={tableText.subtitle}>
          {t({
            th: "ออเดอร์จะเปลี่ยนเป็น กำลังจัดส่ง และไทม์ไลน์จะได้หนึ่งรายการ “จัดส่งแล้ว”",
            en: "Order moves to In transit, and the timeline gets one “จัดส่งแล้ว” entry",
          })}{" "}
          <strong>{t({ th: "ร้านออกค่าส่งให้", en: "On us" })}</strong>{" "}
          {t({ th: "และ", en: "and" })} <strong>{t({ th: "กำไร", en: "Profit" })}</strong>{" "}
          {t({ th: "จะคำนวณใหม่ และลิงก์ติดตามพัสดุ", en: "recalculate, and the tracking link" })}
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
  /** Only the copy that gets captured needs a ref; the preview instance renders without one. */
  ref?: React.Ref<HTMLDivElement>;
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

  // COD footer shows only when the parcel is collected on delivery; the amount is what the customer pays.
  const isCod = order.paymentStatus === "cod" || order.paymentStatus === "cod_confirmed";
  const lineUrl = shop.lineUrl?.trim();
  // A real, scannable LINE QR from the shop's LINE url (falls back to the site). High error correction
  // so the small centre "LINE" badge doesn't break the scan. Data-URI so html2canvas can rasterise it.
  const qrDataUrl = useMemo(() => {
    const qr = qrcode(0, "H");
    qr.addData(lineUrl || "https://airplusauto.com");
    qr.make();
    return qr.createDataURL(3);
  }, [lineUrl]);

  // Literal colours, not tokens: this node is rasterised to a file printed on white paper, so it must
  // not follow the operator's dark mode into an unreadable label.
  const ink = "#141414";
  const strong = "#000000";
  const soft = "#8a8a8a";
  const rule = "#d3d3d3";
  const roleK = { flex: "none", width: 24, fontSize: 11, color: soft } as const;

  return (
    <div
      ref={ref}
      style={{
        width: 378,
        boxSizing: "border-box",
        background: "#ffffff",
        color: ink,
        border: "1px solid #dcdcdc",
        borderRadius: 10,
        padding: "18px 20px 14px",
        fontFamily: '-apple-system, "Helvetica Neue", "Thonburi", sans-serif',
      }}
    >
      {/* header: Air+Plus wordmark + order code, on one aligned row */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            fontStyle: "italic",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: strong,
          }}
        >
          Air+Plus
        </div>
        <div style={{ textAlign: "right", lineHeight: 1.15 }}>
          <div style={{ fontSize: 10, color: soft }}>รหัสคำสั่งซื้อ</div>
          <div style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
            {order.externalOrderId}
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: `1px solid ${rule}`, margin: "8px 0" }} />

      {/* from — the sender block Flash rates the parcel from */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={roleK}>จาก</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
            {shop.name || "AirPlus Auto"}
            {shop.shipFromPhone ? ` • ${shop.shipFromPhone}` : ""}
          </div>
          <div style={{ fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
            {shop.address}
            {shop.shipFromPostcode ? ` ${shop.shipFromPostcode}` : ""}
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: "1px dotted #c9c9c9", margin: "8px 0" }} />

      {/* to */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={roleK}>ถึง</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>
            {address?.recipientName ?? "—"}
            {address?.phone ? ` • ${address.phone}` : ""}
          </div>
          <div style={{ fontSize: 12, marginTop: 3, lineHeight: 1.3 }}>
            {to || "No address on this order"}
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: `1px solid ${rule}`, margin: "8px 0" }} />

      {/* thank-you + LINE support QR */}
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontStyle: "italic", fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>
            {shop.qrHeadline || "ขอบคุณที่อุดหนุนสินค้าของเรา"}
          </div>
          <div style={{ fontSize: 14, marginTop: 3, lineHeight: 1.25 }}>
            {shop.qrSubtitle || "สแกนเพื่อปรึกษาช่าง หรือ สั่งอะไหล่เพิ่มเติม"}
          </div>
          <div style={{ fontSize: 11, color: soft, marginTop: 3 }}>airplusauto.com</div>
        </div>
        <div style={{ position: "relative", flex: "none" }}>
          {/* A data-URI QR (not a remote asset), rasterised by html2canvas — a plain img, not next/image. */}
          <img src={qrDataUrl} alt="LINE QR" width={58} height={58} style={{ display: "block" }} />
          {lineUrl ? (
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                background: "#ffffff",
                color: "#000000",
                fontWeight: 800,
                fontSize: 8,
                padding: "1px 3px",
                borderRadius: 2,
              }}
            >
              LINE
            </span>
          ) : null}
        </div>
      </div>

      {/* cut line — carrier label above, kept slip below */}
      <div
        style={{ position: "relative", borderTop: "1.5px dashed #c6c6c6", margin: "10px 0 8px" }}
      >
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 0,
            background: "#ffffff",
            paddingRight: 6,
            color: "#bcbcbc",
            fontSize: 13,
          }}
        >
          ✂
        </span>
      </div>

      {/* order list — the packing guide */}
      <div>
        <div style={{ color: soft, fontSize: 11, marginBottom: 6 }}>รายการสั่งซื้อ</div>
        {lines.map((l) => (
          <div
            key={l.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 96px 30px",
              alignItems: "baseline",
              columnGap: 10,
              padding: "3px 0",
              fontSize: 11,
            }}
          >
            <span>{l.name ?? l.sku ?? l.variantId}</span>
            {/* Brand in its own column (owner, 31 Jul 2026): identifies the part against a receipt.
                Always rendered — an em dash for a product with no brand set makes the gap visible so
                the record gets fixed, rather than reading as a deliberate blank. */}
            <span>{l.brand ?? "—"}</span>
            <span
              style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
            >
              x{l.quantity}
            </span>
          </div>
        ))}
      </div>

      {/* COD footer — only when the parcel is collected on delivery */}
      {isCod ? (
        <>
          <hr style={{ border: 0, borderTop: `1px solid ${rule}`, margin: "8px 0" }} />
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span style={{ fontStyle: "italic", fontWeight: 800, fontSize: 15 }}>
              เก็บเงินปลายทาง {formatBahtTrim(order.grandTotalSatang)}
            </span>
            <span style={{ fontSize: 10, color: soft, whiteSpace: "nowrap" }}>
              แปะส่วนนี้ที่กล่อง
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
