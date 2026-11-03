import { useLocalSearchParams } from "expo-router";
import { CarModelScreen } from "@/ui/carFitment/CarModelScreen";

export default function CarFitmentModel() {
  const { brand = "", model = "" } = useLocalSearchParams<{ brand: string; model: string }>();
  return <CarModelScreen brandId={brand} modelId={model} />;
}
