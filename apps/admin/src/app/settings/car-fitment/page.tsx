"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  fetchCarFitment,
  addCarBrand,
  addCarModel,
  deleteCarBrand,
  deleteCarModel,
  type CarBrandTree,
  type CarModelNode,
} from "@/lib/api";
import { useToast } from "../../ToastProvider";
import { ConfirmButton } from "../../ConfirmButton";
import { ModelInfoEditor } from "./ModelInfoEditor";

/** True when a model has any service notes worth flagging in the list. */
function modelHasInfo(m: CarModelNode): boolean {
  return Boolean(
    m.generationCode ||
    m.yearFrom ||
    m.yearTo ||
    m.refrigerant ||
    m.oringUsage?.length ||
    m.coolantLiters ||
    m.notes,
  );
}

export default function CarFitmentPage() {
  const [brands, setBrands] = useState<CarBrandTree[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
        Choose a brand on the left, then manage its models on the right. Click a model to add
        service notes (chassis, years, refrigerant, o-ring, coolant) you can reach during customer
        service. These also feed a product&apos;s &ldquo;Fits these cars&rdquo; dropdowns.
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
                onClick={() => {
                  setSelectedId(b.id);
                  setEditingId(null);
                }}
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
                    {selected.models.map((m) => {
                      const open = m.id === editingId;
                      return (
                        <div key={m.id} className={open ? "md-mexp" : undefined}>
                          <div
                            className={open ? "md-mrow open" : "md-mrow"}
                            style={{ cursor: "pointer" }}
                            onClick={() => setEditingId(open ? null : m.id)}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                className="md-caret"
                                aria-hidden="true"
                                style={{ fontSize: 11, width: 8, display: "inline-block" }}
                              >
                                {open ? "▾" : "▸"}
                              </span>
                              {m.name}
                              {open ? (
                                <span className="md-sub">· service notes</span>
                              ) : (
                                modelHasInfo(m) && <span className="md-dot" title="Has notes" />
                              )}
                            </span>
                            <span
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              <ConfirmButton
                                confirmLabel="Remove?"
                                onConfirm={() => run(() => deleteCarModel(m.id), selected.id)}
                              >
                                ✕
                              </ConfirmButton>
                            </span>
                          </div>
                          {open && <ModelInfoEditor model={m} onSaved={() => load(selected.id)} />}
                        </div>
                      );
                    })}
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
