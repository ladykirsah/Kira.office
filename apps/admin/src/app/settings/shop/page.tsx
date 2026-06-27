"use client";

import { useEffect, useState } from "react";
import { fetchShopInfo, saveShopInfo, uploadShopImage, imageUrl, type ShopInfo } from "@/lib/api";
import { inputL } from "@/lib/inputStyles";
import { SHOP_DEFAULTS } from "@/lib/shopDefaults";
import { useToast } from "../../ToastProvider";

// Shared with the product detail page's look: uppercase section heads, muted sub-labels, a card.
const groupHead = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
  marginBottom: 12,
};
const subLabel = { fontSize: 11, color: "var(--text-muted)", marginBottom: 3 } as const;
const editLabel = { fontSize: 13, fontWeight: 600, marginBottom: 6 } as const;
const valueStyle = {
  fontSize: 15,
  color: "var(--text)",
  whiteSpace: "pre-wrap" as const,
  lineHeight: 1.5,
};
const valueMuted = { ...valueStyle, color: "var(--text-muted)" };
const taStyle = { width: "100%", fontFamily: "inherit" } as const;
const cardStyle = {
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "16px 18px",
  background: "var(--surface)",
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

/** View-mode bilingual block: an uppercase section head, then the Thai value over the English one.
 * When the Thai value is blank but a default exists, show the default (muted, marked) — that's what
 * actually prints on the bill. */
function ViewPair({
  label,
  th,
  en,
  thDefault,
}: {
  label: string;
  th: string;
  en: string;
  thDefault?: string;
}) {
  const usingDefault = !th && !!thDefault;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={groupHead}>{label}</div>
      <div style={{ marginBottom: 8 }}>
        <div style={subLabel}>ไทย (Thai){usingDefault ? " · default" : ""}</div>
        <div style={usingDefault ? valueMuted : valueStyle}>{th || thDefault || "—"}</div>
      </div>
      <div>
        <div style={subLabel}>English</div>
        <div style={en ? valueStyle : valueMuted}>{en || "—"}</div>
      </div>
    </div>
  );
}

/** View-mode image preview (logo / contact QR), or a muted "none" when unset. */
function ViewImage({ label, imgKey }: { label: string; imgKey: string | null }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={subLabel}>{label}</div>
      <div
        style={{
          width: 96,
          height: 96,
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {imgKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(imgKey)} alt={label} style={{ maxWidth: "100%", maxHeight: "100%" }} />
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>none</span>
        )}
      </div>
    </div>
  );
}

