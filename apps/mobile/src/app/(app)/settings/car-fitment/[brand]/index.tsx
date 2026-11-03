import { useLocalSearchParams } from "expo-router";
import { CarBrandScreen } from "@/ui/carFitment/CarBrandScreen";

export default function CarFitmentBrand() {
  const { brand = "" } = useLocalSearchParams<{ brand: string }>();
  return <CarBrandScreen id={brand} />;
}
