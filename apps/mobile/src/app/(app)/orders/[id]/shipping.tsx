import { useLocalSearchParams } from "expo-router";
import { ShippingScreen } from "@/ui/orders/OrderDetailPages";

export default function OrderShipping() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ShippingScreen key={id} id={String(id ?? "")} />;
}
