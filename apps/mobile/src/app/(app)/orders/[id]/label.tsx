import { useLocalSearchParams } from "expo-router";
import { LabelScreen } from "@/ui/orders/OrderFilePages";

export default function OrderLabel() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LabelScreen key={id} id={String(id ?? "")} />;
}
