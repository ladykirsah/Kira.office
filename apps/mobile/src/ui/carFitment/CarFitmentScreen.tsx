import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { brandLine, findModels, foundWords, modelHead, titleOf } from "@/lib/carFitmentPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { NameFormSheet, WRONG_PICTURE } from "../partsSetup/NameSheets";
import { StepRow } from "../partsSetup/parts";
import { SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { brandPath, modelPath } from "./paths";
import { useCarFitment } from "./useCarFitment";

/**
 * รุ่นรถที่ใช้ได้ (canvas FitmentPhone v320, 3 Nov 2026): every car brand with its รูปปก and how many
 * models, and ค้นรุ่นรถ for answering a customer straight away — the models of every brand in one
 * list. ＋ adds a car brand.
 */
export function CarFitmentScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = useCarFitment();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const brands = state.brands;

  useScreenChrome(
    {
      label: t({ th: "เพิ่มยี่ห้อรถ", en: "Add a car brand" }),
      icon: ICON.plus,
      main: true,
      onPress: () => setAdding(true),
    },
    [],
    { toast: state.toast ? { title: t(state.toast.title), detail: t(state.toast.detail) } : null },
  );

  if (!brands) {
    return state.failed ? (
      <Retry onPress={() => void state.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }

  const words = q.trim();
  const found = findModels(brands, q);
  const none = (text: string) => (
    <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>{text}</Text>
  );

  let list;
  if (words) {
    list =
      found.length === 0 ? (
        none(t({ th: `ไม่พบ “${words}”`, en: `No match for “${words}”` }))
      ) : (
        <>
          <Text style={[TYPE.footnote, styles.found, { color: theme.textMuted }]}>
            {t(foundWords(found.length))}
          </Text>
          <Group>
            {found.map(({ brand, model }, i) => (
              <StepRow
                key={model.id}
                label={titleOf(model)}
                second={t(modelHead(brand, model))}
                onPress={() => router.push(modelPath(brand, model) as never)}
                last={i === found.length - 1}
              />
            ))}
          </Group>
        </>
      );
  } else if (brands.length === 0) {
    list = none(t({ th: "ยังไม่มียี่ห้อรถ", en: "No car brands yet" }));
  } else {
    list = (
      <Group>
        {brands.map((b, i) => (
          <StepRow
            key={b.id}
            label={titleOf(b)}
            second={t(brandLine(b))}
            picture={b.imageKey}
            onPress={() => router.push(brandPath(b) as never)}
            last={i === brands.length - 1}
          />
        ))}
      </Group>
    );
  }

  return (
    <View>
      <View style={styles.search}>
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นรุ่นรถ เช่น Vigo", en: "Find a model, e.g. Vigo" })}
        />
      </View>
      <View style={styles.list}>{list}</View>

      {adding && (
        <NameFormSheet
          kind="carBrand"
          start={null}
          list={brands}
          canDelete={false}
          onSave={async (d, change) => {
            const out = await state.saveBrand(d, change);
            if (out === "wrong-picture") state.showToast(WRONG_PICTURE);
            if (out !== "failed") setAdding(false);
            return out;
          }}
          onDelete={() => undefined}
          onClose={() => setAdding(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: SPACE.s },
  list: { marginTop: SPACE.m },
  found: { marginBottom: SPACE.s, marginHorizontal: SPACE.l },
  none: { textAlign: "center", paddingVertical: 72, paddingHorizontal: SPACE.m },
});
