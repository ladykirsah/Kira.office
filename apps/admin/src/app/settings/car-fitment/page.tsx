"use client";

import { AttributeManager, type AttrKindConfig } from "../AttributeManager";

const KINDS: AttrKindConfig[] = [
  { kind: "car_brand", label: "Car brands", listKey: "carBrands", placeholder: "Add car brand…" },
  { kind: "car_model", label: "Car models", listKey: "carModels", placeholder: "Add car model…" },
];

export default function CarFitmentPage() {
  return (
    <AttributeManager
      title="Car fitment"
      subtitle="Manage the car brand and model lists behind the 'Fits these cars' dropdowns. You can also type a new value directly on a product — it shows up here."
      kinds={KINDS}
    />
  );
}
