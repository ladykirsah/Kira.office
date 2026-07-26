"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { inputS } from "@/lib/inputStyles";
import { parseWarrantyDays, validateAttributeName } from "@/lib/categoryForm";
import { toSquareCover } from "@/lib/cropImage";
import {
  fetchAttributes,
  fetchTypeWarranties,
  setTypeWarranty,
  setTypeCarSystem,
  addAttribute,
  deleteAttribute,
  uploadTaxonomyImage,
  clearTaxonomyImage,
  imageUrl,
  type AttrKind,
  setAttributeNames,
  type AttrOption,
  type Attributes,
} from "@/lib/api";
import { PageHeader } from "../PageHeader";
import { useToast } from "../ToastProvider";
import { ConfirmButton, XIcon } from "../ConfirmButton";

export interface AttrKindConfig {
  kind: AttrKind;
  label: string;
  listKey: keyof Attributes;
  placeholder: string;
  /** Show a cover-image picker per row — only kinds the storefront renders tiles for. */
  cover?: "type" | "car-brand";
  /**
   * Product categories only: each row carries a warranty window (days) and the add-form collects
   * title + photo + warranty together. Lives here rather than on its own page so a category is
   * created complete in one place.
   */
  warranty?: boolean;
}

const cardS: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
};

/** Square thumbnail + upload / remove for one taxonomy row's storefront cover image. */
export function CoverPicker({
  kind,
  option,
  onChanged,
}: {
  kind: "type" | "car-brand";
  option: AttrOption;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      // Square it before upload — every tile that shows this is 1:1 with object-fit: cover,
      // so an oblong original would be cropped at display time without the owner seeing it.
      await uploadTaxonomyImage(kind, option.id, await toSquareCover(file));
      await onChanged();
      toast(`Cover set for “${option.name}” ✓`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await clearTaxonomyImage(kind, option.id);
      await onChanged();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={option.imageKey ? "Replace cover image" : "Add cover image"}
        aria-label={`${option.imageKey ? "Replace" : "Add"} cover image for ${option.name}`}
        style={{
          width: 34,
          height: 34,
          padding: 0,
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          cursor: busy ? "default" : "pointer",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          lineHeight: 1,
        }}
      >
        {option.imageKey ? (
          <img
            src={imageUrl(option.imageKey)}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span aria-hidden="true" className="muted">
            ＋
          </span>
        )}
      </button>
      {option.imageKey && (
        <ConfirmButton
          className="icon-btn"
          ariaLabel={`Remove cover image for ${option.name}`}
          confirmLabel="Remove image?"
          onConfirm={remove}
        >
          <XIcon />
        </ConfirmButton>
      )}
    </span>
  );
}

/** Inline validation message under an add-form. */
function FieldError({ children }: { children: string }) {
  return (
    <p role="alert" style={{ color: "var(--danger)", fontSize: 12, margin: "6px 0 0" }}>
      {children}
    </p>
  );
}

/**
 * Thai + English display names for one taxonomy row.
 *
 * Follows the owner's rule from the banner table: input box → filled → save → PLAIN TEXT. A row
 * that already has its names reads as a quiet caption, not as two more form fields shouting for
 * attention; click Edit to change it. That keeps a long list of categories scannable.
 *
 * These are display-only. The row's `name` is the identity that products and fitments join on, so
 * it is never editable here — renaming it would orphan those references.
 */
export function BilingualNames({
  kind,
  option,
  onChanged,
}: {
  kind: AttrKind;
  option: AttrOption;
  onChanged: () => Promise<void>;
}) {
  const savedTh = (option.nameTh ?? "").trim();
  const savedEn = (option.nameEn ?? "").trim();
  const [editing, setEditing] = useState(false);
  const [th, setTh] = useState(savedTh);
  const [en, setEn] = useState(savedEn);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await setAttributeNames(kind, option.id, {
        nameTh: th.trim() || null,
        nameEn: en.trim() || null,
      });
      await onChanged();
      setEditing(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="muted" style={{ fontSize: 12 }}>
          {savedTh || savedEn ? (
            <>
              {savedTh && <span>ไทย: {savedTh}</span>}
              {savedTh && savedEn && <span> · </span>}
              {savedEn && <span>EN: {savedEn}</span>}
            </>
          ) : (
            // Not an error state: the storefront falls back to `name`, it just shows one line.
            <em>ยังไม่มีชื่อไทย / อังกฤษ</em>
          )}
        </span>
        <button
          type="button"
          className="btn-sm"
          onClick={() => setEditing(true)}
          style={{
            minHeight: 0,
            padding: "2px 8px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {savedTh || savedEn ? "Edit names" : "Add names"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={th}
        onChange={(e) => setTh(e.target.value)}
        placeholder="ชื่อภาษาไทย"
        aria-label={`ชื่อภาษาไทยของ ${option.name}`}
        style={{ ...inputS, flex: "1 1 150px", minWidth: 0 }}
      />
      <input
        value={en}
        onChange={(e) => setEn(e.target.value)}
        placeholder="English name"
        aria-label={`English name for ${option.name}`}
        style={{ ...inputS, flex: "1 1 150px", minWidth: 0 }}
      />
      <button type="button" className="btn-primary btn-sm" onClick={save} disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        className="btn-sm"
        onClick={() => {
          setTh(savedTh);
          setEn(savedEn);
          setEditing(false);
        }}
        style={{
          minHeight: 0,
          padding: "6px 10px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface)",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

/** Pencil (edit) icon — same stroke style as XIcon so the row's edit + delete icons match. */
function PencilIcon() {
  return (
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * One taxonomy row as a card: English name over Thai name (plain text) on the left; an edit (pencil)
 * and — when `onDelete` is given — a delete (cross) icon on the right. Clicking edit swaps to English
 * + Thai inputs with Save / Cancel. `leading` (a cover thumbnail) and `trailing` (warranty + move
 * controls) are slotted into view mode only; edit mode is just the two inputs + Save / Cancel.
 *
 * `name` stays the identity products/fitments join on and is never edited — the English input writes
 * the display column `nameEn` (which falls back to `name` when blank), never `name` itself.
 */
export function NameCard({
  kind,
  option,
  onChanged,
  onDelete,
  leading,
  trailing,
  editExtras,
  onEdit,
  hideActions,
  onEditingChange,
}: {
  kind: AttrKind;
  option: AttrOption;
  onChanged: () => Promise<void>;
  onDelete?: () => Promise<void>;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Rendered in edit mode after the Thai input (e.g. a category's car-system + warranty inputs). */
  editExtras?: ReactNode;
  /** Override the edit-pencil action — e.g. open a richer external editor instead of the inline one
   *  (car models edit names + year + service notes together). When set, the inline editor is bypassed. */
  onEdit?: () => void;
  /** Hide the edit + delete icons entirely — e.g. model rows whose edit/remove live in the expand. */
  hideActions?: boolean;
  /** Notified when this card enters/leaves edit mode — e.g. so a header can hide sibling actions. */
  onEditingChange?: (editing: boolean) => void;
}) {
  const savedTh = (option.nameTh ?? "").trim();
  const savedEn = (option.nameEn ?? "").trim();
  const [editing, setEditing] = useState(false);
  const [th, setTh] = useState(savedTh);
  const [en, setEn] = useState(savedEn);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    setBusy(true);
    try {
      await setAttributeNames(kind, option.id, {
        nameTh: th.trim() || null,
        nameEn: en.trim() || null,
      });
      await onChanged();
      setEditing(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", flex: 1 }}>
        <input
          value={en}
          onChange={(e) => setEn(e.target.value)}
          placeholder="English name"
          aria-label={`English name for ${option.name}`}
          style={{ ...inputS, flex: "1 1 150px", minWidth: 0 }}
        />
        <input
          value={th}
          onChange={(e) => setTh(e.target.value)}
          placeholder="ชื่อภาษาไทย"
          aria-label={`ชื่อภาษาไทยของ ${option.name}`}
          style={{ ...inputS, flex: "1 1 150px", minWidth: 0 }}
        />
        {editExtras}
        <button type="button" className="btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="btn-sm"
          onClick={() => {
            setEn(savedEn);
            setTh(savedTh);
            setEditing(false);
          }}
          style={{
            minHeight: 0,
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "var(--surface)",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  const english = savedEn || option.name;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
      {leading}
      <div style={{ display: "flex", alignItems: "center", gap: 40, flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {english}
          </span>
          <span
            className="muted"
            style={{
              minWidth: 0,
              fontSize: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {savedTh || "—"}
          </span>
        </span>
        {trailing}
      </div>
      {!hideActions && (
        <>
          <button
            type="button"
            className="icon-btn"
            onClick={onEdit ?? (() => setEditing(true))}
            aria-label={`Edit ${english} names`}
            title="Edit names"
          >
            <PencilIcon />
          </button>
          {onDelete && (
            <ConfirmButton
              className="icon-btn"
              ariaLabel={`Remove ${option.name}`}
              confirmLabel="Remove?"
              onConfirm={onDelete}
            >
              <XIcon />
            </ConfirmButton>
          )}
        </>
      )}
    </div>
  );
}

function ListCard({
  kind,
  label,
  items,
  cover,
  onDelete,
  onChanged,
}: {
  kind: AttrKind;
  label: string;
  items: AttrOption[];
  cover?: "type" | "car-brand";
  onDelete: (id: string) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  return (
    <div style={cardS}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          No values yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 0 }}>
          {items.map((o) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderTop: "1px solid var(--border)",
                padding: "8px 0",
              }}
            >
              <NameCard
                kind={kind}
                option={o}
                onChanged={onChanged}
                onDelete={() => onDelete(o.id)}
                leading={
                  cover ? <CoverPicker kind={cover} option={o} onChanged={onChanged} /> : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const UNASSIGNED = "__unassigned__";

/**
 * Car systems <-> product categories as a car-fitment-style master–detail: pick a car system on the
 * left, manage its product categories (a subset of that system) on the right. Adding happens in the
 * Add-new section up top; here you set covers / Thai-English names / warranty and delete. Categories
 * are simple rows — no expandable per-row detail like car models have.
 */
function CarSystemPanel({
  usages,
  categories,
  warranties,
  onDeleteSystem,
  onDeleteCategory,
  onMoveCategory,
  onSaveWarranty,
  onChanged,
}: {
  usages: AttrOption[];
  categories: AttrOption[];
  warranties: Record<string, number | null>;
  onDeleteSystem: (id: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onMoveCategory: (id: string, usageId: string) => Promise<void>;
  onSaveWarranty: (id: string, name: string, days: number | null) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const systemIds = new Set(usages.map((u) => u.id));
  const isOrphan = (c: AttrOption) => !c.usageId || !systemIds.has(c.usageId);
  // After the 0064 backfill this is normally empty, but keep a bucket so a stray category (e.g. its
  // system was deleted) is never hidden from the owner.
  const orphanCount = categories.filter(isOrphan).length;

  const [selectedId, setSelectedId] = useState<string | null>(usages[0]?.id ?? null);
  const [draftDays, setDraftDays] = useState<Record<string, string>>({});
  const [systemEditing, setSystemEditing] = useState(false);

  // Keep the selection valid across reloads (e.g. after the selected system is deleted).
  useEffect(() => {
    setSelectedId((cur) =>
      cur === UNASSIGNED || usages.some((u) => u.id === cur) ? cur : (usages[0]?.id ?? null),
    );
  }, [usages]);

  const selectedSystem = usages.find((u) => u.id === selectedId) ?? null;
  const shownCats =
    selectedId === UNASSIGNED
      ? categories.filter(isOrphan)
      : categories.filter((c) => c.usageId === selectedId);
  const countFor = (id: string) => categories.filter((c) => c.usageId === id).length;
  const selectedCount = selectedSystem ? countFor(selectedSystem.id) : orphanCount;

  return (
    <div className="md">
      <div className="md-pane">
        {usages.map((u) => (
          <div
            key={u.id}
            className={u.id === selectedId ? "md-brow sel" : "md-brow"}
            onClick={() => setSelectedId(u.id)}
          >
            <span className="nm">{u.name}</span>
            <span className="cnt">{countFor(u.id)}</span>
          </div>
        ))}
        {orphanCount > 0 && (
          <div
            className={selectedId === UNASSIGNED ? "md-brow sel" : "md-brow"}
            onClick={() => setSelectedId(UNASSIGNED)}
          >
            <span className="nm muted">Unassigned</span>
            <span className="cnt">{orphanCount}</span>
          </div>
        )}
        {usages.length === 0 && (
          <p className="muted" style={{ fontSize: 13, padding: "8px 10px", margin: 0 }}>
            No car systems yet — add one above.
          </p>
        )}
      </div>

      <div className="md-pane">
        {selectedId === null ? (
          <p className="muted" style={{ padding: 10, margin: 0 }}>
            Pick a car system on the left.
          </p>
        ) : (
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
              {selectedSystem ? (
                <>
                  <NameCard
                    key={selectedSystem.id}
                    kind="usage"
                    option={selectedSystem}
                    onChanged={onChanged}
                    onEditingChange={setSystemEditing}
                  />
                  {/* Removing a system that still holds categories would orphan them — block it here
                      until a proper "move categories" flow + server-side guard land, and hide it
                      entirely while the system's names are being edited so editing stays focused. */}
                  {!systemEditing && (
                    <ConfirmButton
                      className="btn-sm"
                      confirmLabel="Remove system?"
                      disabled={selectedCount > 0}
                      onConfirm={() => onDeleteSystem(selectedSystem.id)}
                    >
                      Remove system
                    </ConfirmButton>
                  )}
                </>
              ) : (
                <span style={{ fontWeight: 600 }}>Unassigned categories</span>
              )}
            </div>

            {shownCats.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, padding: "0 6px", margin: 0 }}>
                No categories in this system yet — add one above.
              </p>
            ) : (
              <div style={{ padding: "0 6px" }}>
                {shownCats.map((c) => {
                  const current = warranties[c.id] ?? null;
                  const shown = draftDays[c.id] ?? (current === null ? "" : String(current));
                  return (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderTop: "1px solid var(--border)",
                        padding: "8px 0",
                      }}
                    >
                      <NameCard
                        kind="type"
                        option={c}
                        onChanged={onChanged}
                        onDelete={() => onDeleteCategory(c.id)}
                        leading={<CoverPicker kind="type" option={c} onChanged={onChanged} />}
                        trailing={
                          <span className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                            {current != null ? `${current} Days` : "—"}
                          </span>
                        }
                        editExtras={
                          <>
                            <label
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: 12,
                              }}
                            >
                              <span className="muted">System</span>
                              <select
                                value={c.usageId && systemIds.has(c.usageId) ? c.usageId : ""}
                                onChange={(e) => {
                                  if (e.target.value) void onMoveCategory(c.id, e.target.value);
                                }}
                                aria-label={`Move ${c.name} to a car system`}
                                style={{
                                  ...inputS,
                                  minHeight: 0,
                                  padding: "2px 6px",
                                  fontSize: 12,
                                  width: "auto",
                                }}
                              >
                                {(!c.usageId || !systemIds.has(c.usageId)) && (
                                  <option value="">— none —</option>
                                )}
                                {usages.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <input
                              value={shown}
                              onChange={(e) =>
                                setDraftDays((p) => ({ ...p, [c.id]: e.target.value }))
                              }
                              onBlur={() => {
                                const parsed = parseWarrantyDays(shown);
                                if (parsed !== current) void onSaveWarranty(c.id, c.name, parsed);
                              }}
                              inputMode="numeric"
                              placeholder="—"
                              aria-label={`ระยะเวลารับประกันของ ${c.name} (วัน)`}
                              style={{ ...inputS, width: 72, textAlign: "right" }}
                            />
                            <span className="muted" style={{ fontSize: 12 }}>
                              วัน
                            </span>
                          </>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const addFieldLabel: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  marginBottom: 4,
};

/**
 * The one place to add a taxonomy value. A POS-style segmented selector picks the kind (Part brands
 * / Car systems / Product categories); the form then collects the English name (the permanent
 * identity + English display), an optional Thai display name, and — for product categories only — a
 * cover photo and warranty window. On Save the new row lands in that kind's list below.
 */
function AddAttributeSection({
  kinds,
  data,
  onCreate,
}: {
  kinds: AttrKindConfig[];
  data: Attributes | null;
  onCreate: (
    kind: AttrKind,
    draft: {
      english: string;
      thai: string;
      usageId?: string;
      file?: File;
      warrantyDays: number | null;
    },
  ) => Promise<void>;
}) {
  const [kind, setKind] = useState<AttrKind>(kinds[0]!.kind);
  const [english, setEnglish] = useState("");
  const [thai, setThai] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [days, setDays] = useState("");
  const [usageId, setUsageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const englishRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const cfg = kinds.find((k) => k.kind === kind) ?? kinds[0]!;
  const isCategory = !!cfg.warranty;
  const existingNames = data ? data[cfg.listKey].map((i) => i.name) : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateAttributeName(english, existingNames);
    if (!check.ok) {
      setError(check.error);
      englishRef.current?.focus();
      return;
    }
    if (isCategory && !usageId) {
      setError("Pick a car system for this category first.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onCreate(kind, {
        english: check.value,
        thai: thai.trim(),
        usageId: isCategory ? usageId : undefined,
        file: isCategory ? (file ?? undefined) : undefined,
        warrantyDays: isCategory ? parseWarrantyDays(days) : null,
      });
      setEnglish("");
      setThai("");
      setFile(null);
      setDays("");
      // Keep the selected car system so several categories can be added to it in a row.
      if (fileRef.current) fileRef.current.value = "";
      englishRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...cardS, maxWidth: 900, marginTop: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Add new</div>

      {/* Kind selector — POS "Product / Service / Add-on" segmented style. */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {kinds.map((k) => {
          const active = k.kind === kind;
          return (
            <button
              key={k.kind}
              type="button"
              onClick={() => {
                setKind(k.kind);
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
              {k.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} noValidate>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
            gap: 12,
          }}
        >
          {isCategory && (
            <div style={{ display: "grid", minWidth: 0 }}>
              <span style={addFieldLabel}>Car system</span>
              <select
                value={usageId}
                onChange={(e) => {
                  setUsageId(e.target.value);
                  if (error) setError(null);
                }}
                aria-label="Car system"
                aria-invalid={error && !usageId ? true : undefined}
                style={{ ...inputS, width: "100%" }}
              >
                <option value="">— Select car system —</option>
                {(data?.usages ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: "grid", minWidth: 0 }}>
            <span style={addFieldLabel}>English name</span>
            <input
              ref={englishRef}
              value={english}
              onChange={(e) => {
                setEnglish(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. DENSO"
              aria-label="English name"
              aria-invalid={error ? true : undefined}
              style={{ ...inputS, width: "100%" }}
            />
          </div>

          <div style={{ display: "grid", minWidth: 0 }}>
            <span style={addFieldLabel}>Thai name</span>
            <input
              value={thai}
              onChange={(e) => setThai(e.target.value)}
              placeholder="ชื่อภาษาไทย"
              aria-label="Thai name"
              style={{ ...inputS, width: "100%" }}
            />
          </div>

          {isCategory && (
            <>
              <div style={{ display: "grid", minWidth: 0 }}>
                <span style={addFieldLabel}>Cover</span>
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
                  {file ? `🖼 ${file.name}` : "＋ Cover (optional)"}
                </button>
              </div>

              <div style={{ display: "grid", minWidth: 0 }}>
                <span style={addFieldLabel}>Warranty</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    inputMode="numeric"
                    placeholder="—"
                    aria-label="ระยะเวลารับประกัน (วัน)"
                    style={{ ...inputS, width: 72, textAlign: "right" }}
                  />
                  <span className="muted" style={{ fontSize: 12 }}>
                    วัน
                  </span>
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </form>
    </div>
  );
}

/** Reusable manager for a set of creatable attribute lists (one card per kind). */
export function AttributeManager({
  title,
  subtitle,
  kinds,
}: {
  title: string;
  subtitle: string;
  kinds: AttrKindConfig[];
}) {
  const [data, setData] = useState<Attributes | null>(null);
  const [warranties, setWarranties] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const wantsWarranty = kinds.some((k) => k.warranty);

  const load = useCallback(async () => {
    try {
      const [attrs, warr] = await Promise.all([
        fetchAttributes(),
        wantsWarranty ? fetchTypeWarranties() : Promise.resolve([]),
      ]);
      setData(attrs);
      setWarranties(Object.fromEntries(warr.map((w) => [w.id, w.warrantyDays])));
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, wantsWarranty]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Create an attribute from the unified add section. English is the identity `name` AND the English
   * display; Thai is the optional Thai display — both go on the single POST (addAttribute persists
   * them on create). For product categories the cover photo and warranty window are attached after,
   * since both routes key off the created row's id.
   */
  async function createAttribute(
    kind: AttrKind,
    draft: {
      english: string;
      thai: string;
      usageId?: string;
      file?: File;
      warrantyDays: number | null;
    },
  ) {
    try {
      const created = await addAttribute(kind, draft.english, {
        nameTh: draft.thai.trim() || null,
        nameEn: draft.english.trim() || null,
        usageId: kind === "type" ? draft.usageId || null : undefined,
      });
      if (kind === "type") {
        if (draft.file)
          await uploadTaxonomyImage("type", created.id, await toSquareCover(draft.file));
        if (draft.warrantyDays !== null) await setTypeWarranty(created.id, draft.warrantyDays);
      }
      await load();
      toast(`Added “${draft.english}” ✓`, "success");
    } catch (err) {
      // The row may already exist even if a photo/warranty step failed — reload either way so the
      // screen shows what actually landed rather than a stale list.
      await load();
      toast((err as Error).message, "error");
    }
  }

  async function saveWarranty(id: string, name: string, days: number | null) {
    try {
      await setTypeWarranty(id, days);
      setWarranties((p) => ({ ...p, [id]: days }));
      toast(
        days === null ? `${name}: ไม่มีรับประกัน` : `${name}: รับประกัน ${days} วัน`,
        "success",
      );
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function moveCategory(id: string, usageId: string) {
    try {
      await setTypeCarSystem(id, usageId);
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  async function del(kind: AttrKind, id: string) {
    try {
      await deleteAttribute(kind, id);
      await load();
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <main>
      <PageHeader title={title} subtitle={subtitle} />

      <AddAttributeSection kinds={kinds} data={data} onCreate={createAttribute} />

      {loading ? (
        <div className="skeleton skeleton-row" style={{ width: "60%", marginTop: 16 }} />
      ) : (
        <>
          {/* Row 2 — Part brands (a flat list). */}
          <div style={{ maxWidth: 900, marginTop: 16 }}>
            <ListCard
              kind="brand"
              label="Part brands"
              items={data?.brands ?? []}
              onChanged={load}
              onDelete={(id) => del("brand", id)}
            />
          </div>

          {/* Row 3 — Car systems and their product categories (a subset of each system). */}
          <div style={{ maxWidth: 900, marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Car systems & product categories</div>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Product categories are a subset of a car system — pick a system to manage its
              categories.
            </p>
            <CarSystemPanel
              usages={data?.usages ?? []}
              categories={data?.types ?? []}
              warranties={warranties}
              onChanged={load}
              onDeleteSystem={(id) => del("usage", id)}
              onDeleteCategory={(id) => del("type", id)}
              onMoveCategory={moveCategory}
              onSaveWarranty={saveWarranty}
            />
          </div>
        </>
      )}
    </main>
  );
}
