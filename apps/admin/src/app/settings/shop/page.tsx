"use client";

import { useEffect, useState } from "react";
import { fetchShopInfo, saveShopInfo, uploadShopImage, imageUrl, type ShopInfo } from "@/lib/api";
import {
  defaultPaymentMethod,
  parsePaymentMethods,
  serializePaymentMethods,
  type PaymentMethod,
} from "@l-shopee/core";
import { inputL } from "@/lib/inputStyles";
import { SHOP_DEFAULTS } from "@/lib/shopDefaults";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";

// Shared with the product detail page's look: uppercase section heads, muted sub-labels, a card.
// Section title — the dominant text level, clearly above the field labels (14px) below it.
const sectionHead = {
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase" as const,
  color: "var(--text)",
  marginBottom: 14,
};
const subLabel = { fontSize: 12, color: "var(--text-muted)", marginBottom: 4 } as const;
const editLabel = { fontSize: 14, fontWeight: 600, marginBottom: 7 } as const;
// Titled groups (Branding / Shop identity / …) are separated by a hairline divider, centered in
// the 28px gap (14 above + 14 below) so the divider adds the line without changing overall spacing.
// The last section uses a plain <div> (no wrapper), so it correctly has no trailing divider.
const sectionWrap = {
  paddingBottom: 14,
  marginBottom: 14,
  borderBottom: "1px solid var(--border)",
} as const;
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
  "paymentMethods",
] as const;

/** View-mode bilingual block — mirrors editPair's layout exactly (field label, then the Thai value
 * beside the English one) so the page doesn't shift when toggling Edit. When the Thai value is blank
 * but a default exists, show the default (muted, marked) — that's what actually prints on the bill. */
