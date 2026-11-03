import { router } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {
  canDeleteModel,
  modelDraft,
  modelProblems,
  titleOf,
  type ModelDraft,
} from "@/lib/carFitmentPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { DeleteRow, DeleteSheet } from "../partsSetup/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { ModelEdit, ModelView } from "./modelParts";
import { FIT_BASE, brandPath } from "./paths";
import { useCarFitment } from "./useCarFitment";

/**
 * One car model (canvas row รุ่นรถ 3): its service info for answering customers. แก้ไข turns the
 * same page into the form (ยกเลิก · แก้รุ่นรถ · บันทึก pinned at the bottom), as ข้อมูลร้าน does.
 */
export function CarModelScreen({ brandId, modelId }: { brandId: string; modelId: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = useCarFitment();
  const [draft, setDraft] = useState<ModelDraft | null>(null);
  const [saved, setSaved] = useState(0);
  const [tried, setTried] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // A second quick tap on บันทึก lands before the page redraws, so the guard can't be a state.
  const busy = useRef(false);
  const brand = state.brands?.find((b) => b.id === brandId);
  const model = brand?.models.find((m) => m.id === modelId);
  const leave = () =>
    router.canGoBack()
      ? router.back()
      : router.replace((brand ? brandPath(brand) : FIT_BASE) as never);

  const edit = () => {
    if (!model) return;
    const d = modelDraft(model);
    setDraft(d);
    setSaved(d.orings.length);
    setTried(false);
  };
  const save = async () => {
    if (!draft || !brand || !model) return;
    setTried(true);
    if (busy.current || Object.keys(modelProblems(draft, brand.models)).length > 0) return;
    busy.current = true;
    const out = await state.saveModel(model.id, draft);
    busy.current = false;
    if (out === "failed") {
      state.showToast(
        { th: "บันทึกไม่สำเร็จ", en: "Not saved" },
        { th: "ลองอีกครั้ง", en: "Try again" },
      );
    } else setDraft(null);
  };

  useScreenChrome(
    null,
    draft ? [{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void save() }] : [],
    {
      back: draft
        ? { label: t({ th: "ยกเลิก", en: "Cancel" }), plain: true, onPress: () => setDraft(null) }
        : {
            label: brand ? titleOf(brand) : t({ th: "รุ่นรถที่ใช้ได้", en: "Car fitment" }),
            onPress: leave,
          },
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
  if (!brand || !model) {
    return (
      <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
        {t({ th: "ไม่พบรุ่นนี้", en: "This model is gone" })}
      </Text>
    );
  }

  return (
    <View>
      <View style={styles.top}>
        {draft ? (
          <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
            {t({ th: "แก้รุ่นรถ", en: "Edit model" })}
          </Text>
        ) : (
          <Pressable
            onPress={edit}
            accessibilityRole="button"
            style={[
              styles.editPill,
              { backgroundColor: theme.glass, borderColor: theme.glassLine },
            ]}
          >
            <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
          </Pressable>
        )}
      </View>

      {draft ? (
        <ModelEdit
          draft={draft}
          saved={saved}
          problems={tried ? modelProblems(draft, brand.models) : {}}
          onChange={(patch) => setDraft((now) => (now ? { ...now, ...patch } : now))}
          deleteRow={
            canDeleteModel(model) ? (
              <DeleteRow
                label={t({ th: "ลบรุ่นนี้", en: "Delete this model" })}
                onPress={() => setDeleting(true)}
              />
            ) : null
          }
        />
      ) : (
        <ModelView brand={brand} model={model} />
      )}

      {deleting && (
        <DeleteSheet
          title={t({ th: `ลบรุ่น ${titleOf(model)}?`, en: `Delete ${model.nameEn}?` })}
          onDelete={() => {
            setDeleting(false);
            void state.remove("model", model.id).then((gone) => gone && leave());
          }}
          onClose={() => setDeleting(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The frame's back pill is 36 tall with 8 under it; แก้รุ่นรถ and แก้ไข sit on its line.
  top: { marginTop: -44, height: 36, alignItems: "center", justifyContent: "center" },
  editPill: {
    position: "absolute",
    right: 0,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  } as never,
  none: { textAlign: "center", paddingVertical: 72, paddingHorizontal: SPACE.m },
});
