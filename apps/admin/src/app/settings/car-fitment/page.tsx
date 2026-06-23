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

export default function CarFitmentPage() {
  const [brands, setBrands] = useState<CarBrandTree[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
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

  async function submitBrand(e: FormEvent) {
    e.preventDefault();
    const name = newBrand.trim();
    if (!name) return;
    setNewBrand("");
    const created = await addCarBrand(name).catch((err) => {
      toast((err as Error).message, "error");
      return null;
    });
    if (created) await load(created.id);
  }

  async function submitModel(e: FormEvent) {
    e.preventDefault();
    const name = newModel.trim();
    if (!name || !selectedId) return;
    setNewModel("");
    await run(() => addCarModel(selectedId, name), selectedId, "Added ✓");
  }

  const selected = brands?.find((b) => b.id === selectedId) ?? null;

  return (
    <main>
      <h1>Car fitment</h1>
      <p className="muted" style={{ marginTop: -4 }}>
        Choose a brand on the left, then manage its models on the right. These feed a product&apos;s
        &ldquo;Fits these cars&rdquo; dropdowns; you can also type new values directly on a product.
      </p>

      {loading ? (
        <div className="skeleton skeleton-row" style={{ width: "60%" }} />
      ) : (
        <div className="md">
          <div className="md-pane">
            {brands?.map((b) => (
              <div
                key={b.id}
                className={b.id === selectedId ? "md-brow sel" : "md-brow"}
                onClick={() => setSelectedId(b.id)}
              >
                <span className="nm">{b.name}</span>
                <span className="cnt">{b.models.length}</span>
              </div>
            ))}
            {brands?.length === 0 && (
              <p className="muted" style={{ fontSize: 13, padding: "8px 10px", margin: 0 }}>
                No brands yet.
              </p>
            )}
            <form onSubmit={submitBrand} style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Add brand…"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="submit" className="btn-primary" disabled={!newBrand.trim()}>
                +
              </button>
            </form>
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
                  <span style={{ fontWeight: 600 }}>{selected.name} · models</span>
                  <ConfirmButton
                    confirmLabel="Remove brand?"
                    onConfirm={() => run(() => deleteCarBrand(selected.id))}
                  >
                    Remove brand
                  </ConfirmButton>
                </div>
                {selected.models.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13, padding: "0 6px", margin: 0 }}>
                    No models yet.
                  </p>
                ) : (
                  <div style={{ padding: "0 6px" }}>
                    {selected.models.map((m) => (
                      <div key={m.id} className="md-mrow">
                        <span>{m.name}</span>
                        <ConfirmButton
                          confirmLabel="Remove?"
                          onConfirm={() => run(() => deleteCarModel(m.id), selected.id)}
                        >
                          ✕
                        </ConfirmButton>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={submitModel}
                  style={{ display: "flex", gap: 6, margin: "12px 6px 4px" }}
                >
                  <input
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="Add model…"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="submit" className="btn-primary" disabled={!newModel.trim()}>
                    Add
                  </button>
                </form>
              </>
            ) : (
              <p className="muted" style={{ padding: 10, margin: 0 }}>
                Add a brand to get started.
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
