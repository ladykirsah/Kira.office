import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { keepPartsWhole } from "@/lib/partsSetupPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Divider, Line } from "../products/parts";
import { PhotoChoice } from "../shop/parts";
import { Chevron } from "../staff/parts";
import { SPACE, TYPE } from "../theme";

const PICTURE =
  "M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 11.5a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6M21 16l-5-5-9 9";
const TILE = 104;
const LIST_TILE = 44;

/**
 * Design C (owner's pick, 3 Nov 2026): the picture big on the left, its name on the right, in one
 * card. Editing adds a grey เลือกรูป / เปลี่ยนรูป under the name, opening ถ่ายรูป / เลือกจากคลังภาพ
 * (and a red เอารูปออก when there is one); reading shows a grey note there instead.
 */
export function PictureCard(props: {
  name: string;
  /** The saved picture's key, or a local preview of a newly picked one. */
  imageKey: string | null;
  preview?: string | null;
  note?: string;
  onChoose?: (source: "camera" | "library") => void;
  onRemove?: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const uri = props.preview ?? (props.imageKey ? `${API_BASE}/img/${props.imageKey}` : null);
  const tile = (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {uri ? (
        <Image source={{ uri }} style={styles.picture} accessibilityLabel={props.name} />
      ) : (
        <LineIcon d={PICTURE} color={theme.textFaint} size={34} strokeWidth={1.6} />
      )}
    </View>
  );
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      {tile}
      <View style={styles.words}>
        <Text style={[TYPE.body, { color: theme.text }]}>{props.name}</Text>
        {props.onChoose ? (
          <PhotoChoice onChoose={props.onChoose} onRemove={uri ? props.onRemove : undefined}>
            {(open) => (
              <Pressable
                onPress={open}
                accessibilityRole="button"
                style={[styles.pill, { backgroundColor: theme.hover }]}
              >
                <Text style={[TYPE.subhead, { color: theme.text }]}>
                  {uri
                    ? t({ th: "เปลี่ยนรูป", en: "Change photo" })
                    : t({ th: "เลือกรูป", en: "Choose photo" })}
                </Text>
              </Pressable>
            )}
          </PhotoChoice>
        ) : props.note ? (
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{props.note}</Text>
        ) : null}
      </View>
    </View>
  );
}

/** A plain value row: the label, the value in black on the right (can't be changed here). */
export function ValueRow(props: {
  label: string;
  value: string;
  last?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Line
      label={props.label}
      last={props.last}
      onPress={props.onPress}
      right={
        <View style={styles.right}>
          <Text style={[TYPE.body, { color: theme.text }]}>{props.value}</Text>
          {props.onPress ? <Chevron /> : null}
        </View>
      }
    />
  );
}

/**
 * A row that opens something: the name, a grey second line (or a faint hint), and ›. The lists'
 * rows ("เดนโซ่ / DENSO · ใช้ใน 86 สินค้า") and a form's step rows (คำอธิบายบน AirPlus). A list row of
 * something with a picture (a category, a part brand) shows it on the left (owner, 3 Nov 2026: "add
 * insert image to all these list"), and its hairline starts under the words.
 */
export function StepRow(props: {
  label: string;
  second: string;
  hint?: boolean;
  /** The second line cut to one line with … (a form's คำอธิบายบน AirPlus); list rows wrap. */
  oneLine?: boolean;
  /** The saved picture's key (null = none yet, the faint mark); leave out for rows with no picture. */
  picture?: string | null;
  onPress: () => void;
  /** In a list: a hairline under every row but the last. */
  last?: boolean;
}) {
  const { theme } = useTheme();
  const pictured = props.picture !== undefined;
  const row = (
    <Pressable onPress={props.onPress} accessibilityRole="button" style={styles.step}>
      {pictured && <ListPicture imageKey={props.picture ?? null} name={props.label} />}
      <View style={styles.grow}>
        <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
        <Text
          numberOfLines={props.oneLine ? 1 : undefined}
          style={[TYPE.subhead, { color: props.hint ? theme.textFaint : theme.textMuted }]}
        >
          {pictured ? keepPartsWhole(props.second) : props.second}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
  if (props.last !== false) return row;
  return (
    <View>
      {row}
      {pictured ? (
        <View style={[styles.underWords, { backgroundColor: theme.border }]} />
      ) : (
        <Divider />
      )}
    </View>
  );
}

/** The 44px tile the Orders and product lists use: the picture, or a faint picture mark. */
function ListPicture(props: { imageKey: string | null; name: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.listTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {props.imageKey ? (
        <Image
          source={{ uri: `${API_BASE}/img/${props.imageKey}` }}
          style={styles.listPicture}
          resizeMode="contain"
          accessibilityLabel={props.name}
        />
      ) : (
        <LineIcon d={PICTURE} color={theme.textFaint} size={20} strokeWidth={1.6} />
      )}
    </View>
  );
}

/**
 * เกี่ยวกับสินค้าประเภทนี้ on a category's details: its คำอธิบาย and เงื่อนไข, a few lines of each under
 * their names (ยังไม่มี when empty); tap to read them whole.
 */
export function AboutCard(props: {
  label: string;
  parts: { label: string; text: string; empty: boolean }[];
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={[
        styles.descCard,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      <View style={styles.right}>
        <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]}>{props.label}</Text>
        <Chevron />
      </View>
      {props.parts.map((p) => (
        <View key={p.label} style={styles.aboutPart}>
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{p.label}</Text>
          <Text style={[TYPE.subhead, { color: p.empty ? theme.textMuted : theme.text }]}>
            {p.text}
          </Text>
        </View>
      ))}
    </Pressable>
  );
}

/** ลบ… ? — a red ลบ and a grey ยกเลิก, nothing else (as คูปอง's and ตั้งค่าบริการ's). */
export function DeleteSheet(props: { title: string; onDelete: () => void; onClose: () => void }) {
  const { t } = useLang();
  return (
    <Sheet title={props.title} onClose={props.onClose} noPill>
      <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={props.onDelete} />
      <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={props.onClose} />
    </Sheet>
  );
}

/** A red row that starts a delete: ลบยี่ห้อ, ลบระบบ, ลบหมวดหมู่. */
export function DeleteRow(props: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Group>
      <Pressable onPress={props.onPress} accessibilityRole="button" style={styles.deleteRow}>
        <Text style={[TYPE.body, { color: theme.danger }]}>{props.label}</Text>
      </Pressable>
    </Group>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.l,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  picture: { width: TILE, height: TILE },
  words: { flex: 1, alignItems: "flex-start", gap: SPACE.s },
  pill: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center" },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  step: {
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  grow: { flex: 1, minWidth: 0 },
  listTile: {
    width: LIST_TILE,
    height: LIST_TILE,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  listPicture: { width: LIST_TILE - 2, height: LIST_TILE - 2 },
  underWords: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l + LIST_TILE + 10 },
  descCard: { borderRadius: 20, paddingTop: 12, paddingBottom: 14, paddingHorizontal: SPACE.l },
  aboutPart: { marginTop: 10, gap: 2 },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
