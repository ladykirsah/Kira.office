/** Display helpers: D1 stores money as integer satang; the UI shows THB. */
export function satangToThb(satang: number): string {
  return (satang / 100).toFixed(2);
}

export function formatBaht(satang: number): string {
  return `฿${satangToThb(satang)}`;
}

/** A stored timestamp (ms) as "DD/MM/YYYY · HH:MM" in the viewer's local 24-hour time. */
export function formatUpdatedAt(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
