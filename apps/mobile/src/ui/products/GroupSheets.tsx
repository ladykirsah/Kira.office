import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { billLineName } from "@/lib/billName";
import { addToGroup, removeFromGroup } from "@/lib/choicesApi";
import { API_BASE } from "@/lib/config";
import {
  candidatesLine,
  groupCandidates,
  groupTitle,
  memberName,
  memberPrice,
  memberStock,
  refusalText,
  sortedGroup,
  type GroupMember,
} from "@/lib/productChoices";
import type { ProductRow } from "@/lib/productList";
import { fetchProductRows } from "@/lib/productsApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { CodeCopy } from "../CodeCopy";
import { TRASH_ICON } from "../flash/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { SPACE, TYPE } from "../theme";
import { AddRow, Divider, Photo, SearchBox } from "./parts";
import type { ProductPage } from "./useProductPage";

const ROW_PHOTO = 44;

/**
 * กลุ่มสินค้า · N สินค้า (board ChoicesGroup row 2): this product first ("· สินค้านี้"), the others
 * cheapest first; a tap opens that product's own page. แก้ไข puts 🗑 on the others — the product
 * leaves the group and stays in the shop, after one question.
 */
export function GroupListSheet(props: {
  page: ProductPage;
  onClose: () => void;
  onAdd: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { page } = props;
  const d = page.detail!;
  const self = d.product.id;
  const members = sortedGroup(d.group ?? [], self);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<GroupMember | null>(null);
  const busy = useRef(false);

  const remove = async (m: GroupMember) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const out = await removeFromGroup(fetch, API_BASE, page.token, self, m.id);
      setRemoving(null);
      if (!out.ok) {
        props.onClose();
        page.showToast(refusalText(out.reason));
      }
      await page.load();
    } catch {
      setRemoving(null);
      props.onClose();
      page.showToast({ th: "บันทึกไม่สำเร็จ", en: "Not saved" });
    } finally {
      busy.current = false;
    }
  };

  if (removing) {
    return (
      <Sheet
        title={t({
          th: `เอา ${memberName(removing)} ออกจากกลุ่ม?`,
          en: `Take ${memberName(removing)} out of the group?`,
        })}
        titleLines={2}
        sub={removing.productRef}
        onClose={() => setRemoving(null)}
        noPill
      >
        <BigButton
          label={t({ th: "เอาออก", en: "Take out" })}
          onPress={() => void remove(removing)}
        />
        <BigButton
          label={t({ th: "ยกเลิก", en: "Cancel" })}
          kind="grey"
          onPress={() => setRemoving(null)}
        />
      </Sheet>
    );
  }

  // The group ends when one is left (the server's rule): the sheet has nothing to show then.
  if (members.length < 2) {
    return null;
  }

  return (
    <Sheet
      title={t(groupTitle(members.length))}
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={props.onClose}
      right={
        page.rights.edits
          ? {
              label: editing ? t({ th: "เสร็จ", en: "Done" }) : t({ th: "แก้ไข", en: "Edit" }),
              onPress: () => setEditing(!editing),
            }
          : undefined
      }
      tall={members.length > 4}
    >
      <Group>
        {members.map((m, i) => (
          <MemberRow
            key={m.id}
            page={page}
            member={m}
            self={m.id === self}
            editing={editing}
            onOpen={() => {
              props.onClose();
              router.push(`/products/${encodeURIComponent(m.id)}` as never);
            }}
            onRemove={() => setRemoving(m)}
            last={i === members.length - 1 && (editing || !page.rights.edits)}
          />
        ))}
        {!editing && page.rights.edits && (
          <AddRow
            label={t({ th: "เพิ่มสินค้าในกลุ่ม", en: "Add products to the group" })}
            onPress={props.onAdd}
          />
        )}
      </Group>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
        {editing
          ? t({
              th: "แตะ 🗑 → เอาออกจากกลุ่ม · สินค้ายังอยู่",
              en: "Tap 🗑 to take it out of the group · the product stays",
            })
          : t({ th: "แตะสินค้า → ไปหน้าของสินค้านั้น", en: "Tap a product to open its page" })}
      </Text>
    </Sheet>
  );
}

function MemberRow(props: {
  page: ProductPage;
  member: GroupMember;
  self: boolean;
  editing: boolean;
  onOpen: () => void;
  onRemove: () => void;
  last: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { member: m } = props;
  const body = (
    <View style={styles.row}>
      <Photo imageKey={m.imageKey} size={ROW_PHOTO} />
      <View style={styles.text}>
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
          {memberName(m)}
          {props.self ? (
            <Text style={{ color: theme.textMuted }}>
              {t({ th: " · สินค้านี้", en: " · this product" })}
            </Text>
          ) : null}
        </Text>
        <CodeCopy code={m.productRef} style={[TYPE.subhead, { color: theme.textMuted }]} />
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(memberStock(m))}</Text>
      </View>
      <Text style={[TYPE.body, styles.price, { color: theme.text }]}>
        {m.priceSatang ? t(memberPrice(m)) : "—"}
      </Text>
      <View style={styles.end}>
        {props.self ? null : props.editing ? (
          <Pressable
            onPress={props.onRemove}
            accessibilityRole="button"
            accessibilityLabel={t({
              th: `เอา ${memberName(m)} ออกจากกลุ่ม`,
              en: `Take ${memberName(m)} out of the group`,
            })}
            hitSlop={10}
          >
            <LineIcon d={TRASH_ICON} color={theme.danger} size={20} strokeWidth={1.9} />
          </Pressable>
        ) : (
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
        )}
      </View>
    </View>
  );
  return (
    <View>
      {props.self || props.editing ? (
        body
      ) : (
        <Pressable onPress={props.onOpen} accessibilityRole="link">
          {body}
        </Pressable>
      )}
      {!props.last && <Divider />}
    </View>
  );
}

