"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { inputS } from "@/lib/inputStyles";
import { parseWarrantyDays, validateAttributeName } from "@/lib/categoryForm";
import { toSquareCover } from "@/lib/cropImage";
import {
  fetchAttributes,
  fetchTypeWarranties,
  setTypeWarranty,
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
          // eslint-disable-next-line @next/next/no-img-element
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
    <p role="alert" style={{ color: "var(--danger, #bf3c1d)", fontSize: 12, margin: "6px 0 0" }}>
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

function ListCard({
  kind,
  label,
  placeholder,
  items,
  cover,
  onAdd,
  onDelete,
  onChanged,
}: {
  kind: AttrKind;
  label: string;
  placeholder: string;
  items: AttrOption[];
  cover?: "type" | "car-brand";
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // NOTE: the Add button is deliberately NOT disabled on empty input. It used to be, and a click
    // that landed before React committed the typed value hit a disabled button — no request, no
    // message, so the feature read as "cannot add anything". Always act, and explain when invalid.
    const check = validateAttributeName(
      val,
      items.map((i) => i.name),
    );
    if (!check.ok) {
      setError(check.error);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onAdd(check.value);
      setVal("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={cardS}>
      <div style={{ fontWeight: 600, marginBottom: 10 }}>{label}</div>
      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          No values yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 0, marginBottom: 12 }}>
          {items.map((o) => (
            <div
              key={o.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
                borderTop: "1px solid var(--border)",
                padding: "8px 0",
              }}
            >
              <span
                style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0, flex: 1 }}
              >
                {cover && <CoverPicker kind={cover} option={o} onChanged={onChanged} />}
                <span style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
                  <BilingualNames kind={kind} option={o} onChanged={onChanged} />
                </span>
              </span>
              <ConfirmButton
                className="icon-btn"
                ariaLabel={`Remove ${o.name}`}
                confirmLabel="Remove?"
                onConfirm={() => onDelete(o.id)}
              >
                <XIcon />
              </ConfirmButton>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            ref={inputRef}
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-invalid={error ? true : undefined}
            style={{ ...inputS, flex: 1, minWidth: 0 }}
          />
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </form>
    </div>
  );
}

/**
 * Product categories: the storefront's category tiles. Each row is title + cover photo + warranty
 * window, and the add-form collects all three at once so a new category goes live complete.
 */
function CategoryCard({
  label,
  placeholder,
  items,
  warranties,
  onCreate,
  onDelete,
  onSaveWarranty,
  onChanged,
}: {
  label: string;
  placeholder: string;
  items: AttrOption[];
  warranties: Record<string, number | null>;
  onCreate: (draft: { name: string; file?: File; warrantyDays: number | null }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSaveWarranty: (id: string, name: string, days: number | null) => Promise<void>;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [days, setDays] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [draftDays, setDraftDays] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateAttributeName(
      name,
      items.map((i) => i.name),
    );
    if (!check.ok) {
      setError(check.error);
      nameRef.current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onCreate({
        name: check.value,
        file: file ?? undefined,
        warrantyDays: parseWarrantyDays(days),
      });
      setName("");
      setDays("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...cardS, gridColumn: "1 / -1" }}>
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 12px" }}>
        หมวดหมู่สินค้าบนหน้าร้าน — รูปหน้าปก + ระยะเวลารับประกัน (วัน) ต่อหมวด เว้นว่าง = ไม่แสดง
      </p>

      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
          No categories yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 0, marginBottom: 14 }}>
          {items.map((o) => {
            const current = warranties[o.id] ?? null;
            const shown = draftDays[o.id] ?? (current === null ? "" : String(current));
            return (
              <div
                key={o.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderTop: "1px solid var(--border)",
                  padding: "8px 0",
                }}
              >
                <CoverPicker kind="type" option={o} onChanged={onChanged} />
                <span style={{ flex: 1, minWidth: 0, display: "grid", gap: 4 }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
                  <BilingualNames kind="type" option={o} onChanged={onChanged} />
                </span>
                <input
                  value={shown}
                  onChange={(e) => setDraftDays((p) => ({ ...p, [o.id]: e.target.value }))}
                  onBlur={() => {
                    const parsed = parseWarrantyDays(shown);
                    if (parsed !== current) void onSaveWarranty(o.id, o.name, parsed);
                  }}
                  inputMode="numeric"
                  placeholder="—"
                  aria-label={`ระยะเวลารับประกันของ ${o.name} (วัน)`}
                  style={{ ...inputS, width: 72, textAlign: "right" }}
                />
                <span className="muted" style={{ fontSize: 12, width: 24 }}>
                  วัน
                </span>
                <ConfirmButton
                  className="icon-btn"
                  ariaLabel={`Remove ${o.name}`}
                  confirmLabel="Remove?"
                  onConfirm={() => onDelete(o.id)}
                >
                  <XIcon />
                </ConfirmButton>
              </div>
            );
          })}
        </div>
      )}

      <form
        onSubmit={submit}
        noValidate
        style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Add a category</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            aria-label="Category title"
            aria-invalid={error ? true : undefined}
            style={{ ...inputS, flex: "2 1 200px", minWidth: 0 }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn-sm"
            onClick={() => fileRef.current?.click()}
            style={{
              ...inputS,
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              cursor: "pointer",
              maxWidth: 190,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file ? `🖼 ${file.name}` : "＋ Photo (optional)"}
          </button>
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
          <button type="submit" className="btn-primary btn-sm" disabled={busy}>
            {busy ? "Adding…" : "Add category"}
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

  async function add(kind: AttrKind, name: string) {
    try {
      await addAttribute(kind, name);
      await load();
      toast(`Added “${name}” ✓`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  /**
   * Create a category, then attach its photo and warranty. Order matters: the image and warranty
   * routes both key off an existing row, so the category has to be created first.
   */
  async function createCategory(draft: { name: string; file?: File; warrantyDays: number | null }) {
    try {
      const created = await addAttribute("type", draft.name);
      if (draft.file)
        await uploadTaxonomyImage("type", created.id, await toSquareCover(draft.file));
      if (draft.warrantyDays !== null) await setTypeWarranty(created.id, draft.warrantyDays);
      await load();
      toast(`Added “${draft.name}” ✓`, "success");
    } catch (err) {
      // The category may already exist even if the photo/warranty step failed — reload either way
      // so the screen shows what actually landed rather than a stale list.
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

      {loading ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))",
            gap: 14,
            marginTop: 16,
            maxWidth: 900,
            // Each card sizes to its own content instead of stretching to the tallest in the row.
            alignItems: "start",
          }}
        >
          {kinds.map((k) =>
            k.warranty ? (
              <CategoryCard
                key={k.kind}
                label={k.label}
                placeholder={k.placeholder}
                items={data ? data[k.listKey] : []}
                warranties={warranties}
                onChanged={load}
                onCreate={createCategory}
                onDelete={(id) => del(k.kind, id)}
                onSaveWarranty={saveWarranty}
              />
            ) : (
              <ListCard
                key={k.kind}
                kind={k.kind}
                label={k.label}
                placeholder={k.placeholder}
                items={data ? data[k.listKey] : []}
                cover={k.cover}
                onChanged={load}
                onAdd={(name) => add(k.kind, name)}
                onDelete={(id) => del(k.kind, id)}
              />
            ),
          )}
        </div>
      )}
    </main>
  );
}
