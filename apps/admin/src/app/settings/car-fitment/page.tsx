"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { inputS } from "@/lib/inputStyles";
import { toSquareCover } from "@/lib/cropImage";
import {
  fetchCarFitment,
  addCarBrand,
  addCarModel,
  deleteCarBrand,
  deleteCarModel,
  setAttributeNames,
  uploadTaxonomyImage,
  type CarBrandTree,
  type CarModelNode,
} from "@/lib/api";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";
import { CoverPicker, NameCard } from "../AttributeManager";
import { ConfirmButton } from "../../ConfirmButton";
import { useT } from "../../LangProvider";
import type { Phrase } from "@/lib/lang";
import { ModelInfoEditor } from "./ModelInfoEditor";
import { ModelInfoView } from "./ModelInfoView";

/* Written once — the segmented selector, the add-form labels and the panel headings share them. */
const SAVE: Phrase = { th: "บันทึก", en: "Save" };
const SAVING: Phrase = { th: "กำลังบันทึก…", en: "Saving…" };
const CAR_BRAND: Phrase = { th: "ยี่ห้อรถ", en: "Car brand" };
const CAR_BRANDS: Phrase = { th: "ยี่ห้อรถ", en: "Car brands" };
const CAR_MODELS: Phrase = { th: "รุ่นรถ", en: "Car models" };
const ENGLISH_NAME: Phrase = { th: "ชื่อภาษาอังกฤษ", en: "English name" };
const THAI_NAME: Phrase = { th: "ชื่อภาษาไทย", en: "Thai name" };
const YEAR_FROM: Phrase = { th: "ปีเริ่ม", en: "Year from" };
const YEAR_TO: Phrase = { th: "ปีสิ้นสุด", en: "Year to" };

const cardS: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
};
const addFieldLabel: CSSProperties = { fontSize: 12, color: "var(--text-muted)", marginBottom: 4 };

/** Format a model's era (year range) for the row, e.g. "2007 – 2013" / "2013+". */
function eraStr(from: number | null, to: number | null): string {
  if (from && to) return `${from} – ${to}`;
  if (from) return `${from}+`;
  if (to) return `– ${to}`;
  return "";
}

const yearOrNull = (s: string): number | null => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

/** True when a model has any service notes worth flagging (era is identity, not a note). */
function modelHasInfo(m: CarModelNode): boolean {
  return Boolean(
    m.generationCode || m.refrigerant || m.oringUsage?.length || m.coolantLiters || m.notes,
  );
}

/**
 * The one place to add a car brand or model — a POS-style segmented selector picks which, then the
 * form collects English/Thai (+ a cover for brands). Car models are a subset of a car brand, so
 * adding one picks its brand first, mirroring how a product category picks its car system.
 */
