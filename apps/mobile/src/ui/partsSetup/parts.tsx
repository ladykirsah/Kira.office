import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
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
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
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
 * rows ("เดนโซ่ / DENSO · ใช้ใน 86 สินค้า") and a form's step rows (คำอธิบายบน AirPlus).
 */
export function StepRow(props: {
  label: string;
  second: string;
  hint?: boolean;
  /** The second line cut to one line with … (a form's คำอธิบายบน AirPlus); list rows wrap. */
  oneLine?: boolean;
  onPress: () => void;
  /** In a list: a hairline under every row but the last. */
  last?: boolean;
}) {
  const { theme } = useTheme();
  const row = (
    <Pressable onPress={props.onPress} accessibilityRole="button" style={styles.step}>
      <View style={styles.grow}>
        <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
        <Text
          numberOfLines={props.oneLine ? 1 : undefined}
          style={[TYPE.subhead, { color: props.hint ? theme.textFaint : theme.textMuted }]}
        >
          {props.second}
        </Text>
      </View>
      <Chevron />
    </Pressable>
  );
  return props.last === false ? (
    <View>
      {row}
      <Divider />
    </View>
  ) : (
    row
  );
}

/** The details sheet's คำอธิบายบน AirPlus: the first lines, tap to read it all. */
export function DescriptionCard(props: { label: string; preview: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      style={[styles.descCard, { backgroundColor: theme.surface }]}
    >
      <View style={styles.right}>
        <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]}>{props.label}</Text>
        <Chevron />
      </View>
      <Text style={[TYPE.subhead, styles.descText, { color: theme.text }]}>{props.preview}</Text>
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

/** "ลบ คอมเพรสเซอร์ ไม่ได้": why, and one grey เข้าใจแล้ว. */
export function BlockedSheet(props: { title: string; body: string; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Sheet title={props.title} onClose={props.onClose}>
      <Group>
        <Text style={[TYPE.subhead, styles.blocked, { color: theme.textMuted }]}>{props.body}</Text>
      </Group>
      <BigButton label={t({ th: "เข้าใจแล้ว", en: "OK" })} kind="grey" onPress={props.onClose} />
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
  descCard: { borderRadius: 20, paddingTop: 12, paddingBottom: 14, paddingHorizontal: SPACE.l },
  descText: { marginTop: 6 },
  blocked: { padding: SPACE.l },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
