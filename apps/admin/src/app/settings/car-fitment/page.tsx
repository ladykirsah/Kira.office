"use client";

import { useEffect, useState, type FormEvent } from "react";
import { inputS } from "@/lib/inputStyles";
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
import { ModelInfoView } from "./ModelInfoView";

/** Format a model's era (year range) for the list label, e.g. "2007 – 2013" / "2013+". */
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

export default function CarFitmentPage() {
  const [brands, setBrands] = useState<CarBrandTree[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newBrand, setNewBrand] = useState("");
  const [newModel, setNewModel] = useState("");
  const [newModelFrom, setNewModelFrom] = useState("");
  const [newModelTo, setNewModelTo] = useState("");
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
    const from = yearOrNull(newModelFrom);
    const to = yearOrNull(newModelTo);
    setNewModel("");
    setNewModelFrom("");
    setNewModelTo("");
    await run(() => addCarModel(selectedId, name, from, to), selectedId, "Added ✓");
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
                  setEditMode(false);
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
            <form
              onSubmit={submitBrand}
              style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}
            >
              <input
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Add brand…"
                style={{ ...inputS, flex: 1, minWidth: 0 }}
              />
              <button type="submit" className="btn-primary btn-sm" disabled={!newBrand.trim()}>
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
                    className="btn-sm"
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
                            onClick={() => {
                              setEditingId(open ? null : m.id);
                              setEditMode(false);
                            }}
                          >
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {m.name}
                              {eraStr(m.yearFrom, m.yearTo) && (
                                <span className="md-era">{eraStr(m.yearFrom, m.yearTo)}</span>
                              )}
                              {open ? (
                                <span className="md-sub">· service notes</span>
                              ) : (
                                modelHasInfo(m) && <span className="md-dot" title="Has notes" />
                              )}
                            </span>
                            <span
                              aria-hidden="true"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                color: "var(--text-muted)",
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
                                  transform: open ? "rotate(180deg)" : "none",
                                  transition: "transform .12s",
                                }}
                              >
                                <path d="M6 9l6 6 6-6" />
                              </svg>
                            </span>
                          </div>
                          {open &&
                            (editMode ? (
                              <ModelInfoEditor
                                model={m}
                                onSaved={() => {
                                  load(selected.id);
                                  setEditMode(false);
                                }}
                                onCancel={() => setEditMode(false)}
                              />
                            ) : (
                              <ModelInfoView
                                model={m}
                                onEdit={() => setEditMode(true)}
                                onRemove={() => run(() => deleteCarModel(m.id), selected.id)}
                              />
                            ))}
                        </div>
                      );
                    })}
                  </div>
                )}
                <form
                  onSubmit={submitModel}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    flexWrap: "wrap",
                    margin: "12px 6px 4px",
                  }}
                >
                  <input
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="Add model…"
                    style={{ ...inputS, flex: 1, minWidth: 100 }}
                  />
                  <input
                    value={newModelFrom}
                    onChange={(e) => setNewModelFrom(e.target.value)}
                    placeholder="from"
                    inputMode="numeric"
                    aria-label="Era from year"
                    style={{ ...inputS, width: 80 }}
                  />
                  <span className="muted">–</span>
                  <input
                    value={newModelTo}
                    onChange={(e) => setNewModelTo(e.target.value)}
                    placeholder="to"
                    inputMode="numeric"
                    aria-label="Era to year"
                    style={{ ...inputS, width: 80 }}
                  />
                  <button type="submit" className="btn-primary btn-sm" disabled={!newModel.trim()}>
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