function AddFitmentSection({
  brands,
  onAddBrand,
  onAddModel,
}: {
  brands: CarBrandTree[];
  onAddBrand: (draft: { english: string; thai: string; file?: File }) => Promise<void>;
  onAddModel: (draft: {
    brandId: string;
    english: string;
    thai: string;
    yearFrom: number | null;
    yearTo: number | null;
  }) => Promise<void>;
}) {
  const t = useT();
  const [kind, setKind] = useState<"brand" | "model">("brand");
  const [english, setEnglish] = useState("");
  const [thai, setThai] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [brandId, setBrandId] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const englishRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isModel = kind === "model";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const en = english.trim();
    if (!en) {
      setError(t({ th: "ต้องใส่ชื่อภาษาอังกฤษ", en: "English name is required." }));
      englishRef.current?.focus();
      return;
    }
    if (isModel && !brandId) {
      setError(
        t({ th: "เลือกยี่ห้อรถให้รุ่นนี้ก่อน", en: "Pick a car brand for this model first." }),
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (isModel) {
        await onAddModel({
          brandId,
          english: en,
          thai: thai.trim(),
          yearFrom: yearOrNull(yearFrom),
          yearTo: yearOrNull(yearTo),
        });
      } else {
        await onAddBrand({ english: en, thai: thai.trim(), file: file ?? undefined });
      }
      setEnglish("");
      setThai("");
      setFile(null);
      setYearFrom("");
      setYearTo("");
      // Keep the selected brand so several models can be added to it in a row.
      if (fileRef.current) fileRef.current.value = "";
      englishRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...cardS, maxWidth: 900, marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>
        {t({ th: "เพิ่มรายการใหม่", en: "Add new" })}
      </div>

      {/* Kind selector — POS "Product / Service / Add-on" segmented style. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {(
          [
            ["brand", CAR_BRANDS],
            ["model", CAR_MODELS],
          ] as const
        ).map(([k, label]) => {
          const active = k === kind;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setError(null);
              }}
              style={{
                padding: "8px 14px",
                borderRadius: 9,
                minHeight: 0,
                border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
                background: active ? "var(--primary)" : "var(--surface)",
                color: active ? "#fff" : "var(--text)",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
              }}
            >
              {t(label)}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} noValidate>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
            gap: 12,
          }}
        >
          {isModel && (
            <div style={{ display: "grid", minWidth: 0 }}>
              <span style={addFieldLabel}>{t(CAR_BRAND)}</span>
              <select
                value={brandId}
                onChange={(e) => {
                  setBrandId(e.target.value);
                  if (error) setError(null);
                }}
                aria-label={t(CAR_BRAND)}
                aria-invalid={error && !brandId ? true : undefined}
                style={{ ...inputS, width: "100%" }}
              >
                <option value="">— {t({ th: "เลือกยี่ห้อรถ", en: "Select car brand" })} —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "grid", minWidth: 0 }}>
            <span style={addFieldLabel}>{t(ENGLISH_NAME)}</span>
            <input
              ref={englishRef}
              value={english}
              onChange={(e) => {
                setEnglish(e.target.value);
                if (error) setError(null);
              }}
              placeholder={isModel ? "e.g. Vigo" : "e.g. Toyota"}
              aria-label={t(ENGLISH_NAME)}
              aria-invalid={error ? true : undefined}
              style={{ ...inputS, width: "100%" }}
            />
          </div>

          <div style={{ display: "grid", minWidth: 0 }}>
            <span style={addFieldLabel}>{t(THAI_NAME)}</span>
            <input
              value={thai}
              onChange={(e) => setThai(e.target.value)}
              placeholder="ชื่อภาษาไทย"
              aria-label={t(THAI_NAME)}
              style={{ ...inputS, width: "100%" }}
            />
          </div>

          {isModel ? (
            <>
              <div style={{ display: "grid", minWidth: 0 }}>
                <span style={addFieldLabel}>{t(YEAR_FROM)}</span>
                <input
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  inputMode="numeric"
                  placeholder="from"
                  aria-label={t(YEAR_FROM)}
                  style={{ ...inputS, width: "100%" }}
                />
              </div>
              <div style={{ display: "grid", minWidth: 0 }}>
                <span style={addFieldLabel}>{t(YEAR_TO)}</span>
                <input
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  inputMode="numeric"
                  placeholder="to"
                  aria-label={t(YEAR_TO)}
                  style={{ ...inputS, width: "100%" }}
                />
              </div>
            </>
          ) : (
            <div style={{ display: "grid", minWidth: 0 }}>
              <span style={addFieldLabel}>{t({ th: "รูปปก", en: "Cover" })}</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  ...inputS,
                  width: "100%",
                  textAlign: "left",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {file
                  ? `🖼 ${file.name}`
                  : `＋ ${t({ th: "รูปปก (ไม่บังคับ)", en: "Cover (optional)" })}`}
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>
            {busy ? t(SAVING) : t(SAVE)}
          </button>
        </div>
        {error && (
          <p role="alert" style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

export default function CarFitmentPage() {
  const t = useT();
  const [brands, setBrands] = useState<CarBrandTree[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openModelId, setOpenModelId] = useState<string | null>(null); // expanded to view service notes
  const [editingModelId, setEditingModelId] = useState<string | null>(null); // expanded into the editor
  const [brandEditing, setBrandEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load(selectId?: string) {
    try {
      const list = await fetchCarFitment();
      setBrands(list);
      setSelectedId((cur) => {
        const want = selectId ?? cur;
        return list.some((b) => b.id === want) ? want! : (list[0]?.id ?? null);
      });
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, selectId?: string, ok?: string) {
    try {
      await fn();
      await load(selectId);
      if (ok) toast(ok, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  /** Create a car brand (English name is the identity), set its Thai/English display names, and
   *  attach a cover if one was picked — all reusing existing endpoints, no backend change. */
  async function addBrand(draft: { english: string; thai: string; file?: File }) {
    try {
      const created = await addCarBrand(draft.english);
      await setAttributeNames("car_brand", created.id, {
        nameTh: draft.thai || null,
        nameEn: draft.english || null,
      });
      if (draft.file)
        await uploadTaxonomyImage("car-brand", created.id, await toSquareCover(draft.file));
      await load(created.id);
      toast(
        t({ th: `เพิ่ม “${draft.english}” แล้ว ✓`, en: `Added “${draft.english}” ✓` }),
        "success",
      );
    } catch (err) {
      await load();
      toast((err as Error).message, "error");
    }
  }

  async function addModel(draft: {
    brandId: string;
    english: string;
    thai: string;
    yearFrom: number | null;
    yearTo: number | null;
  }) {
    try {
      const created = await addCarModel(draft.brandId, draft.english, draft.yearFrom, draft.yearTo);
      await setAttributeNames("car_model", created.id, {
        nameTh: draft.thai || null,
        nameEn: draft.english || null,
      });
      await load(draft.brandId);
      toast(
        t({ th: `เพิ่ม “${draft.english}” แล้ว ✓`, en: `Added “${draft.english}” ✓` }),
        "success",
      );
    } catch (err) {
      await load();
      toast((err as Error).message, "error");
    }
  }

  const selected = brands?.find((b) => b.id === selectedId) ?? null;

  return (
    <main>
      <PageHeader
        title={t({ th: "รุ่นรถที่ใช้ได้", en: "Car fitment" })}
        subtitle={t({
          th: "ยี่ห้อรถและรุ่นของมัน — คือรายการ “ใช้กับรถเหล่านี้” บนหน้าสินค้า เพิ่มด้านบน แล้วเลือกยี่ห้อทางซ้ายเพื่อจัดการรุ่นของมัน ปุ่มแก้ไขของแต่ละรุ่นจะเปิดชื่อ ปี และข้อมูลบริการ (แชสซี น้ำยาแอร์ โอริง น้ำหล่อเย็น) สำหรับใช้ตอบลูกค้า",
          en: "Car brands and their models — the “Fits these cars” lists on a product. Add up top, then pick a brand on the left to manage its models. Each model’s Edit opens its names, year and service notes (chassis, refrigerant, o-ring, coolant) for customer service.",
        })}
      />

      <AddFitmentSection brands={brands ?? []} onAddBrand={addBrand} onAddModel={addModel} />

      {loading ? (
        <div className="skeleton skeleton-row" style={{ width: "60%", marginTop: 16 }} />
      ) : (
        <div style={{ maxWidth: 900, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>
            {t({ th: "ยี่ห้อรถ & รุ่นรถ", en: "Car brands & models" })}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>
            {t({
              th: "รุ่นรถเป็นส่วนย่อยของยี่ห้อรถ — เลือกยี่ห้อเพื่อจัดการรุ่นของมัน",
              en: "Car models are a subset of a car brand — pick a brand to manage its models.",
            })}
          </p>

          <div className="md">
            <div className="md-pane">
              {brands?.map((b) => (
                <div
                  key={b.id}
                  className={b.id === selectedId ? "md-brow sel" : "md-brow"}
                  onClick={() => {
                    setSelectedId(b.id);
                    setOpenModelId(null);
                    setEditingModelId(null);
                    setBrandEditing(false);
                  }}
                >
                  <span className="nm">{b.name}</span>
                  <span className="cnt">{b.models.length}</span>
                </div>
              ))}
              {brands?.length === 0 && (
                <p className="muted" style={{ fontSize: 13, padding: "8px 10px", margin: 0 }}>
                  {t({
                    th: "ยังไม่มียี่ห้อรถ — เพิ่มด้านบน",
                    en: "No brands yet — add one above.",
                  })}
                </p>
              )}
            </div>

            <div className="md-pane">
              {selected ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      padding: "4px 6px 8px",
                    }}
                  >
                    <NameCard
                      key={selected.id}
                      kind="car_brand"
                      option={selected}
                      onChanged={() => load(selected.id)}
                      onEditingChange={setBrandEditing}
                      leading={
                        <CoverPicker
                          kind="car-brand"
                          option={selected}
                          onChanged={() => load(selected.id)}
                        />
                      }
                    />
                    {!brandEditing && (
                      <ConfirmButton
                        className="btn-sm"
                        confirmLabel={t({ th: "ลบยี่ห้อนี้?", en: "Remove brand?" })}
                        onConfirm={() => run(() => deleteCarBrand(selected.id))}
                      >
                        {t({ th: "ลบยี่ห้อ", en: "Remove brand" })}
                      </ConfirmButton>
                    )}
                  </div>

                  {selected.models.length === 0 ? (
                    <p className="muted" style={{ fontSize: 13, padding: "0 6px", margin: 0 }}>
                      {t({
                        th: "ยังไม่มีรุ่นรถ — เพิ่มด้านบน",
                        en: "No models yet — add one above.",
                      })}
                    </p>
                  ) : (
                    <div style={{ padding: "0 6px" }}>
                      {selected.models.map((m) => {
                        const open = m.id === openModelId;
                        const editing = m.id === editingModelId;
                        const expanded = open || editing;
                        return (
                          <div key={m.id} className={expanded ? "md-mexp" : undefined}>
                            <div
                              className={expanded ? "md-mrow open" : "md-mrow"}
                              style={{ alignItems: "center" }}
                            >
                              <NameCard
                                kind="car_model"
                                option={m}
                                onChanged={() => load(selected.id)}
                                hideActions
                                trailing={
                                  <span
                                    className="muted"
                                    style={{ fontSize: 12, whiteSpace: "nowrap" }}
                                  >
                                    {eraStr(m.yearFrom, m.yearTo) || "—"}
                                  </span>
                                }
                              />
                              {modelHasInfo(m) && !expanded && (
                                <span
                                  className="md-dot"
                                  title={t({ th: "มีข้อมูลบริการ", en: "Has service notes" })}
                                />
                              )}
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={
                                  expanded
                                    ? t({ th: `ย่อ ${m.name}`, en: `Collapse ${m.name}` })
                                    : t({ th: `ขยาย ${m.name}`, en: `Expand ${m.name}` })
                                }
                                onClick={() => {
                                  if (editing) {
                                    setEditingModelId(null);
                                    setOpenModelId(null);
                                  } else {
                                    setOpenModelId(open ? null : m.id);
                                  }
                                }}
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{
                                    transform: expanded ? "rotate(180deg)" : "none",
                                    transition: "transform .12s",
                                  }}
                                >
                                  <path d="M6 9l6 6 6-6" />
                                </svg>
                              </button>
                            </div>
                            {expanded &&
                              (editing ? (
                                <ModelInfoEditor
                                  model={m}
                                  onSaved={() => {
                                    load(selected.id);
                                    setEditingModelId(null);
                                  }}
                                  onCancel={() => setEditingModelId(null)}
                                />
                              ) : (
                                <ModelInfoView
                                  model={m}
                                  onEdit={() => setEditingModelId(m.id)}
                                  onRemove={() => run(() => deleteCarModel(m.id), selected.id)}
                                />
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="muted" style={{ padding: 10, margin: 0 }}>
                  {t({ th: "เพิ่มยี่ห้อรถเพื่อเริ่มต้น", en: "Add a brand to get started." })}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
