import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  canDeleteSystem,
  categoryLine,
  deleteTitle,
  findCategories,
  systemLine,
  systemsWithCounts,
  titleOf,
  unassigned,
} from "@/lib/partsSetupPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { CategoryFlow, type CategoryOpen } from "./CategorySheets";
import { NameFormSheet, SystemDetailsSheet } from "./NameSheets";
import { PARTS_BASE } from "./PartsSetupScreen";
import { DeleteSheet, StepRow } from "./parts";
import { usePartsSetup } from "./usePartsSetup";

/**
 * One car system (canvas row 3): its name and counts, ค้นหมวดหมู่, then its categories. ⓘ shows the
 * system's details (แก้ไข → names, ลบระบบ only when empty); ＋ adds a category with this system
 * already picked. "unassigned" lists the categories with no system (no ⓘ there).
 */
export function SystemScreen({ id }: { id: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = usePartsSetup();
  const [q, setQ] = useState("");
  const [details, setDetails] = useState(false);
  const [form, setForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cat, setCat] = useState<CategoryOpen>(null);
  const data = state.data;
  const isLoose = id === "unassigned";
  const row = data
    ? systemsWithCounts(data.systems, data.categories).find((s) => s.id === id)
    : undefined;
  const leave = () =>
    router.canGoBack() ? router.back() : router.replace(`${PARTS_BASE}?tab=systems` as never);

  useScreenChrome(
    [
      // ＋ first, ⓘ at the far right (owner, 3 Nov 2026: "swap position").
      {
        label: t({ th: "เพิ่มหมวดหมู่", en: "Add a category" }),
        icon: ICON.plus,
        onPress: () => setCat({ mode: "form", cat: null, systemId: isLoose ? null : id }),
      },
      ...(isLoose
        ? []
        : [
            {
              label: t({ th: "ข้อมูลระบบ", en: "System details" }),
              icon: ICON.info,
              onPress: () => setDetails(true),
            },
          ]),
    ],
    [],
    {
      back: { label: t({ th: "ตั้งค่าอะไหล่", en: "Part setup" }), onPress: leave },
      ownTitle: true,
      toast: state.toast ? { title: t(state.toast.title), detail: t(state.toast.detail) } : null,
    },
  );

  if (!data) {
    return state.failed ? (
      <Retry onPress={() => void state.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  const loose = unassigned(data.systems, data.categories);
  if (!row && !isLoose) {
    return (
      <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
        {t({ th: "ไม่พบระบบนี้", en: "This system is gone" })}
      </Text>
    );
  }
  const mine = isLoose
    ? (loose?.categories ?? [])
    : data.categories.filter((c) => c.systemId === id);
  const shown = findCategories(mine, q);
  const words = q.trim();

  return (
    <View>
      <Text style={[TYPE.title1, { color: theme.text }, styles.title]} accessibilityRole="header">
        {row ? titleOf(row) : t({ th: "ยังไม่ได้จัดระบบ", en: "No system" })}
      </Text>
      <Text style={[TYPE.subhead, styles.sub, { color: theme.textMuted }]}>
        {row
          ? t(systemLine(row))
          : loose
            ? t(loose.line)
            : t({ th: "ยังไม่มีหมวดหมู่", en: "No categories" })}
      </Text>
      <View style={styles.search}>
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นหมวดหมู่", en: "Find a category" })}
        />
      </View>
      {shown.length === 0 ? (
        <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
          {words
            ? t({ th: `ไม่พบ “${words}”`, en: `No match for “${words}”` })
            : t({ th: "ยังไม่มีหมวดหมู่", en: "No categories yet" })}
        </Text>
      ) : (
        <View style={styles.list}>
          <Group>
            {shown.map((c, i) => (
              <StepRow
                key={c.id}
                label={titleOf(c)}
                second={t(categoryLine(c))}
                picture={c.imageKey}
                onPress={() => setCat({ mode: "view", cat: c })}
                last={i === shown.length - 1}
              />
            ))}
          </Group>
        </View>
      )}

      {row && details && (
        <SystemDetailsSheet
          row={row}
          onEdit={() => {
            setDetails(false);
            setForm(true);
          }}
          onClose={() => setDetails(false)}
        />
      )}
      {row && form && (
        <NameFormSheet
          kind="system"
          start={row}
          list={data.systems}
          canDelete={canDeleteSystem(row, data.categories)}
          onSave={async (d) => {
            const out = await state.saveNames("system", d);
            if (out !== "failed") setForm(false);
            return out;
          }}
          onDelete={() => {
            setForm(false);
            setDeleting(true);
          }}
          onClose={() => setForm(false)}
        />
      )}
      {row && deleting && (
        <DeleteSheet
          title={t(deleteTitle("system", row))}
          onDelete={() => {
            setDeleting(false);
            void state.remove("system", row.id).then(leave);
          }}
          onClose={() => setDeleting(false)}
        />
      )}
      <CategoryFlow open={cat} setOpen={setCat} state={state} />
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
