"use client";

import { useEffect, useState } from "react";
import { fetchShopInfo, saveShopInfo, uploadShopImage, imageUrl, type ShopInfo } from "@/lib/api";
import { inputL } from "@/lib/inputStyles";
import { SHOP_DEFAULTS } from "@/lib/shopDefaults";
import { useToast } from "../../ToastProvider";

const labelStyle = { fontSize: 13, fontWeight: 600, marginBottom: 6 } as const;
const subLabel = { fontSize: 11, color: "var(--text-muted)", marginBottom: 3 } as const;
const taStyle = { width: "100%", fontFamily: "inherit" } as const;
const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
};

// Text fields written by Save (logo/QR are uploaded separately).
const TEXT_KEYS = [
  "name",
  "nameEn",
  "address",
  "addressEn",
  "quoteNote",
  "quoteNoteEn",
  "qrHeadline",
  "qrHeadlineEn",
  "qrSubtitle",
  "qrSubtitleEn",
] as const;

export default function ShopInfoPage() {
  const toast = useToast();
  const [info, setInfo] = useState<ShopInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShopInfo()
      .then(setInfo)
      .catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!info) {
    return (
      <main>
        <h1>Shop info</h1>
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const set = (patch: Partial<ShopInfo>) => setInfo((s) => (s ? { ...s, ...patch } : s));

  async function save() {
    if (!info) return;
    setBusy(true);
    try {
      const text = Object.fromEntries(
        TEXT_KEYS.map((k) => [k, (info[k] as string).trim()]),
      ) as Record<(typeof TEXT_KEYS)[number], string>;
      await saveShopInfo(text);
      toast("Shop info saved", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function upload(slot: "logo" | "qr", file: File | undefined) {
    if (!file) return;
    try {
      const out = await uploadShopImage(slot, file);
      set(slot === "logo" ? { logoKey: out.key } : { qrKey: out.key });
      toast(`${slot === "logo" ? "Logo" : "QR"} uploaded`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  // A bilingual (Thai + English) input pair. Returns inline JSX — not a component — so the inputs
  // keep focus across re-renders.
  const pair = (
    label: string,
    thKey: keyof ShopInfo,
    enKey: keyof ShopInfo,
    opts?: { multiline?: boolean; thPlaceholder?: string; enPlaceholder?: string },
  ) => {
    const field = (key: keyof ShopInfo, placeholder?: string) =>
      opts?.multiline ? (
        <textarea
          value={(info[key] as string) ?? ""}
          onChange={(e) => set({ [key]: e.target.value } as Partial<ShopInfo>)}
          rows={2}
          placeholder={placeholder}
          style={taStyle}
        />
      ) : (
        <input
          value={(info[key] as string) ?? ""}
          onChange={(e) => set({ [key]: e.target.value } as Partial<ShopInfo>)}
          placeholder={placeholder}
          style={inputL}
        />
      );
    return (
      <div>
        <div style={labelStyle}>{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={subLabel}>ไทย (Thai)</div>
            {field(thKey, opts?.thPlaceholder)}
          </div>
          <div>
            <div style={subLabel}>English</div>
            {field(enKey, opts?.enPlaceholder)}
          </div>
        </div>
      </div>
    );
  };

  const imageBox = (label: string, slot: "logo" | "qr", key: string | null, hint: string) => (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 76,
            height: 76,
            border: "1px solid var(--border)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            overflow: "hidden",
            flex: "none",
          }}
        >
          {key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl(key)} alt={label} style={{ maxWidth: "100%", maxHeight: "100%" }} />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>none</span>
          )}
        </div>
        <div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => upload(slot, e.target.files?.[0])}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>
        </div>
      </div>
    </div>
  );

  return (
    <main>
      <h1>Shop info</h1>
      <p className="muted">
        Shown on printed bills and quotations. Thai prints by default; a Thai/English switch on the
        POS picks which language to print. Barcode labels use the Thai shop name.
      </p>

      <div style={cardStyle}>
        {pair("Shop name", "name", "nameEn", {
          thPlaceholder: "เช่น เด่นแอร์ เซอร์วิส (สุรินทร์)",
          enPlaceholder: "e.g. Den Air Service (Surin)",
        })}
        {pair("Address", "address", "addressEn", {
          multiline: true,
          thPlaceholder: "123 ถนนหลักเมือง อ.เมือง จ.สุรินทร์ 32000",
          enPlaceholder: "123 Lak Mueang Rd, Mueang, Surin 32000",
        })}
        {pair("Quotation note", "quoteNote", "quoteNoteEn", {
          multiline: true,
          thPlaceholder: SHOP_DEFAULTS.quoteNote,
          enPlaceholder: "* Estimate only; final price may change on inspection",
        })}

        <div style={{ borderTop: "1px solid var(--border)" }} />
        {pair("Contact-QR headline", "qrHeadline", "qrHeadlineEn", {
          thPlaceholder: SHOP_DEFAULTS.qrHeadline,
          enPlaceholder: "e.g. Contact the shop",
        })}
        {pair("Contact-QR subtitle", "qrSubtitle", "qrSubtitleEn", {
          thPlaceholder: SHOP_DEFAULTS.qrSubtitle,
          enPlaceholder: "e.g. Scan to chat / book a slot",
        })}

        <div>
          <button type="button" className="btn-primary" disabled={busy} onClick={save}>
            Save
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--border)" }} />
        {imageBox(
          "Logo",
          "logo",
          info.logoKey,
          "PNG/JPG/WebP, ≤5MB. Saved immediately. (Not on the bill yet.)",
        )}
        {imageBox(
          "Contact QR image",
          "qr",
          info.qrKey,
          "PNG/JPG/WebP, ≤5MB. Saved immediately. Prints on the quotation.",
        )}
      </div>
    </main>
  );
}
