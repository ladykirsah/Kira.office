import { canDeleteProduct, canEditPrice, canSeeProfit, canWrite } from "@l-shopee/core";
import { useAuth } from "../AppProviders";

/**
 * What the signed-in person may do on สินค้า — the same rules the API enforces (packages/core
 * staffAuth): an admin runs the catalogue and the cost; sell prices, the AirPlus and Shopee
 * switches and deleting are the owner's; a mechanic edits no product but may count stock.
 */
export function useRights() {
  const auth = useAuth();
  const role = auth.status === "signed-in" ? auth.staff.role : "mechanic";
  return {
    seesCost: canSeeProfit(role),
    edits: canWrite(role, "products"),
    prices: canEditPrice(role),
    channels: role === "super_admin",
    deletes: canDeleteProduct(role),
  };
}

export type Rights = ReturnType<typeof useRights>;
