import { router } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { removeChoice, renameOption } from "@/lib/choicesApi";
import { API_BASE } from "@/lib/config";
import {
  choicePhoto,
  choicePrice,
  choiceStock,
  groupCount,
  hasChoices,
  refusalText,
  type Choice,
} from "@/lib/productChoices";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { CodeCopy } from "../CodeCopy";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { TRASH_ICON } from "../flash/parts";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { SPACE, TYPE } from "../theme";
import { GroupListSheet, GroupSearchSheet } from "./GroupSheets";
import { OptionsSheet } from "./OptionsSheet";
import { AddRow, Divider, InputRow, Line, Photo } from "./parts";
import type { ProductPage } from "./useProductPage";

const ROW_PHOTO = 44;

/**
 * หน้าสินค้า's ตัวเลือกสินค้า (board ChoicesGroup, approved 7 Nov 2026). With choices: one row each —
 * photo · name · code ⧉ · ขายได้ · ราคาลูกค้า › — and แก้ไข turns the rows into ชื่อกลุ่ม + 🗑. Without:
 * ＋ เพิ่มตัวเลือก opens the first sheet. A choice already sold has no 🗑 (in use = no delete).
 */
export function ChoicesSection({ page }: { page: ProductPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = page.detail!;
  const choices = d.choices ?? [];
  const with_ = hasChoices(d);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.optionName ?? "");
  const [nameError, setNameError] = useState(false);
  const [removing, setRemoving] = useState<Choice | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const busy = useRef(false);

  if (!with_ && !page.rights.edits) return null;
  const option = d.optionName ?? "";
  const productId = d.product.id;

  const startEdit = () => {
    setName(option);
    setNameError(false);
    setEditing(true);
  };

  const finish = async () => {
    if (!name.trim()) return setNameError(true);
    if (busy.current) return;
    busy.current = true;
    try {
      if (name.trim() !== option) {
        const out = await renameOption(fetch, API_BASE, page.token, productId, name.trim());
        if (!out.ok) return page.showToast(refusalText(out.reason));
        await page.load();
      }
      setEditing(false);
    } catch {
      page.showToast({ th: "บันทึกไม่สำเร็จ", en: "Not saved" });
    } finally {
      busy.current = false;
    }
  };

  const remove = async (c: Choice) => {
    if (busy.current) return;
    busy.current = true;
    setRemoving(null);
    try {
      const out = await removeChoice(fetch, API_BASE, page.token, productId, c.variantId);
      if (!out.ok) page.showToast(refusalText(out.reason));
      await page.load();
    } catch {
      page.showToast({ th: "ลบไม่สำเร็จ", en: "Not removed" });
    } finally {
      busy.current = false;
    }
  };

  const add = () =>
    with_
      ? router.push(`/products/${encodeURIComponent(productId)}/choices/new` as never)
      : setSettingUp(true);

  return (
    <View>
      <View style={styles.headRow}>
        <Text style={[TYPE.title2, styles.grow, { color: theme.text }]} accessibilityRole="header">
          {t({ th: "ตัวเลือกสินค้า", en: "Choices" })}
        </Text>
        {with_ && page.rights.edits && (
          <Pressable
            onPress={editing ? () => void finish() : startEdit}
            accessibilityRole="button"
            hitSlop={10}
          >
            <Text style={[TYPE.body, { color: theme.primary }]}>
              {editing ? t({ th: "เสร็จ", en: "Done" }) : t({ th: "แก้ไข", en: "Edit" })}
            </Text>
          </Pressable>
        )}
      </View>
      <Group>
        {editing && (
          <InputRow
            label={t({ th: "ชื่อกลุ่ม", en: "Option name" })}
            value={name}
            placeholder={t({ th: "เช่น ขนาด", en: "e.g. Size" })}
            onChange={(v) => {
              setName(v);
              setNameError(false);
            }}
            error={
              nameError ? t({ th: "ยังไม่ได้ใส่ชื่อกลุ่ม", en: "No option name yet" }) : undefined
            }
          />
        )}
        {choices.map((c, i) => (
          <ChoiceRow
            key={c.variantId}
            page={page}
            choice={c}
            editing={editing}
            onRemove={() => setRemoving(c)}
            last={i === choices.length - 1 && (editing || !page.rights.edits)}
          />
        ))}
        {!editing && page.rights.edits && (
          <AddRow label={t({ th: "เพิ่มตัวเลือก", en: "Add a choice" })} onPress={add} />
        )}
      </Group>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
        {with_
          ? t({
              th: `${option} · อยู่ในสินค้านี้ · แตะเพื่อดูราคาและสต็อกของ${option}นั้น`,
              en: `${option} · part of this product · tap one for its prices and stock`,
            })
          : t({
              th: "เช่น ขนาด ยี่ห้อ จำนวน · อยู่ในสินค้านี้",
              en: "e.g. size, brand, pack · part of this product",
            })}
      </Text>
      {removing && (
        <Sheet
          title={t({ th: `ลบ ${removing.value}?`, en: `Delete ${removing.value}?` })}
          onClose={() => setRemoving(null)}
          noPill
        >
          <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove(removing)} />
          <BigButton
            label={t({ th: "ยกเลิก", en: "Cancel" })}
            kind="grey"
            onPress={() => setRemoving(null)}
          />
        </Sheet>
      )}
      {settingUp && <OptionsSheet page={page} onClose={() => setSettingUp(false)} />}
    </View>
  );
}