export default function ShopInfoPage() {
  const toast = useToast();
  const [info, setInfo] = useState<ShopInfo | null>(null);
  const [saved, setSaved] = useState<ShopInfo | null>(null); // last server state (for Cancel)
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchShopInfo()
      .then((s) => {
        setInfo(s);
        setSaved(s);
      })
      .catch((e) => toast((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!info || !saved) {
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
      const next = { ...info, ...text };
      setInfo(next);
      setSaved(next);
      setEditing(false);
      toast("Shop info saved", "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setInfo(saved); // discard unsaved text edits (uploaded images persist immediately)
    setEditing(false);
  }

  async function upload(slot: "logo" | "qr", file: File | undefined) {
    if (!file) return;
    try {
      const out = await uploadShopImage(slot, file);
      const patch: Partial<ShopInfo> = slot === "logo" ? { logoKey: out.key } : { qrKey: out.key };
      setInfo((s) => (s ? { ...s, ...patch } : s));
      setSaved((s) => (s ? { ...s, ...patch } : s)); // already persisted server-side
      toast(`${slot === "logo" ? "Logo" : "QR"} uploaded`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  // --- edit-mode field helpers (inline JSX, not components, so inputs keep focus) ---
  const editPair = (
    label: string,
    thKey: keyof ShopInfo,
    enKey: keyof ShopInfo,
    opts?: { multiline?: boolean; thPlaceholder?: string; enPlaceholder?: string },
  ) => {
    const fieldInput = (key: keyof ShopInfo, placeholder?: string) =>
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
      <div style={{ marginBottom: 16 }}>
        <div style={editLabel}>{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={subLabel}>ไทย (Thai)</div>
            {fieldInput(thKey, opts?.thPlaceholder)}
          </div>
          <div>
            <div style={subLabel}>English</div>
            {fieldInput(enKey, opts?.enPlaceholder)}
          </div>
        </div>
      </div>
    );
  };

  const editImage = (label: string, slot: "logo" | "qr", imgKey: string | null, hint: string) => (
    <div style={{ marginBottom: 16 }}>
      <div style={editLabel}>{label}</div>
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
          {imgKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl(imgKey)}
              alt={label}
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
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
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <h1 style={{ margin: 0 }}>Shop info</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
          {editing ? (
            <>
              <button type="button" onClick={cancel}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={save} disabled={busy}>
                Save
              </button>
            </>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Shown on printed bills and quotations. Thai prints by default; a Thai/English switch on the
        POS picks which language to print. Barcode labels use the Thai shop name.
      </p>

      <div style={{ ...cardStyle, marginTop: 14 }}>
        {editing ? (
          <>
            {editPair("Shop name", "name", "nameEn", {
              thPlaceholder: "เช่น เด่นแอร์ เซอร์วิส (สุรินทร์)",
              enPlaceholder: "e.g. Den Air Service (Surin)",
            })}
            {editPair("Address", "address", "addressEn", {
              multiline: true,
              thPlaceholder: "123 ถนนหลักเมือง อ.เมือง จ.สุรินทร์ 32000",
              enPlaceholder: "123 Lak Mueang Rd, Mueang, Surin 32000",
            })}
            {editPair("Quotation note", "quoteNote", "quoteNoteEn", {
              multiline: true,
              thPlaceholder: SHOP_DEFAULTS.quoteNote,
              enPlaceholder: "* Estimate only; final price may change on inspection",
            })}
            <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0 16px" }} />
            {editPair("Contact-QR headline", "qrHeadline", "qrHeadlineEn", {
              thPlaceholder: SHOP_DEFAULTS.qrHeadline,
              enPlaceholder: "e.g. Contact the shop",
            })}
            {editPair("Contact-QR subtitle", "qrSubtitle", "qrSubtitleEn", {
              thPlaceholder: SHOP_DEFAULTS.qrSubtitle,
              enPlaceholder: "e.g. Scan to chat / book a slot",
            })}
            <div style={{ borderTop: "1px solid var(--border)", margin: "2px 0 16px" }} />
            {editImage(
              "Logo",
              "logo",
              info.logoKey,
              "PNG/JPG/WebP, ≤5MB. Saved immediately. (Not on the bill yet.)",
            )}
            {editImage(
              "Contact QR image",
              "qr",
              info.qrKey,
              "PNG/JPG/WebP, ≤5MB. Saved immediately. Prints on the quotation.",
            )}
          </>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: "0 36px",
              alignItems: "start",
            }}
          >
            <div>
              <ViewPair label="Shop name" th={info.name} en={info.nameEn} />
              <ViewPair label="Address" th={info.address} en={info.addressEn} />
            </div>
            <div>
              <ViewPair
                label="Quotation note"
                th={info.quoteNote}
                en={info.quoteNoteEn}
                thDefault={SHOP_DEFAULTS.quoteNote}
              />
              <ViewPair
                label="Contact-QR headline"
                th={info.qrHeadline}
                en={info.qrHeadlineEn}
                thDefault={SHOP_DEFAULTS.qrHeadline}
              />
              <ViewPair
                label="Contact-QR subtitle"
                th={info.qrSubtitle}
                en={info.qrSubtitleEn}
                thDefault={SHOP_DEFAULTS.qrSubtitle}
              />
            </div>
            <div>
              <div style={groupHead}>Images</div>
              <ViewImage label="Logo" imgKey={info.logoKey} />
              <ViewImage label="Contact QR" imgKey={info.qrKey} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
