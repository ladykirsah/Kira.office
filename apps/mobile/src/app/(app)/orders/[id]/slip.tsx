import { useLocalSearchParams } from "expo-router";
import { SlipScreen } from "@/ui/orders/OrderFilePages";

export default function OrderSlip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <SlipScreen key={id} id={String(id ?? "")} />;
}
