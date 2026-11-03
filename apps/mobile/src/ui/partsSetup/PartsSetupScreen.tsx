import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  brandLine,
  brandsTab,
  canDeleteBrand,
  categoryLine,
  deleteTitle,
  findBrands,
  findCategories,
  findSystems,
  sortBrands,
  systemLine,
  systemsWithCounts,
  titleOf,
  unassigned,
  type Brand,
  type CarSystem,
} from "@/lib/partsSetupPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { CategoryFlow, type CategoryOpen } from "./CategorySheets";
import { BrandDetailsSheet, NameFormSheet, WRONG_PICTURE } from "./NameSheets";
import { DeleteSheet, StepRow } from "./parts";
import { usePartsSetup } from "./usePartsSetup";

export const PARTS_BASE = "/settings/attributes";
type Tab = "brands" | "systems";

/**
 * ตั้งค่าอะไหล่ (canvas PartsSetupPhone v311, approved 3 Nov 2026): two tabs kept in the page address —
 * ยี่ห้ออะไหล่ (each brand's logo, names and how many products use it) and ระบบและหมวดหมู่ (each car
 * system with its categories, those with no system together last). ＋ adds to the tab shown.
 */
export function PartsSetupScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const state = usePartsSetup();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const tab: Tab = tabParam === "systems" ? "systems" : "brands";
  const [q, setQ] = useState("");
  const [brandView, setBrandView] = useState<Brand | null>(null);
  const [brandForm, setBrandForm] = useState<{ start: Brand | null } | null>(null);
  const [systemForm, setSystemForm] = useState(false);
  const [deleting, setDeleting] = useState<Brand | null>(null);
  const [cat, setCat] = useState<CategoryOpen>(null);
  const data = state.data;

  useScreenChrome(
    {
      label:
        tab === "brands"
          ? t({ th: "เพิ่มยี่ห้อ", en: "Add a brand" })
          : t({ th: "เพิ่มระบบ", en: "Add a system" }),
      icon: ICON.plus,
      onPress: () => (tab === "brands" ? setBrandForm({ start: null }) : setSystemForm(true)),
    },
    [],
    { toast: state.toast ? { title: t(state.toast.title), detail: t(state.toast.detail) } : null },
  );

  if (!data) {
    return state.failed ? (
      <Retry onPress={() => void state.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }

  const pick = (next: Tab) => {
    setQ("");
    router.setParams({ tab: next });
  };
  const words = q.trim();
  const nothing = (
    <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
      {words
        ? t({ th: `ไม่พบ “${words}”`, en: `No match for “${words}”` })
        : t({ th: "ยังไม่มี", en: "None yet" })}
    </Text>
  );

  const brands = findBrands(sortBrands(data.brands), q);
  const brandList =
    brands.length === 0 ? (
      nothing
    ) : (
      <Group>
        {brands.map((b, i) => (
          <StepRow
            key={b.id}
            label={titleOf(b)}
            second={t(brandLine(b))}
            onPress={() => setBrandView(b)}
            last={i === brands.length - 1}
          />
        ))}
      </Group>
    );

  const rows = systemsWithCounts(data.systems, data.categories);
  const loose = unassigned(data.systems, data.categories);
  const systems = findSystems(rows, q);
  const cats = words ? findCategories(data.categories, q) : [];
  const open = (s: CarSystem | "unassigned") =>
    router.push(
      `${PARTS_BASE}/${s === "unassigned" ? "unassigned" : encodeURIComponent(s.id)}` as never,
    );
  const systemList =
    systems.length + cats.length === 0 && !(loose && !words) ? (
      nothing
    ) : (
      <>
        {(systems.length > 0 || (loose && !words)) && (
          <Group>
            {systems.map((s, i) => (
              <StepRow
                key={s.id}
                label={titleOf(s)}
                second={t(systemLine(s))}
                onPress={() => open(s)}
                last={i === systems.length - 1 && !(loose && !words)}
              />
            ))}
            {loose && !words && (
              <StepRow
                label={t({ th: "ยังไม่ได้จัดระบบ", en: "No system" })}
                second={t(loose.line)}
                onPress={() => open("unassigned")}
              />
            )}
          </Group>
        )}
        {cats.length > 0 && (
          <>
            <Text style={[TYPE.footnote, styles.heading, { color: theme.textMuted }]}>
              {t({ th: "หมวดหมู่", en: "Categories" })}
            </Text>
            <Group>
              {cats.map((c, i) => (
                <StepRow
                  key={c.id}
                  label={titleOf(c)}
                  second={t(categoryLine(c))}
                  onPress={() => setCat({ mode: "view", cat: c })}
                  last={i === cats.length - 1}
                />
              ))}
            </Group>
          </>
        )}
      </>
    );

  const saved = (out: string, close: () => void) => {
    if (out === "failed") return;
    if (out === "wrong-picture") state.showToast(WRONG_PICTURE);
    close();
  };

  return (
    <View>
      <View style={styles.tabs}>
        <Segmented
          label={t({ th: "ตั้งค่าอะไหล่", en: "Part setup" })}
          options={[
            { value: "brands", label: t(brandsTab(data.brands.length)) },
            { value: "systems", label: t({ th: "ระบบและหมวดหมู่", en: "Systems & categories" }) },
          ]}
          value={tab}
          onChange={pick}
        />
      </View>
      <View style={styles.search}>
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={
            tab === "brands"
              ? t({ th: "ค้นยี่ห้อ", en: "Find a brand" })
              : t({ th: "ค้นระบบ หรือหมวดหมู่", en: "Find a system or category" })
          }
        />
      </View>
      <View style={styles.list}>{tab === "brands" ? brandList : systemList}</View>

      {brandView && (
        <BrandDetailsSheet
          brand={brandView}
          onEdit={() => {
            setBrandForm({ start: brandView });
            setBrandView(null);
          }}
          onClose={() => setBrandView(null)}
        />
      )}
      {brandForm && (
        <NameFormSheet
          kind="brand"
          start={brandForm.start}
          startImageKey={brandForm.start?.imageKey}
          list={data.brands}
          canDelete={!!brandForm.start && canDeleteBrand(brandForm.start)}
          onSave={async (d, change) => {
            const out = await state.saveNames("brand", d, change);
            saved(out, () => setBrandForm(null));
            return out;
          }}
          onDelete={() => {
            setDeleting(brandForm.start);
            setBrandForm(null);
          }}
          onClose={() => setBrandForm(null)}
        />
      )}
      {systemForm && (
        <NameFormSheet
          kind="system"
          start={null}
          list={data.systems}
          canDelete={false}
          onSave={async (d) => {
            const out = await state.saveNames("system", d);
            saved(out, () => setSystemForm(false));
            return out;
          }}
          onDelete={() => undefined}
          onClose={() => setSystemForm(false)}
        />
      )}
      {deleting && (
        <DeleteSheet
          title={t(deleteTitle("brand", deleting))}
          onDelete={() => {
            const id = deleting.id;
            setDeleting(null);
            void state.remove("brand", id);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      <CategoryFlow open={cat} setOpen={setCat} state={state} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { marginTop: SPACE.s },
  search: { marginTop: SPACE.m },
  list: { marginTop: SPACE.m },
  heading: { marginTop: SPACE.xl, marginBottom: SPACE.s, marginHorizontal: 2 },
  none: { textAlign: "center", paddingVertical: 72, paddingHorizontal: SPACE.m },
});