/**
 * เพิ่มสินค้าในกลุ่ม: search by name or code; the same part for the same first car comes first (and
 * is all that shows before anything is typed). Tap to tick, then เพิ่ม. This product and the ones
 * already in its group are never offered.
 */
export function GroupSearchSheet({ page, onClose }: { page: ProductPage; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = page.detail!;
  const p = d.product;
  const [rows, setRows] = useState<ProductRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [nonePicked, setNonePicked] = useState(false);
  const busy = useRef(false);

  const load = () => {
    setFailed(false);
    fetchProductRows(fetch, API_BASE, page.token)
      .then(setRows)
      .catch(() => setFailed(true));
  };
  useEffect(load, [page.token]);

  const exclude = useMemo(() => new Set((d.group ?? []).map((m) => m.id)), [d.group]);
  const found = useMemo(
    () =>
      rows
        ? groupCandidates(
            rows,
            query,
            { id: p.id, typeName: p.typeName, fitments: d.fitments },
            exclude,
          )
        : [],
    [rows, query, p.id, p.typeName, d.fitments, exclude],
  );
  const first = d.fitments[0];
  const car = first ? [first.carBrand, first.carModel].filter(Boolean).join(" ") || null : null;
  const type = p.typeName ? page.label("types", p.typeName) : null;

  const toggle = (id: string) => {
    setNonePicked(false);
    setPicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  };

  const add = async () => {
    if (picked.length === 0) return setNonePicked(true);
    if (busy.current) return;
    busy.current = true;
    try {
      const out = await addToGroup(fetch, API_BASE, page.token, p.id, picked);
      onClose();
      if (!out.ok) page.showToast(refusalText(out.reason));
      await page.load();
    } catch {
      onClose();
      page.showToast({ th: "บันทึกไม่สำเร็จ", en: "Not saved" });
    } finally {
      busy.current = false;
    }
  };

  const shortName = (r: ProductRow) =>
    billLineName(
      {
        name: r.name,
        typeName: r.typeName ? page.label("types", r.typeName) : null,
        brandName: r.brandName,
      },
      "customer",
    );

  return (
    <Sheet title={t({ th: "เพิ่มสินค้าในกลุ่ม", en: "Add to the group" })} onClose={onClose} tall>
      <SearchBox
        value={query}
        placeholder={t({ th: "ค้นหาชื่อหรือรหัส", en: "Search a name or code" })}
        onChange={setQuery}
      />
      {failed ? (
        <View style={styles.retry}>
          <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>
            {t({ th: "โหลดรายการสินค้าไม่ได้", en: "The products did not load" })}
          </Text>
          <SmallButton label={t({ th: "ลองอีกครั้ง", en: "Try again" })} onPress={load} />
        </View>
      ) : !rows ? (
        <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xl }} />
      ) : (
        <>
          {found.length > 0 ? (
            <Text style={[TYPE.footnote, styles.line, { color: theme.textMuted }]}>
              {t(candidatesLine(type, car, found.length))}
            </Text>
          ) : query.trim() ? (
            <Text style={[TYPE.footnote, styles.line, { color: theme.textMuted }]}>
              {t({ th: "ไม่พบสินค้า", en: "No products found" })}
            </Text>
          ) : null}
          {found.length > 0 && (
            <Group>
              {found.map((r, i) => (
                <View key={r.id}>
                  <Pressable
                    onPress={() => toggle(r.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: picked.includes(r.id) }}
                    style={styles.pickRow}
                  >
                    <Photo imageKey={r.imageKey} size={ROW_PHOTO} />
                    <View style={styles.text}>
                      <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
                        {shortName(r)}
                      </Text>
                      <CodeCopy
                        code={r.productRef}
                        style={[TYPE.subhead, { color: theme.textMuted }]}
                      />
                    </View>
                    <View style={styles.end}>
                      {picked.includes(r.id) && (
                        <LineIcon
                          d={ICON.check}
                          color={theme.primary}
                          size={20}
                          strokeWidth={2.6}
                        />
                      )}
                    </View>
                  </Pressable>
                  {i < found.length - 1 && <Divider />}
                </View>
              ))}
            </Group>
          )}
          <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
            {t({
              th: "ค้นหาด้วยชื่อหรือรหัส · สินค้าที่ชื่ออะไหล่และรถคันแรกตรงกันขึ้นก่อน",
              en: "Search by name or code · the same part for the same first car comes first",
            })}
          </Text>
        </>
      )}
      {nonePicked && (
        <FieldError text={t({ th: "ยังไม่ได้เลือกสินค้า", en: "No product picked yet" })} />
      )}
      <BigButton label={t({ th: "เพิ่ม", en: "Add" })} onPress={() => void add()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  row: {
    minHeight: 84,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  pickRow: {
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  price: { fontVariant: ["tabular-nums"], textAlign: "right" },
  end: { width: 20, alignItems: "flex-end" },
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
  line: { marginTop: SPACE.l, marginBottom: SPACE.s, marginHorizontal: SPACE.l },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.l },
});