/** One choice: photo · name · code ⧉ · ขายได้ on the left, ราคาลูกค้า and › (or 🗑) on the right. */
function ChoiceRow(props: {
  page: ProductPage;
  choice: Choice;
  editing: boolean;
  onRemove: () => void;
  last: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { page, choice: c, editing } = props;
  const body = (
    <View style={styles.row}>
      <Photo imageKey={choicePhoto(c, page.detail!.product.imageKey)} size={ROW_PHOTO} />
      <View style={styles.text}>
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
          {c.value}
        </Text>
        {c.code ? (
          <CodeCopy
            code={c.code}
            style={[TYPE.subhead, { color: theme.textMuted }]}
            onCopied={(said) => page.showToast(said)}
          />
        ) : null}
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(choiceStock(c))}</Text>
      </View>
      <Text style={[TYPE.body, styles.price, { color: theme.text }]}>{choicePrice(c)}</Text>
      <View style={styles.end}>
        {!editing ? (
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        ) : c.inUse ? null : (
          <Pressable
            onPress={props.onRemove}
            accessibilityRole="button"
            accessibilityLabel={t({ th: `ลบ ${c.value}`, en: `Delete ${c.value}` })}
            hitSlop={10}
          >
            <LineIcon d={TRASH_ICON} color={theme.danger} size={20} strokeWidth={1.9} />
          </Pressable>
        )}
      </View>
    </View>
  );
  return (
    <View>
      {editing ? (
        body
      ) : (
        <Pressable
          onPress={() =>
            router.push(
              `/products/${encodeURIComponent(page.detail!.product.id)}/choices/${encodeURIComponent(c.variantId)}` as never,
            )
          }
          accessibilityRole="link"
        >
          {body}
        </Pressable>
      )}
      {!props.last && <Divider />}
    </View>
  );
}

/**
 * กลุ่มสินค้า: only how many are in it on the page (owner: *"the main only shown as how many of the
 * inside"*); the list opens in a sheet. Not in a group yet: ＋ เพิ่มสินค้าในกลุ่ม opens the search.
 */
export function GroupSection({ page }: { page: ProductPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const members = page.detail!.group ?? [];
  const [sheet, setSheet] = useState<"list" | "search" | null>(null);
  if (members.length === 0 && !page.rights.edits) return null;
  return (
    <View>
      <Text style={[TYPE.title2, styles.heading, { color: theme.text }]} accessibilityRole="header">
        {t({ th: "กลุ่มสินค้า", en: "Group" })}
      </Text>
      <Group>
        {members.length > 0 ? (
          <Line
            label={t({ th: "สินค้าในกลุ่ม", en: "In this group" })}
            last
            onPress={() => setSheet("list")}
            right={
              <View style={styles.countRight}>
                <Text style={[TYPE.body, { color: theme.textMuted }]}>
                  {t(groupCount(members.length))}
                </Text>
                <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
              </View>
            }
          />
        ) : (
          <AddRow
            label={t({ th: "เพิ่มสินค้าในกลุ่ม", en: "Add products to the group" })}
            onPress={() => setSheet("search")}
          />
        )}
      </Group>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
        {members.length > 0
          ? t({
              th: "สินค้าอื่นที่ใช้แทนกันได้ · แตะเพื่อดูทั้งหมด",
              en: "Other products that stand in for this one · tap to see them all",
            })
          : t({
              th: "สินค้าอื่นที่ใช้แทนกันได้ · แต่ละตัวมีหน้าของตัวเอง",
              en: "Other products that stand in for this one · each keeps its own page",
            })}
      </Text>
      {sheet === "list" && (
        <GroupListSheet
          page={page}
          onClose={() => setSheet(null)}
          onAdd={() => setSheet("search")}
        />
      )}
      {sheet === "search" && <GroupSearchSheet page={page} onClose={() => setSheet(null)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACE.xxl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
  },
  heading: { marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  row: {
    minHeight: 84,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  price: { fontVariant: ["tabular-nums"], textAlign: "right" },
  end: { width: 20, alignItems: "flex-end" },
  countRight: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
});
