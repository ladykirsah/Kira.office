import { useLocalSearchParams } from "expo-router";
import { OrderScreen } from "@/ui/orders/OrderScreen";

export default function Order() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderScreen key={id} id={String(id ?? "")} />;
}
