"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchShopInfo, saveShopInfo, uploadShopImage, imageUrl, type ShopInfo } from "@/lib/api";
import {
  defaultPaymentMethod,
  parsePaymentMethods,
  serializePaymentMethods,
  type PaymentMethod,
  type ShopProfile,
} from "@l-shopee/core";
import { BusinessTabs } from "../../BusinessTabs";
import { FilePickButton } from "../../FilePickButton";
import { inputL } from "@/lib/inputStyles";
import { SHOP_DEFAULTS } from "@/lib/shopDefaults";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";
import { useT } from "../../LangProvider";
import type { Phrase } from "@/lib/lang";

/** Trash outline icon (lucide-style), matching the services page's row-delete icon. */
const TrashIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

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

/* Edit mode and view mode mirror each other one-to-one, so every heading and field name below is
   written ONCE and read by both. A section that said one thing in the form and another in the
   view would be the easiest possible drift. */
const SHOP_INFO: Phrase = { th: "ข้อมูลร้าน", en: "Shop info" };
const SECTION: Record<string, Phrase> = {
  branding: { th: "แบรนด์", en: "Branding" },
  identity: { th: "ชื่อและที่อยู่ร้าน", en: "Shop identity" },
  lineContact: { th: "ช่องทาง LINE", en: "LINE contact" },
  quoteNote: { th: "หมายเหตุใบเสนอราคา", en: "Quotation note" },
  qrCaption: { th: "ข้อความใต้ QR ติดต่อ", en: "Contact QR caption" },
  payment: { th: "รับเงิน — บัญชีพร้อมเพย์", en: "Payment — PromptPay accounts" },
};
const LABEL: Record<string, Phrase> = {
  logo: { th: "โลโก้", en: "Logo" },
  contactQr: { th: "รูป QR ติดต่อ", en: "Contact QR image" },
  shopName: { th: "ชื่อร้าน", en: "Shop name" },
  address: { th: "ที่อยู่", en: "Address" },
  qrCode: { th: "QR code", en: "QR code" },
  lineUrl: { th: "ลิงก์ LINE OA", en: "LINE OA link" },
  headline: { th: "หัวข้อ", en: "Headline" },
  subtitle: { th: "ข้อความรอง", en: "Subtitle" },
};
const HINT: Record<string, Phrase> = {
  logo: {
    th: "PNG/JPG/WebP ไม่เกิน 5MB บันทึกทันที (ยังไม่ขึ้นบนบิล)",
    en: "PNG/JPG/WebP, ≤5MB. Saved immediately. (Not on the bill yet.)",
  },
  contactQr: {
    th: "PNG/JPG/WebP ไม่เกิน 5MB บันทึกทันที พิมพ์ลงบนใบเสนอราคา",
    en: "PNG/JPG/WebP, ≤5MB. Saved immediately. Prints on the quotation.",
  },
  lineQr: {
    th: "PNG/JPG/WebP ไม่เกิน 5MB บันทึกทันที เป็น QR ของ LINE OA ที่ลูกค้าสแกน",
    en: "PNG/JPG/WebP, ≤5MB. Saved immediately. The LINE OA QR customers scan.",
  },
};
const DEFAULT_LABEL: Phrase = { th: "ค่าเริ่มต้น", en: "Default" };
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
  "lineUrl",
  "shipFromPhone",
  "shipFromPostcode",
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
  const t = useT();
  const usingDefault = !th && !!thDefault;
  return (
    <div style={{ marginBottom: 18 }}>
      {!hideLabel && <div style={editLabel}>{label}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          {/* Each half names its own language IN that language, exactly as the app's language
              toggle does — the words below them are the shop's own Thai and English text. */}
          <div style={subLabel}>
            ไทย (Thai)
            {usingDefault ? ` · ${t({ th: "ค่าเริ่มต้น", en: "default" })}` : ""}
          </div>
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
  const t = useT();
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
          <img src={imageUrl(imgKey)} alt={label} style={{ maxWidth: "100%", maxHeight: "100%" }} />
        ) : (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {t({ th: "ไม่มี", en: "none" })}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ShopInfoPage() {
  const t = useT();
  const toast = useToast();
  const [profile, setProfile] = useState<ShopProfile>("denair");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [info, setInfo] = useState<ShopInfo | null>(null);
  const [saved, setSaved] = useState<ShopInfo | null>(null); // last server state (for Cancel)
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  // In-progress payment-method rows. Kept separately from info.paymentMethods because the tolerant
  // parser DROPS incomplete rows — a freshly-added blank row must survive re-renders while typing.
  const [payDraft, setPayDraft] = useState<PaymentMethod[] | null>(null);

  const load = useCallback((p: ShopProfile) => {
    setLoadError(null);
    setInfo(null);
    setSaved(null);
    fetchShopInfo(p)
      .then((s) => {
        setInfo(s);
        setSaved(s);
      })
      // Record the failure as well as toasting it. Previously a failed load only fired a toast
      // that then vanished, leaving the page on "Loading…" forever with nothing to act on.
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  useEffect(() => {
    load(profile);
  }, [load, profile]);

  if (loadError) {
    return (
      <main>
        <h1>{t(SHOP_INFO)}</h1>
        <p role="alert" style={{ color: "var(--danger)" }}>
          {t({ th: "โหลดข้อมูลร้านไม่สำเร็จ", en: "Could not load the shop info" })} — {loadError}
        </p>
        <button type="button" className="btn-primary btn-sm" onClick={() => load(profile)}>
          {t({ th: "ลองอีกครั้ง", en: "Try again" })}
        </button>
      </main>
    );
  }

  if (!info || !saved) {
    return (
      <main>
        <h1>{t(SHOP_INFO)}</h1>
        <p className="muted">{t({ th: "กำลังโหลด…", en: "Loading…" })}</p>
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
      await saveShopInfo(profile, text);
      // Merge only the text fields, functionally — so a logo/QR uploaded while this PUT was in
      // flight (its own functional setState) isn't clobbered by a stale full snapshot.
      setInfo((s) => (s ? { ...s, ...text } : s));
      setSaved((s) => (s ? { ...s, ...text } : s));
      setEditing(false);
      setPayDraft(null);
      toast(t({ th: "บันทึกข้อมูลร้านแล้ว", en: "Shop info saved" }), "success");
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
      const out = await uploadShopImage(profile, slot, file);
      const patch: Partial<ShopInfo> = slot === "logo" ? { logoKey: out.key } : { qrKey: out.key };
      setInfo((s) => (s ? { ...s, ...patch } : s));
      setSaved((s) => (s ? { ...s, ...patch } : s)); // already persisted server-side
      const what = slot === "logo" ? t(LABEL.logo) : "QR";
      toast(t({ th: `อัปโหลด${what}แล้ว`, en: `${what} uploaded` }), "success");
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
            <img
              src={imageUrl(imgKey)}
              alt={label}
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {t({ th: "ไม่มี", en: "none" })}
            </span>
          )}
        </div>
        <div>
          {/* The one file picker in the app (owner's brief, 2026-08-04). This one uploads on pick
              rather than holding the file, so it never shows a filename — hence file={null}. */}
          <FilePickButton
            file={null}
            accept="image/png,image/jpeg,image/webp"
            label={t({ th: `อัปโหลด${label}`, en: `Upload ${label}` })}
            onPick={(f) => upload(slot, f ?? undefined)}
          />
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</div>
        </div>
      </div>
    </div>
  );

  // AirPlus is an online storefront: its Shop info drops the on-site quotation note + QR caption and
  // instead groups the LINE OA link with its QR under a "LINE contact" section. Den Air keeps the
  // full on-site layout. Hidden fields keep their stored values — this only changes what's shown.
  const isAirplus = profile === "airplus";

  return (
    <main>
      <PageHeader
        title={t(SHOP_INFO)}
        subtitle={t({
          th: "Den Air Service กับ AirPlus เป็นคนละธุรกิจกัน แต่ละร้านมีชื่อ ที่อยู่ โลโก้ บัญชี LINE และพร้อมเพย์ของตัวเอง เลือกโปรไฟล์ด้านล่าง ไม่มีอะไรใช้ร่วมกัน",
          en: "Den Air Service and AirPlus are separate businesses — each keeps its own name, address, logo, LINE account and PromptPay. Pick a profile below; nothing is shared between them.",
        })}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "none" }}>
            {editing ? (
              <>
                <button type="button" onClick={cancel} disabled={busy}>
                  {t({ th: "ยกเลิก", en: "Cancel" })}
                </button>
                <button type="button" className="btn-primary" onClick={save} disabled={busy}>
                  {t({ th: "บันทึก", en: "Save" })}
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                {t({ th: "แก้ไข", en: "Edit" })}
              </button>
            )}
          </div>
        }
      />

      {/* Profile tabs. Switching refetches — the two profiles share no state, so a half-typed edit
          on one can never be saved onto the other. */}
      <BusinessTabs
        value={profile}
        onChange={setProfile}
        disabled={editing || busy}
        disabledTitle={t({ th: "บันทึกหรือยกเลิกก่อน", en: "Save or cancel first" })}
        dimInactive={editing}
      />

      <div style={{ ...cardStyle, marginTop: 14 }}>
        {editing ? (
          <>
            {/* Branding (Logo + QR) — first, so the visual identity leads the form. */}
            <div style={sectionWrap}>
              <div style={sectionHead}>{t(SECTION.branding)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {editImage(t(LABEL.logo), "logo", info.logoKey, t(HINT.logo))}
                {!isAirplus && editImage(t(LABEL.contactQr), "qr", info.qrKey, t(HINT.contactQr))}
              </div>
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>{t(SECTION.identity)}</div>
              {editPair(t(LABEL.shopName), "name", "nameEn", {
                thPlaceholder: "เช่น เด่นแอร์ เซอร์วิส (สุรินทร์)",
                enPlaceholder: "e.g. Den Air Service (Surin)",
              })}
              {editPair(t(LABEL.address), "address", "addressEn", {
                multiline: true,
                thPlaceholder: "123 ถนนหลักเมือง อ.เมือง จ.สุรินทร์ 32000",
                enPlaceholder: "123 Lak Mueang Rd, Mueang, Surin 32000",
              })}
            </div>

            {isAirplus ? (
              <div style={sectionWrap}>
                <div style={sectionHead}>{t(SECTION.lineContact)}</div>
                <div style={{ marginBottom: 18 }}>
                  <div style={editLabel}>{t(LABEL.lineUrl)}</div>
                  <input
                    value={info.lineUrl ?? ""}
                    onChange={(e) => set({ lineUrl: e.target.value })}
                    placeholder={t({
                      th: "เช่น https://lin.ee/xxxxxxx",
                      en: "e.g. https://lin.ee/xxxxxxx",
                    })}
                    style={inputL}
                  />
                </div>
                {editImage(t(LABEL.qrCode), "qr", info.qrKey, t(HINT.lineQr))}
              </div>
            ) : (
              <>
                <div style={sectionWrap}>
                  <div style={sectionHead}>{t(SECTION.quoteNote)}</div>
                  {editPair(t(SECTION.quoteNote), "quoteNote", "quoteNoteEn", {
                    multiline: true,
                    hideLabel: true,
                    thPlaceholder: SHOP_DEFAULTS.quoteNote,
                    enPlaceholder: "* Estimate only; final price may change on inspection",
                  })}
                </div>

                <div style={sectionWrap}>
                  <div style={sectionHead}>{t(SECTION.qrCaption)}</div>
                  {editPair(t(LABEL.headline), "qrHeadline", "qrHeadlineEn", {
                    thPlaceholder: SHOP_DEFAULTS.qrHeadline,
                    enPlaceholder: "e.g. Contact the shop",
                  })}
                  {editPair(t(LABEL.subtitle), "qrSubtitle", "qrSubtitleEn", {
                    thPlaceholder: SHOP_DEFAULTS.qrSubtitle,
                    enPlaceholder: "e.g. Scan to chat / book a slot",
                  })}
                </div>
              </>
            )}

            <div>
              <div style={sectionHead}>{t(SECTION.payment)}</div>
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
                          value={pm.position}
                          onChange={(e) =>
                            write(
                              methods.map((x) =>
                                x.id === pm.id ? { ...x, position: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder={t({ th: "ตำแหน่ง", en: "Position" })}
                          aria-label={t({ th: "ตำแหน่ง", en: "Position" })}
                          style={{ ...inputL, flex: "0 0 120px", minWidth: 0 }}
                        />
                        <input
                          value={pm.label}
                          onChange={(e) =>
                            write(
                              methods.map((x) =>
                                x.id === pm.id ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                          placeholder={t({ th: "ชื่อบัญชี", en: "Account name" })}
                          aria-label={t({ th: "ชื่อบัญชี", en: "Account name" })}
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
                          placeholder={t({ th: "พร้อมเพย์", en: "PromptPay" })}
                          aria-label={t({ th: "พร้อมเพย์ไอดี", en: "PromptPay ID" })}
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
                              aria-label={`${t(DEFAULT_LABEL)}: ${pm.label}`}
                              onChange={(e) => {
                                // Exactly one default: switching ON moves it here; switching the
                                // current default OFF is a no-op (another row's switch moves it).
                                if (!e.target.checked) return;
                                write(methods.map((x) => ({ ...x, isDefault: x.id === pm.id })));
                              }}
                            />
                            <span className="slider" />
                          </span>
                          {t(DEFAULT_LABEL)}
                        </label>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t({ th: `ลบ ${pm.label}`, en: `Remove ${pm.label}` })}
                          onClick={() => write(methods.filter((x) => x.id !== pm.id))}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-soft btn-sm"
                      onClick={() =>
                        write([
                          ...methods,
                          { id: crypto.randomUUID(), position: "", label: "", promptpayId: "" },
                        ])
                      }
                    >
                      ➕ {t({ th: "เพิ่มบัญชี", en: "Add account" })}
                    </button>
                    <div style={{ ...subLabel, marginTop: 8 }}>
                      {t({
                        th: "บัญชีที่จะให้เลือกในหน้ารับเงิน ค่าเริ่มต้นจะถูกเลือกไว้ให้ แต่ละแถวต้องมีทั้งชื่อบัญชีและพร้อมเพย์ไอดีจึงจะบันทึกได้",
                        en: "Accounts offered on the Payment page; the default is preselected. A row needs both a name and a PromptPay ID to be saved.",
                      })}
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
              <div style={sectionHead}>{t(SECTION.branding)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ViewImage label={t(LABEL.logo)} imgKey={info.logoKey} />
                {!isAirplus && <ViewImage label={t(LABEL.contactQr)} imgKey={info.qrKey} />}
              </div>
            </div>

            <div style={sectionWrap}>
              <div style={sectionHead}>{t(SECTION.identity)}</div>
              <ViewPair label={t(LABEL.shopName)} th={info.name} en={info.nameEn} />
              <ViewPair label={t(LABEL.address)} th={info.address} en={info.addressEn} />
            </div>

            {isAirplus ? (
              <div style={sectionWrap}>
                <div style={sectionHead}>{t(SECTION.lineContact)}</div>
                <div style={{ marginBottom: 18 }}>
                  <div style={editLabel}>{t(LABEL.lineUrl)}</div>
                  {info.lineUrl ? (
                    <a
                      href={info.lineUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 15, lineHeight: 1.5, wordBreak: "break-all" }}
                    >
                      {info.lineUrl}
                    </a>
                  ) : (
                    <div style={valueMuted}>—</div>
                  )}
                </div>
                <ViewImage label={t(LABEL.qrCode)} imgKey={info.qrKey} />
              </div>
            ) : (
              <>
                <div style={sectionWrap}>
                  <div style={sectionHead}>{t(SECTION.quoteNote)}</div>
                  <ViewPair
                    hideLabel
                    th={info.quoteNote}
                    en={info.quoteNoteEn}
                    thDefault={SHOP_DEFAULTS.quoteNote}
                  />
                </div>

                <div style={sectionWrap}>
                  <div style={sectionHead}>{t(SECTION.qrCaption)}</div>
                  <ViewPair
                    label={t(LABEL.headline)}
                    th={info.qrHeadline}
                    en={info.qrHeadlineEn}
                    thDefault={SHOP_DEFAULTS.qrHeadline}
                  />
                  <ViewPair
                    label={t(LABEL.subtitle)}
                    th={info.qrSubtitle}
                    en={info.qrSubtitleEn}
                    thDefault={SHOP_DEFAULTS.qrSubtitle}
                  />
                </div>
              </>
            )}

            <div>
              <div style={sectionHead}>{t(SECTION.payment)}</div>
              {(() => {
                const methods = parsePaymentMethods(info.paymentMethods);
                if (methods.length === 0) {
                  return (
                    <div style={valueMuted}>
                      {t({
                        th: "— (ยังไม่มีบัญชี หน้ารับเงินจะว่าง)",
                        en: "— (no accounts; the Payment page is empty)",
                      })}
                    </div>
                  );
                }
                return methods.map((pm) => (
                  <div
                    key={pm.id}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}
                  >
                    {pm.position && <span className="pill soft">{pm.position}</span>}
                    <span style={valueStyle}>{pm.label}</span>
                    <span className="muted">·</span>
                    <span style={valueStyle}>{pm.promptpayId}</span>
                    {pm.isDefault && <span className="pill good">{t(DEFAULT_LABEL)}</span>}
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
