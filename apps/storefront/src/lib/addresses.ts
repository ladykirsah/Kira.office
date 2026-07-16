/** Address-list helpers shared by the address API + book. Pure so the invariants are unit-tested. */

/**
 * Collapse a customer's address list to a SINGLE default. Rows are passed already ordered
 * default-first, newest-first, so the FIRST default row wins ("the latest one") and every later
 * default is demoted to non-default. Legacy/seed data (and an older checkout path) could leave more
 * than one `is_default = 1` row; this guarantees the UI never shows two "ค่าเริ่มต้น" badges and that
 * checkout resolves exactly one deterministic default.
 */
export function collapseToSingleDefault<T extends { isDefault: boolean }>(rows: readonly T[]): T[] {
  let taken = false;
  return rows.map((row) => {
    const isDefault = row.isDefault && !taken;
    if (isDefault) taken = true;
    return { ...row, isDefault };
  });
}
