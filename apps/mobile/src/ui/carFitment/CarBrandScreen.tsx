import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { brandLine, canDeleteCarBrand, findModels, modelLine, titleOf } from "@/lib/carFitmentPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { NameFormSheet, WRONG_PICTURE } from "../partsSetup/NameSheets";
import { DeleteSheet, StepRow } from "../partsSetup/parts";
import { SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { AddModelSheet, CarBrandDetailsSheet } from "./CarSheets";
import { FIT_BASE, modelPath } from "./paths";
import { useCarFitment } from "./useCarFitment";

type Open = "details" | "form" | "delete" | "add" | null;

/**
 * One car brand (canvas row รุ่นรถ 2): its models with their years, and which have no service info
 * yet. ＋ adds a model; ⓘ shows the brand (แก้ไข → names and รูปปก, ลบยี่ห้อ only when no product
 * fits it). Owner, 3 Nov 2026: "swap position" — ＋ first, ⓘ at the far right.
 */
export function CarBrandScreen({ id }: { id: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = useCarFitment();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Open>(null);
  const brand = state.brands?.find((b) => b.id === id);
  const leave = () => (router.canGoBack() ? router.back() : router.replace(FIT_BASE as never));

  useScreenChrome(
    brand
      ? [
          {
            label: t({ th: "เพิ่มรุ่น", en: "Add a model" }),
            icon: ICON.plus,
            onPress: () => setOpen("add"),
          },
          {
            label: t({ th: "ข้อมูลยี่ห้อรถ", en: "Brand details" }),
            icon: ICON.info,
            onPress: () => setOpen("details"),
          },
        ]
      : [],
    [],
    {
      back: { label: t({ th: "รุ่นรถที่ใช้ได้", en: "Car fitment" }), onPress: leave },
      ownTitle: true,
      toast: state.toast ? { title: t(state.toast.title), detail: t(state.toast.detail) } : null,
    },
  );

  if (!state.brands) {
    return state.failed ? (
      <Retry onPress={() => void state.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (!brand) {
    return (
      <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
        {t({ th: "ไม่พบยี่ห้อนี้", en: "This brand is gone" })}
      </Text>
    );
  }

  const words = q.trim();
  const shown = words ? findModels([brand], q).map((r) => r.model) : brand.models;
  const close = () => setOpen(null);

  return (
    <View>
      <Text style={[TYPE.title1, { color: theme.text }, styles.title]} accessibilityRole="header">
        {titleOf(brand)}
      </Text>
      <Text style={[TYPE.subhead, styles.sub, { color: theme.textMuted }]}>
        {t(brandLine(brand))}
      </Text>
      <View style={styles.search}>
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นรุ่น", en: "Find a model" })}
        />
      </View>
      {shown.length === 0 ? (
        <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
          {words
            ? t({ th: `ไม่พบ “${words}”`, en: `No match for “${words}”` })
            : t({ th: "ยังไม่มีรุ่น", en: "No models yet" })}
        </Text>
      ) : (
        <View style={styles.list}>
          <Group>
            {shown.map((m, i) => (
              <StepRow
                key={m.id}
                label={titleOf(m)}
                second={t(modelLine(m))}
                onPress={() => router.push(modelPath(brand, m) as never)}
                last={i === shown.length - 1}
              />
            ))}
          </Group>
        </View>
      )}

      {open === "details" && (
        <CarBrandDetailsSheet brand={brand} onEdit={() => setOpen("form")} onClose={close} />
      )}
      {open === "form" && (
        <NameFormSheet
          kind="carBrand"
          start={brand}
          startImageKey={brand.imageKey}
          list={state.brands}
          canDelete={canDeleteCarBrand(brand)}
          onSave={async (d, change) => {
            const out = await state.saveBrand(d, change);
            if (out === "wrong-picture") state.showToast(WRONG_PICTURE);
            if (out !== "failed") close();
            return out;
          }}
          onDelete={() => setOpen("delete")}
          onClose={close}
        />
      )}
      {open === "delete" && (
        <DeleteSheet
          title={t({ th: `ลบยี่ห้อ ${titleOf(brand)}?`, en: `Delete ${brand.nameEn}?` })}
          onDelete={() => {
            close();
            void state.remove("brand", brand.id).then((gone) => gone && leave());
          }}
          onClose={close}
        />
      )}
      {open === "add" && (
        <AddModelSheet
          brand={brand}
          onSave={async (d) => {
            const out = await state.addModel(brand.id, d);
            if (out !== "failed") close();
            return out;
          }}
          onClose={close}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: SPACE.s, marginHorizontal: 2 },
  sub: { marginHorizontal: 2 },
  search: { marginTop: SPACE.l },
  list: { marginTop: SPACE.m },
  none: { textAlign: "center", paddingVertical: 72, paddingHorizontal: SPACE.m },
});