function ViewPair({
  label,
  th,
  en,
  thDefault,
  hideLabel,
}: {
  label?: string;
  th: string;
  en: string;
  thDefault?: string;
  hideLabel?: boolean;
}) {
  const usingDefault = !th && !!thDefault;
  return (
    <div style={{ marginBottom: 18 }}>
      {!hideLabel && <div style={editLabel}>{label}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <div style={subLabel}>ไทย (Thai){usingDefault ? " · default" : ""}</div>
          <div style={usingDefault ? valueMuted : valueStyle}>{th || thDefault || "—"}</div>
        </div>
        <div>
          <div style={subLabel}>English</div>
          <div style={en ? valueStyle : valueMuted}>{en || "—"}</div>
        </div>
      </div>
    </div>
  );
}

/** View-mode image preview (logo / contact QR), or a muted "none" when unset. Mirrors editImage's
 * label + 76px frame so the Branding row matches edit mode. */
function ViewImage({ label, imgKey }: { label: string; imgKey: string | null }) {
  return (
    <div>
      <div style={editLabel}>{label}</div>
      <div
        style={{
          width: 76,
          height: 76,
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
  // In-progress payment-method rows. Kept separately from info.paymentMethods because the tolerant
  // parser DROPS incomplete rows — a freshly-added blank row must survive re-renders while typing.
  const [payDraft, setPayDraft] = useState<PaymentMethod[] | null>(null);

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
      // Merge only the text fields, functionally — so a logo/QR uploaded while this PUT was in
      // flight (its own functional setState) isn't clobbered by a stale full snapshot.
      setInfo((s) => (s ? { ...s, ...text } : s));
      setSaved((s) => (s ? { ...s, ...text } : s));
      setEditing(false);
      setPayDraft(null);
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
    setPayDraft(null);
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
    opts?: {
      multiline?: boolean;
      thPlaceholder?: string;
      enPlaceholder?: string;
      hideLabel?: boolean;
    },
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
      <div style={{ marginBottom: 18 }}>
        {!opts?.hideLabel && <div style={editLabel}>{label}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
    <div>
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
      <PageHeader
        title="Shop info"
        subtitle="Shown on printed bills and quotations. Thai prints by default; a Thai/English switch on the POS picks which language to print. Barcode labels use the Thai shop name."
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
            {editing ? (
              <>
                <button type="button" onClick={cancel} disabled={busy}>
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
        }
      />

      <div style={{ ...cardStyle, marginTop: 14 }}>
        {editing ? (
          <>
            {/* Branding (Logo + QR) — first, so the visual identity leads the form. */}
            <div style={sectionWrap}>
              <div style={sectionHead}>Branding</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
              </div>
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>Shop identity</div>
              {editPair("Shop name", "name", "nameEn", {
                thPlaceholder: "เช่น เด่นแอร์ เซอร์วิส (สุรินทร์)",
                enPlaceholder: "e.g. Den Air Service (Surin)",
              })}
              {editPair("Address", "address", "addressEn", {
                multiline: true,
                thPlaceholder: "123 ถนนหลักเมือง อ.เมือง จ.สุรินทร์ 32000",
                enPlaceholder: "123 Lak Mueang Rd, Mueang, Surin 32000",
              })}
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>Quotation note</div>
              {editPair("Quotation note", "quoteNote", "quoteNoteEn", {
                multiline: true,
                hideLabel: true,
                thPlaceholder: SHOP_DEFAULTS.quoteNote,
                enPlaceholder: "* Estimate only; final price may change on inspection",
              })}
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>Contact QR caption</div>
              {editPair("Headline", "qrHeadline", "qrHeadlineEn", {
                thPlaceholder: SHOP_DEFAULTS.qrHeadline,
                enPlaceholder: "e.g. Contact the shop",
              })}
              {editPair("Subtitle", "qrSubtitle", "qrSubtitleEn", {
                thPlaceholder: SHOP_DEFAULTS.qrSubtitle,
                enPlaceholder: "e.g. Scan to chat / book a slot",
              })}
            </div>

            <div>
              <div style={sectionHead}>Payment — PromptPay accounts</div>
              {(() => {
                const methods = payDraft ?? parsePaymentMethods(info.paymentMethods);
                const write = (next: PaymentMethod[]) => {
                  setPayDraft(next);
                  set({ paymentMethods: serializePaymentMethods(next) });
                };
                // Show the switch as it will SAVE: when nothing is flagged yet, the first row is
                // the effective default (serialize normalizes to exactly one).
                const effectiveDefaultId = defaultPaymentMethod(methods)?.id;
                return (
                  <>
                    {methods.map((pm) => (
                      <div
                        key={pm.id}
                        style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}
                      >
                        <input
                          value={pm.label}
                          onChange={(e) =>
                            write(
                              methods.map((x) =>
                                x.id === pm.id ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="ชื่อบัญชี (ร้าน / แม่ / พ่อ)"
                          aria-label="Method label"
                          style={{ ...inputL, flex: 1, minWidth: 0 }}
                        />
                        <input
                          value={pm.promptpayId}
                          onChange={(e) =>
                            write(
                              methods.map((x) =>
                                x.id === pm.id ? { ...x, promptpayId: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder="เบอร์มือถือ / เลข 13 หลัก"
                          aria-label="PromptPay ID"
                          style={{ ...inputL, flex: 1, minWidth: 0 }}
                        />
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 12,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span className="switch">
                            <input
                              type="checkbox"
                              checked={pm.id === effectiveDefaultId}
                              aria-label={`Default: ${pm.label}`}
                              onChange={(e) => {
                                // Exactly one default: switching ON moves it here; switching the
                                // current default OFF is a no-op (another row's switch moves it).
                                if (!e.target.checked) return;
                                write(methods.map((x) => ({ ...x, isDefault: x.id === pm.id })));
                              }}
                            />
                            <span className="slider" />
                          </span>
                          Default
                        </label>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          aria-label={`Remove ${pm.label}`}
                          onClick={() => write(methods.filter((x) => x.id !== pm.id))}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-soft btn-sm"
                      onClick={() =>
                        write([...methods, { id: crypto.randomUUID(), label: "", promptpayId: "" }])
                      }
                    >
                      ➕ Add account
                    </button>
                    <div style={{ ...subLabel, marginTop: 8 }}>
                      Accounts offered on the Payment page; the default is preselected. A row needs
                      both a name and a PromptPay ID to be saved.
                    </div>
                  </>
                );
              })()}
            </div>
          </>
        ) : (
          <>
            {/* View mode mirrors the edit form one-to-one: same sections, same positions, values
                instead of inputs — so nothing shifts when toggling Edit. */}
            <div style={sectionWrap}>
              <div style={sectionHead}>Branding</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ViewImage label="Logo" imgKey={info.logoKey} />
                <ViewImage label="Contact QR image" imgKey={info.qrKey} />
              </div>
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>Shop identity</div>
              <ViewPair label="Shop name" th={info.name} en={info.nameEn} />
              <ViewPair label="Address" th={info.address} en={info.addressEn} />
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>Quotation note</div>
              <ViewPair
                hideLabel
                th={info.quoteNote}
                en={info.quoteNoteEn}
                thDefault={SHOP_DEFAULTS.quoteNote}
              />
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>Contact QR caption</div>
              <ViewPair
                label="Headline"
                th={info.qrHeadline}
                en={info.qrHeadlineEn}
                thDefault={SHOP_DEFAULTS.qrHeadline}
              />
              <ViewPair
                label="Subtitle"
                th={info.qrSubtitle}
                en={info.qrSubtitleEn}
                thDefault={SHOP_DEFAULTS.qrSubtitle}
              />
            </div>

            <div>
              <div style={sectionHead}>Payment — PromptPay accounts</div>
              {(() => {
                const methods = parsePaymentMethods(info.paymentMethods);
                if (methods.length === 0) {
                  return <div style={valueMuted}>— (no accounts; the Payment page is empty)</div>;
                }
                return methods.map((pm) => (
                  <div
                    key={pm.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                  >
                    <span style={valueStyle}>{pm.label}</span>
                    <span className="muted">·</span>
                    <span style={valueStyle}>{pm.promptpayId}</span>
                    {pm.isDefault && <span className="pill good">Default</span>}
                  </div>
                ));
              })()}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
