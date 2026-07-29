"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { groupAffiliateItems, nextSortOrder } from "@/lib/affiliateGroups";
import {
  fetchAffiliateItems,
  fetchAffiliateCategories,
  addAffiliateCategory,
  type AffiliateCategory,
  addAffiliateItem,
  updateAffiliateItem,
  uploadAffiliateItemImage,
  deleteAffiliateItem,
  imageUrl,
  type AffiliateItemRow,
  type AffiliateItemWithStats,
} from "@/lib/api";
import { PageHeader } from "../../PageHeader";
import { useToast } from "../../ToastProvider";
import { inputS } from "@/lib/inputStyles";

// Card frame shared by the sections (same look as the Service Setup page).
const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
} as const;
const cardLabel = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: 12,
} as const;
const fieldCol = { display: "flex", flexDirection: "column", gap: 4 } as const;
/** Cards the AirPlus homepage shelf can show — keep in step with listAffiliateItems(db, 6). */
const HOMEPAGE_SLOTS = 6;

const groupHeadStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  background: "var(--bg)",
  padding: "10px 12px",
};
const fieldLabel = { fontSize: 12, color: "var(--text-muted)" } as const;

const SOURCE_LABELS: Record<AffiliateItemRow["source"], string> = {
  shopee: "Shopee",
  lazada: "Lazada",
  other: "Other",
};

const isHttps = (url: string) => /^https:\/\/.+/.test(url.trim());

/**
 * Per-row "Actions ▾" dropdown — same pattern/classes as the products table's ActionsMenu.
 * Edit runs the row's inline title-edit; Delete asks for an inline confirm. Closes on
 * outside-click / Escape.
 */
