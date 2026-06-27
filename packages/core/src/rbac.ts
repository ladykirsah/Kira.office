/** App roles (REQUIREMENTS A3). Enforced once Access + users table are wired. */
export type AppRole = "owner" | "manager" | "stock_operator" | "finance_viewer";

/** Permission checks used by the API before gated mutations land. */
export type AppAction =
  | "product.delete"
  | "product.write"
  | "stock.adjust"
  | "stock.oversell_override"
  | "pricing.override_price"
  | "settings.tax"
  | "settings.fees"
  | "shopee.publish"
  | "finance.read"
  | "audit.read"
  | "users.manage";

const OWNER_ONLY: readonly AppAction[] = [
  "product.delete",
  "stock.oversell_override",
  "pricing.override_price",
  "settings.tax",
  "settings.fees",
  "shopee.publish",
  "users.manage",
];

/** Returns true when `role` may perform `action`. Owner may do everything. */
export function canPerform(role: AppRole, action: AppAction): boolean {
  if (role === "owner") return true;
  if (OWNER_ONLY.includes(action)) return false;
  switch (role) {
    case "manager":
      return (
        action === "product.write" ||
        action === "stock.adjust" ||
        action === "finance.read" ||
        action === "audit.read"
      );
    case "stock_operator":
      return action === "product.write" || action === "stock.adjust";
    case "finance_viewer":
      return action === "finance.read";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}
