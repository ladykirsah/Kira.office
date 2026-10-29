import { useLocalSearchParams } from "expo-router";
import { CustomerScreen } from "@/ui/orders/OrderDetailPages";

export default function OrderCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerScreen key={id} id={String(id ?? "")} />;
}
