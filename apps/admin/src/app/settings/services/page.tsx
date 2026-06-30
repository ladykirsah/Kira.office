"use client";

import { useEffect, useState } from "react";
import {
  fetchServices,
  addService,
  updateService,
  deleteService,
  type ServiceRow,
} from "@/lib/api";
import { useToast } from "../../ToastProvider";
import { ConfirmButton } from "../../ConfirmButton";
import { inputS } from "@/lib/inputStyles";

const numStyle = { width: 110, minHeight: 0, padding: "8px 10px" } as const;

// Card frame shared by the two sections (Add / Available services).
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

// Available-services table columns: Service stretches; Price shrinks to content (the `width: 1` +
// nowrap trick); Actions is a fixed 112px centered column. The divider is a short RowDivider inside
// each body cell (not a full-height cell border) and is absent from the header.
const firstCol = { paddingLeft: 0 } as const;
const priceCol = { width: 1, whiteSpace: "nowrap" } as const;
const actionCol = { width: 112, whiteSpace: "nowrap", textAlign: "center" } as const;
// Flex layout for the full-width edit row (rendered in a single colSpan cell).
const editRow = { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } as const;

const EditIcon = () => (
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

/** Hairline separating the price from the row's actions — same in saved, edit, and remove modes. */
const RowDivider = () => (
  <span
    aria-hidden="true"
    style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 8px" }}
  />
);

function ServiceItem({
  svc,
  onChanged,
}: {
  svc: ServiceRow;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false); // delete confirm armed → hide the Edit icon
  const [name, setName] = useState(svc.name);
  // `?? ""` guards the deploy gap: until the API ships name_en, older rows arrive without it.
  const [nameEn, setNameEn] = useState(svc.nameEn ?? "");
  const [price, setPrice] = useState((svc.basePriceSatang / 100).toString());
  const [busy, setBusy] = useState(false);
  const priceSatang = Math.max(0, Math.round((parseFloat(price) || 0) * 100));
  const dirty =
    name.trim() !== svc.name || nameEn.trim() !== svc.nameEn || priceSatang !== svc.basePriceSatang;

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateService(svc.id, {
        name: name.trim(),
        nameEn: nameEn.trim(),
        basePriceSatang: priceSatang,
      });
      setEditing(false);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setName(svc.name);
    setNameEn(svc.nameEn ?? "");
    setPrice((svc.basePriceSatang / 100).toString());
    setEditing(false);
  }

  async function del() {
    try {
      await deleteService(svc.id);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  // Saved (view) mode — Thai name over English, price, a divider, then icon actions (Design 2).
  if (!editing) {
    return (
      <tr>
        <td style={firstCol}>
          <div style={{ fontWeight: 600 }}>{svc.name}</div>
          {svc.nameEn ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{svc.nameEn}</div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--text-faint)" }}>Not added</div>
          )}
        </td>
        <td style={priceCol}>
          <span className="pill soft" style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
            ฿{(svc.basePriceSatang / 100).toLocaleString("en-US")}
          </span>
        </td>
        <td style={actionCol}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center" }}>
            <RowDivider />
            {!deleting && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Edit ${svc.name}`}
                onClick={() => setEditing(true)}
              >
                <EditIcon />
              </button>
            )}
            <ConfirmButton
              className="icon-btn"
              ariaLabel={`Delete ${svc.name}`}
              confirmLabel="Remove?"
              onConfirm={del}
              onArmedChange={setDeleting}
            >
              <TrashIcon />
            </ConfirmButton>
          </div>
        </td>
      </tr>
    );
  }

  // Edit mode — Thai + English name inputs + price, with Save / Cancel.
  return (
    <tr>
      <td colSpan={3} style={firstCol}>
        <div style={editRow}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อบริการ (ไทย)"
            style={{ flex: "1 1 150px", minWidth: 0, minHeight: 0, padding: "8px 10px" }}
          />
          <input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Service name (EN)"
            style={{ flex: "1 1 150px", minWidth: 0, minHeight: 0, padding: "8px 10px" }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            ฿
          </span>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={numStyle}
          />
          <RowDivider />
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={!dirty || !name.trim() || busy}
            onClick={save}
          >
            Save
          </button>
          <button type="button" className="btn-sm" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function ServicesPage() {
  const toast = useToast();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  // Adding requires a Thai name and a positive price; the English name is optional.
  const addPriceSatang = Math.max(0, Math.round((parseFloat(price) || 0) * 100));
  const canAdd = name.trim() !== "" && addPriceSatang > 0;

  async function load() {
    try {
      setServices(await fetchServices());
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
    if (!canAdd) return;
    setBusy(true);
    try {
      await addService(name.trim(), nameEn.trim(), addPriceSatang);
      setName("");
      setNameEn("");
      setPrice("");
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const term = q.trim().toLowerCase();
  const filtered = term
    ? services.filter(
        (s) => s.name.toLowerCase().includes(term) || (s.nameEn ?? "").toLowerCase().includes(term),
      )
    : services;

  return (
    <main>
      {/* Headline + subtitle side by side (24px gap); the 40px gap sits below this group. */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 40 }}>
        <h1 style={{ margin: 0 }}>Services</h1>
        <p className="muted" style={{ margin: 0, flex: 1 }}>
          Manage the repair / labour services the Point of Sale can add to a bill. Each has a base
          price that prefills when you pick it — you can still change the price per sale.
        </p>
      </div>

      {/* Frame 1 — add a service */}
      <div style={cardStyle}>
        <div style={cardLabel}>Add a service</div>
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <input
            placeholder="ชื่อบริการ (ไทย)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: "1 1 150px", minWidth: 0 }}
          />
          <input
            placeholder="Service name (EN)"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            style={{ flex: "1 1 150px", minWidth: 0 }}
          />
          <span className="muted" style={{ fontSize: 13 }}>
            ฿
          </span>
          <input
            type="number"
            min={0}
            placeholder="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ width: 110 }}
          />
          <button type="submit" className="btn-primary" disabled={busy || !canAdd}>
            Add
          </button>
        </form>
      </div>

      {/* Frame 2 — available services (table) */}
      <div style={{ ...cardStyle, marginTop: 16 }}>
        <div style={cardLabel}>Available services</div>
        {loading ? (
          <p className="muted" style={{ fontSize: 13 }}>
            Loading…
          </p>
        ) : services.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No services yet. Add one above.
          </p>
        ) : (
          <>
            <input
              className="tbar-input"
              placeholder="Search services…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                ...inputS,
                width: 240,
                maxWidth: "100%",
                color: "var(--text)",
                fontWeight: 500,
                marginBottom: 12,
              }}
            />
            {filtered.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                No services match “{q}”.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th style={firstCol}>Service</th>
                    <th style={priceCol}>Price</th>
                    <th style={actionCol}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <ServiceItem key={s.id} svc={s} onChanged={load} />
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </main>
  );
}
