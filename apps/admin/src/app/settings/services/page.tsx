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

const numStyle = { width: 110, minHeight: 0, padding: "8px 10px" } as const;

const rowStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap" as const,
  padding: "8px 0",
  borderTop: "1px solid var(--border)",
};

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

function ServiceItem({
  svc,
  onChanged,
}: {
  svc: ServiceRow;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
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
      <div style={rowStyle}>
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <div>{svc.name}</div>
          {svc.nameEn ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{svc.nameEn}</div>
          ) : null}
        </div>
        <span style={{ fontWeight: 600 }}>
          ฿{(svc.basePriceSatang / 100).toLocaleString("en-US")}
        </span>
        <span
          aria-hidden="true"
          style={{ width: 1, alignSelf: "stretch", background: "var(--border)", margin: "0 2px" }}
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={`Edit ${svc.name}`}
          onClick={() => setEditing(true)}
        >
          <EditIcon />
        </button>
        <ConfirmButton
          className="icon-btn"
          ariaLabel={`Delete ${svc.name}`}
          confirmLabel="Remove?"
          onConfirm={del}
        >
          <TrashIcon />
        </ConfirmButton>
      </div>
    );
  }

  // Edit mode — Thai + English name inputs + price, with Save / Cancel.
  return (
    <div style={rowStyle}>
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
      <button
        type="button"
        className="btn-primary"
        disabled={!dirty || !name.trim() || busy}
        onClick={save}
        style={{ minHeight: 0, padding: "8px 12px" }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        style={{ minHeight: 0, padding: "8px 12px" }}
      >
        Cancel
      </button>
    </div>
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
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addService(name.trim(), nameEn.trim(), Math.round((parseFloat(price) || 0) * 100));
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

  return (
    <main>
      <h1>Available services</h1>
      <p className="muted">
        Manage the repair / labour services the Point of Sale can add to a bill. Each has a base
        price that prefills when you pick it — you can still change the price per sale.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "14px 16px",
        }}
      >
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <input
            placeholder="ชื่อบริการ (ไทย)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: "1 1 150px", minWidth: 0, minHeight: 0, padding: "8px 10px" }}
          />
          <input
            placeholder="Service name (EN)"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            style={{ flex: "1 1 150px", minWidth: 0, minHeight: 0, padding: "8px 10px" }}
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
            style={numStyle}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || !name.trim()}
            style={{ minHeight: 0, padding: "8px 14px" }}
          >
            Add
          </button>
        </form>

        <div style={{ marginTop: 8 }}>
          {loading ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Loading…
            </p>
          ) : services.length === 0 ? (
            <p
              className="muted"
              style={{ fontSize: 13, paddingTop: 10, borderTop: "1px solid var(--border)" }}
            >
              No services yet. Add one above.
            </p>
          ) : (
            services.map((s) => <ServiceItem key={s.id} svc={s} onChanged={load} />)
          )}
        </div>
      </div>
    </main>
  );
}
