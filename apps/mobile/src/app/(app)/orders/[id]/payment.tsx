import { useLocalSearchParams } from "expo-router";
import { PaymentScreen } from "@/ui/orders/OrderDetailPages";

export default function OrderPayment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentScreen key={id} id={String(id ?? "")} />;
}
