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

function ServiceItem({
  svc,
  onChanged,
}: {
  svc: ServiceRow;
  onChanged: () => void | Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(svc.name);
  const [price, setPrice] = useState((svc.basePriceSatang / 100).toString());
  const [busy, setBusy] = useState(false);
  const priceSatang = Math.max(0, Math.round((parseFloat(price) || 0) * 100));
  const dirty = name.trim() !== svc.name || priceSatang !== svc.basePriceSatang;

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await updateService(svc.id, { name: name.trim(), basePriceSatang: priceSatang });
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    try {
      await deleteService(svc.id);
      await onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        padding: "8px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ flex: "1 1 200px", minWidth: 0, minHeight: 0, padding: "8px 10px" }}
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
        className="btn-soft"
        disabled={!dirty || busy}
        onClick={save}
        style={{ minHeight: 0, padding: "8px 12px" }}
      >
        Save
      </button>
      <ConfirmButton confirmLabel="Remove?" onConfirm={del}>
        Delete
      </ConfirmButton>
    </div>
  );
}

export default function ServicesPage() {
  const toast = useToast();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
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
      await addService(name.trim(), Math.round((parseFloat(price) || 0) * 100));
      setName("");
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
          maxWidth: 560,
        }}
      >
        <form
          onSubmit={add}
          style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <input
            placeholder="Service name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: "1 1 200px", minWidth: 0, minHeight: 0, padding: "8px 10px" }}
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
