"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  fetchCarFitment,
  addCarBrand,
  addCarModel,
  deleteCarBrand,
  deleteCarModel,
  type CarBrandTree,
} from "@/lib/api";
import { useToast } from "../../ToastProvider";
import { ConfirmButton } from "../../ConfirmButton";

function AddInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (value: string) => Promise<void>;
}) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!val.trim()) return;
    setBusy(true);
    await onAdd(val.trim());
    setVal("");
    setBusy(false);
  }
  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 6 }}>
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0 }}
      />
      <button type="submit" className="btn-primary" disabled={busy || !val.trim()}>
        Add
      </button>
    </form>
  );
}

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: "14px 16px",
} as const;

export default function CarFitmentPage() {
  const [brands, setBrands] = useState<CarBrandTree[] | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  async function load() {
    try {
      setBrands(await fetchCarFitment());
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

  async function run(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      await load();
      if (ok) toast(ok, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }

  return (
    <main>
      <h1>Car fitment</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        Choose a brand, then add its models. These feed a product&apos;s &ldquo;Fits these
        cars&rdquo; dropdowns; you can also type new values directly on a product.
      </p>

      {loading ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: 14,
              margin: "16px 0",
              maxWidth: 920,
            }}
          >
            {brands?.map((b) => (
              <div key={b.id} style={card}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{b.name}</div>
                  <ConfirmButton
                    confirmLabel="Remove brand?"
                    onConfirm={() => run(() => deleteCarBrand(b.id))}
                  >
                    ✕
                  </ConfirmButton>
                </div>
                {b.models.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
                    No models yet.
                  </p>
                ) : (
                  <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                    {b.models.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          borderTop: "1px solid var(--border)",
                          padding: "6px 0",
                        }}
                      >
                        <span>{m.name}</span>
                        <ConfirmButton
                          confirmLabel="Remove?"
                          onConfirm={() => run(() => deleteCarModel(m.id))}
                        >
                          ✕
                        </ConfirmButton>
                      </div>
                    ))}
                  </div>
                )}
                <AddInput
                  placeholder="Add model…"
                  onAdd={(v) => run(() => addCarModel(b.id, v), "Added ✓")}
                />
              </div>
            ))}
          </div>

          <div style={{ maxWidth: 360 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              Add a car brand
            </div>
            <AddInput
              placeholder="Add car brand…"
              onAdd={(v) => run(() => addCarBrand(v), "Brand added ✓")}
            />
          </div>
        </>
      )}
    </main>
  );
}
