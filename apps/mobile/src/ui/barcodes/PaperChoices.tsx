import { View } from "react-native";
import { useLang } from "../AppProviders";
import { Line } from "../products/parts";
import { Segmented } from "../Segmented";
import type { Barcodes } from "./useBarcodes";

/** ขนาดกระดาษ, แนวกระดาษ and ไฟล์, each a two-way switch. */
export function PaperChoices({ list }: { list: Barcodes }) {
  const { t } = useLang();
  const choice = <T extends string>(
    label: string,
    width: number,
    options: { value: T; label: string }[],
    value: T,
    onChange: (v: T) => void,
    last?: boolean,
  ) => (
    <Line
      label={label}
      last={last}
      right={
        <View style={{ width }}>
          <Segmented label={label} options={options} value={value} onChange={onChange} />
        </View>
      }
    />
  );
  return (
    <>
      {choice(
        t({ th: "ขนาดกระดาษ", en: "Paper size" }),
        120,
        [
          { value: "A4", label: "A4" },
          { value: "A5", label: "A5" },
        ],
        list.paper,
        list.setPaper,
      )}
      {choice(
        t({ th: "แนวกระดาษ", en: "Paper direction" }),
        170,
        [
          { value: "portrait", label: t({ th: "แนวตั้ง", en: "Upright" }) },
          { value: "landscape", label: t({ th: "แนวนอน", en: "Sideways" }) },
        ],
        list.way,
        list.setWay,
      )}
      {choice(
        t({ th: "ไฟล์", en: "File" }),
        120,
        [
          { value: "pdf", label: "PDF" },
          { value: "png", label: "PNG" },
        ],
        list.file,
        list.setFile,
        true,
      )}
    </>
  );
}
