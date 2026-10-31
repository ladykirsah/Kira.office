import { NotMovedYet } from "@/ui/NotMovedYet";

/** เพิ่มสินค้า is not rebuilt here yet; without this, /products/new would open as a product called "new". */
export default function AddProductPage() {
  return <NotMovedYet />;
}
