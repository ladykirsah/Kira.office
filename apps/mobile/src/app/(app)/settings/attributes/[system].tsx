import { useLocalSearchParams } from "expo-router";
import { SystemScreen } from "@/ui/partsSetup/SystemScreen";

export default function PartsSystem() {
  const { system = "" } = useLocalSearchParams<{ system: string }>();
  return <SystemScreen id={system} />;
}