function RowActions({
  onEdit,
  onDelete,
  label,
}: {
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  function close() {
    setOpen(false);
    setArmed(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function confirmDelete() {
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
      close();
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="actions-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Actions
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .12s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="actions-menu" role="menu">
          <button
            type="button"
            className="actions-item"
            role="menuitem"
            onClick={() => {
              close();
              onEdit();
            }}
          >
            Edit
          </button>
          {armed ? (
            <div className="actions-confirm">
              <span className="muted" style={{ fontSize: 12 }}>
                Delete “{label}”?
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busy}
                  onClick={confirmDelete}
                >
                  Delete
                </button>
                <button type="button" disabled={busy} onClick={() => setArmed(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="actions-item danger"
              role="menuitem"
              onClick={() => setArmed(true)}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AffiliateItem({
  item,
  onChanged,
}: {
  item: AffiliateItemWithStats;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [imgHover, setImgHover] = useState(false);

  async function saveTitle() {
    const t = titleDraft.trim();
    if (!t) return;
    setBusy(true);
    try {
      await updateAffiliateItem(item.id, { title: t });
      toast("Title updated", "success");
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(active: boolean) {
    try {
      await updateAffiliateItem(item.id, { status: active ? "active" : "disabled" });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  /** Pin/unpin this card on the AirPlus homepage shelf (pinned cards lead it, six at most). */
  async function togglePinned(next: boolean) {
    try {
      await updateAffiliateItem(item.id, { pinned: next });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadAffiliateItemImage(item.id, file);
      toast("Image uploaded", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function del() {
    try {
      await deleteAffiliateItem(item.id);
      toast("Item deleted", "success");
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <tr>
      {/* 60px thumb doubles as the upload control — click it to add or change the image. */}
      <td>
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          onMouseEnter={() => setImgHover(true)}
          onMouseLeave={() => setImgHover(false)}
          title={item.imageKey ? "Click to change the image" : "Click to upload an image"}
          aria-label={
            item.imageKey ? `Change image for ${item.title}` : `Upload image for ${item.title}`
          }
          style={{
            position: "relative",
            width: 60,
            height: 60,
            padding: 0,
            border: "1px solid var(--border)",
            borderRadius: 6,
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {item.imageKey ? (
            <img
              src={imageUrl(item.imageKey)}
              alt={item.title}
              style={{ maxWidth: "100%", maxHeight: "100%" }}
            />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>＋ image</span>
          )}
          {item.imageKey && imgHover && !busy && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.45)",
                color: "#fff",
                fontSize: 11,
              }}
            >
              Change
            </span>
          )}
        </button>
      </td>
      <td>
        {/* Title · category · link, stacked with an even 2px between them. */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
          {editing ? (
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              aria-label={`Edit title for ${item.title}`}
              style={{ ...inputS, width: 220 }}
            />
          ) : (
            <div style={{ fontWeight: 600 }}>{item.title}</div>
          )}
          {/* Category sits with the card it belongs to — same size as the link, in muted ink so the
              title still leads and the outbound URL stays the only coloured thing in the cell. */}
          {/* No category = the storefront hides the card entirely (owner's rule). Say so on the row
              — an invisible card with no warning is the worst version of that decision. */}
          {item.categoryName ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.categoryName}</div>
          ) : (
            <span className="pill warn" style={{ fontSize: 11 }}>
              ยังไม่จัดหมวด · ไม่แสดงบนหน้าร้าน
            </span>
          )}
          <a
            href={item.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              display: "inline-block",
              maxWidth: 260,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              verticalAlign: "bottom",
            }}
          >
            {item.targetUrl}
          </a>
        </div>
      </td>
      <td>
        <span className="pill off">{SOURCE_LABELS[item.source]}</span>
      </td>
      <td>{item.priceText || <span className="muted">—</span>}</td>
      <td>{item.sortOrder}</td>
      <td>{item.clicks}</td>
      <td>
        <span className="switch">
          <input
            type="checkbox"
            checked={!!item.pinned}
            aria-label={`${item.title} on homepage`}
            onChange={(e) => togglePinned(e.target.checked)}
          />
          <span className="slider" />
        </span>
      </td>
      <td>
        <span className="switch">
          <input
            type="checkbox"
            checked={item.status === "active"}
            aria-label={`${item.title} active`}
            onChange={(e) => toggle(e.target.checked)}
          />
          <span className="slider" />
        </span>
      </td>
      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
        <div style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={(e) => upload(e.target.files?.[0])}
          />
          {editing ? (
            <>
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busy || titleDraft.trim() === ""}
                onClick={saveTitle}
              >
                Save
              </button>
              <button
                type="button"
                className="btn-sm"
                disabled={busy}
                onClick={() => {
                  setTitleDraft(item.title);
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <RowActions
              onEdit={() => {
                setTitleDraft(item.title);
                setEditing(true);
              }}
              onDelete={del}
              label={item.title}
            />
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AffiliateItemsPage() {
  const toast = useToast();
  const [items, setItems] = useState<AffiliateItemWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [priceText, setPriceText] = useState("");
  const [source, setSource] = useState<AffiliateItemRow["source"]>("shopee");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [categories, setCategories] = useState<AffiliateCategory[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const urlOk = isHttps(targetUrl);

  async function load() {
    try {
      const [rows, cats] = await Promise.all([fetchAffiliateItems(), fetchAffiliateCategories()]);
      setItems(rows);
      setCategories(cats);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    // The Add button is deliberately NOT disabled on incomplete input. A disabled button that a
    // click passes straight through reads as broken — the owner hit exactly that on Part
    // attributes. Always act, and say what is missing.
    if (title.trim() === "") {
      setAddError("ใส่ชื่อเครื่องมือก่อน — a card needs a title.");
      return;
    }
    if (!urlOk) {
      setAddError("Target URL ต้องขึ้นต้นด้วย https:// — that is the link the card opens.");
      return;
    }
    setAddError(null);
    setBusy(true);
    try {
      const created = await addAffiliateItem({
        title: title.trim(),
        targetUrl: targetUrl.trim(),
        priceText: priceText.trim() || undefined,
        source,
        sortOrder: nextSortOrder(items),
        categoryId: categoryId || null,
      });
      // Picture goes up in the SAME submit. Previously the item was created imageless and the
      // owner had to find a second upload control in the table below — the same two-step flow
      // they flagged on Banners.
      if (file) await uploadAffiliateItemImage(created.id, file);
      toast(`เพิ่ม “${title.trim()}” แล้ว ✓`, "success");
      setTitle("");
      setTargetUrl("");
      setPriceText("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e2) {
      // The row may exist even if the image failed — reload either way so the list shows what
      // actually landed.
      await load();
      setAddError((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
  const groups = groupAffiliateItems(sorted);
  const pinnedTotal = items.filter((i) => i.pinned).length;

  /** Create a category from the form and select it — it becomes a dropdown choice from then on. */
  async function createCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setBusy(true);
    try {
      const cat = await addAffiliateCategory(name);
      setCategories(await fetchAffiliateCategories());
      setCategoryId(cat.id);
      setNewCategory("");
      toast(`สร้างหมวด “${cat.name}” แล้ว ✓`, "success");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <PageHeader
        title="Affiliate tools"
        subtitle="Mechanic-tool cards on the AirPlus storefront that link out to Shopee / Lazada with your affiliate link. The price text is display-only. Clicks are counted per card."
      />

      {/* Frame 1 — add an item */}
      <div style={cardStyle}>
        <div style={cardLabel}>Add an item</div>
        <form onSubmit={add} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Row 1 — filing: which group this card belongs to. 16px clear of row 2 (8 of that is
              the form's own row gap), so the category settings read as a separate part. */}
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "flex-end",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div style={fieldCol}>
              <span style={fieldLabel}>Category</span>
              <select
                aria-label="Category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                style={{ ...inputS, width: 170 }}
              >
                <option value="">— none —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={fieldCol}>
              <span style={fieldLabel}>New category</span>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Gauges"
                aria-label="New category name"
                style={{ ...inputS, width: 170 }}
              />
            </div>
            <button
              type="button"
              className="btn-soft btn-sm"
              disabled={busy || !newCategory.trim()}
              onClick={() => void createCategory()}
            >
              Create
            </button>
          </div>

          {/* Row 2 — what the card is and where it goes. */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ ...fieldCol, flex: "1 1 220px" }}>
              <span style={fieldLabel}>Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Manifold gauge set"
                style={{ ...inputS, minWidth: 0 }}
              />
            </div>
            <div style={{ ...fieldCol, flex: "1 1 260px" }}>
              <span style={fieldLabel}>Target URL (https)</span>
              <input
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://s.shopee.co.th/…"
                style={{ ...inputS, minWidth: 0 }}
              />
            </div>
            <div style={fieldCol}>
              <span style={fieldLabel}>Source</span>
              <select
                aria-label="Source"
                value={source}
                onChange={(e) => setSource(e.target.value as AffiliateItemRow["source"])}
                style={{ ...inputS, width: 130 }}
              >
                <option value="shopee">Shopee</option>
                <option value="lazada">Lazada</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Row 3 — how it looks, and the action. Pinning to the homepage happens in the list
              below, once the card exists (owner, 2026-07-29). */}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={fieldCol}>
              <span style={fieldLabel}>Picture</span>
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
                style={{ whiteSpace: "nowrap" }}
              >
                ＋ {file ? file.name.slice(0, 18) : "Choose…"}
              </button>
            </div>
            <div style={fieldCol}>
              <span style={fieldLabel}>Price text</span>
              <input
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="e.g. ~฿1,290"
                style={{ ...inputS, width: 130 }}
              />
            </div>
            <button type="submit" className="btn-primary btn-sm" disabled={busy}>
              Add
            </button>
          </div>
        </form>

        {addError && (
          <p
            role="alert"
            style={{ fontSize: 12, color: "var(--danger)", marginTop: 6, marginBottom: 0 }}
          >
            {addError}
          </p>
        )}
      </div>

      {/* Frame 2 — items table */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={cardLabel}>Items</span>
          {/* The homepage shelf shows six. Pinning a seventh silently changes nothing, so say so. */}
          {pinnedTotal > 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              {pinnedTotal} pinned
              {pinnedTotal > HOMEPAGE_SLOTS
                ? ` — the homepage shows the first ${HOMEPAGE_SLOTS}`
                : ` · homepage shows up to ${HOMEPAGE_SLOTS}`}
            </span>
          )}
        </div>
        {loading ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Loading…
          </p>
        ) : sorted.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No affiliate items yet. Add one above.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Item</th>
                  <th>Source</th>
                  <th>Price</th>
                  <th>Order</th>
                  <th>Clicks</th>
                  <th>Homepage</th>
                  <th>Active</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.name}>
                    <tr>
                      <td colSpan={9} style={groupHeadStyle}>
                        {g.name}
                        <span className="muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                          {g.items.length} item{g.items.length === 1 ? "" : "s"}
                          {g.pinnedCount > 0 ? ` · ${g.pinnedCount} on homepage` : ""}
                        </span>
                      </td>
                    </tr>
                    {g.items.map((it) => (
                      <AffiliateItem key={it.id} item={it} onChanged={load} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
