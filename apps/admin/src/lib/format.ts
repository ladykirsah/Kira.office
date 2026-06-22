/** Display helpers: D1 stores money as integer satang; the UI shows THB. */
export function satangToThb(satang: number): string {
  return (satang / 100).toFixed(2);
}

export function formatBaht(satang: number): string {
  return `฿${satangToThb(satang)}`;
}
