import { useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { editedLine, galleryKeys } from "@/lib/productPage";
import { useLang, useTheme } from "../AppProviders";
import { CodeCopy } from "../CodeCopy";
import { DeskCard } from "../desk/DeskCard";
import { SPACE, TYPE } from "../theme";
import {
  CarLines,
  DeleteLine,
  DetailLines,
  OnlineLines,
  PriceLines,
  StockLines,
} from "./ProductPageParts";
import type { ProductPage } from "./useProductPage";

/** The big 1:1 photo (DeskProductPage board 10b, A2). */
export const LEAD_PHOTO = 344;
/** The small photos under it: 66 inside a 2-wide ring and 1 of air = 72. */
const THUMB = 66;
/** Space between the cards (A2). */
export const DESK_GAP = 24;

/**
 * หน้าสินค้า on a computer — A2, as the owner picked and changed it (DeskProductPage board 10b,
 * 5 Nov 2026): one card on top with the 1:1 photo beside the full name, its code, when it was last
 * edited, the cars it fits and its text; under it three columns, รายละเอียดอะไหล่ | สต็อก +
 * ขายออนไลน์ | ราคา (ต้นทุน first) + ลบสินค้า (the owner's only). ‹ สินค้า and แก้ไข sit above.
 * A narrow window puts the columns under each other instead of squeezing them.
 */
export function ProductDesk({ page, onDelete }: { page: ProductPage; onDelete: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = page.detail!;
  const p = d.product;
  const edited = editedLine(p.updatedAt);
  return (
    <View style={styles.page}>
      <DeskCard>
        <View style={styles.top}>
          <Photos keys={galleryKeys(p.imageKey, d.images)} />
          <View style={styles.facts}>
            <View style={styles.head}>
              <Text style={[styles.name, { color: theme.text }]} accessibilityRole="header">
                {p.name}
              </Text>
              <View>
                {p.productRef ? (
                  <CodeCopy
                    code={p.productRef}
                    style={[TYPE.subhead, { color: theme.textMuted }]}
                    onCopied={(said) => page.showToast(said)}
                  />
                ) : null}
                {edited && (
                  <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(edited)}</Text>
                )}
              </View>
            </View>
            <Rule />
            <Section title={t({ th: "ใช้ได้กับรถ", en: "Fits these cars" })}>
              <View style={styles.rows}>
                <CarLines page={page} />
              </View>
            </Section>
            <Section title={t({ th: "รายละเอียด", en: "Description" })}>
              <Text style={[TYPE.body, styles.text, { color: theme.text }]}>
                {p.description?.trim() || "—"}
              </Text>
            </Section>
          </View>
        </View>
      </DeskCard>
      <DeskColumns>
        <DeskCard title={t({ th: "รายละเอียดอะไหล่", en: "Part details" })} pad={4}>
          <DetailLines page={page} />
        </DeskCard>
        <>
          <DeskCard title={t({ th: "สต็อก", en: "Stock" })} pad={4}>
            <StockLines page={page} />
          </DeskCard>
          <DeskCard title={t({ th: "ขายออนไลน์", en: "Sold online" })} pad={4}>
            <OnlineLines page={page} />
          </DeskCard>
        </>
        <>
          <DeskCard title={t({ th: "ราคา", en: "Prices" })} pad={4}>
            <PriceLines page={page} />
          </DeskCard>
          {page.rights.deletes && (
            <DeskCard pad={4}>
              <DeleteLine onPress={onDelete} />
            </DeskCard>
          )}
        </>
      </DeskColumns>
    </View>
  );
}

/** A bold name over its rows inside the top card (ใช้ได้กับรถ, รายละเอียด). */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View>
      <Text style={[TYPE.subhead, styles.section, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

/** The thin line under the name and code in the top card (A2). */
export function Rule() {
  const { theme } = useTheme();
  return <View style={[styles.rule, { backgroundColor: theme.border }]} />;
}

/** Three even columns of cards; each child is one column. A narrow window stacks them. */
export function DeskColumns({ children }: { children: ReactNode[] }) {
  return (
    <View style={styles.columns}>
      {children.map((column, i) => (
        <View key={i} style={styles.column}>
          {column}
        </View>
      ))}
    </View>
  );
}

/** One photo big, the others small under it; a small one shows big when clicked. */
function Photos({ keys }: { keys: string[] }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [shown, setShown] = useState(0);
  const big = keys[Math.min(shown, keys.length - 1)];
  return (
    <View style={styles.photos}>
      <View style={[styles.big, { backgroundColor: theme.hover, borderColor: theme.border }]}>
        {big ? (
          <Image
            source={{ uri: `${API_BASE}/img/${big}` }}
            resizeMode="contain"
            style={styles.bigImage}
          />
        ) : null}
      </View>
      {keys.length > 1 && (
        <View style={styles.thumbs}>
          {keys.map((key, i) => (
            <Pressable
              key={key}
              onPress={() => setShown(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: i === shown }}
              accessibilityLabel={t({ th: `รูปที่ ${i + 1}`, en: `Photo ${i + 1}` })}
              style={[styles.thumb, i === shown && { borderColor: theme.text }]}
            >
              <Image
                source={{ uri: `${API_BASE}/img/${key}` }}
                style={[styles.thumbImage, { backgroundColor: theme.hover }]}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: DESK_GAP },
  // The photo and the facts side by side; the facts go under the photo when there is no room.
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 32 },
  facts: { flex: 1, minWidth: 300, gap: 14 },
  head: { gap: 6 },
  name: { fontSize: 24, lineHeight: 31, fontWeight: "600", letterSpacing: -0.2 },
  rule: { height: 1 },
  section: { fontWeight: "600", paddingTop: 4 },
  // The rows' words line up with the bold name above them.
  rows: { marginLeft: -SPACE.l },
  text: { paddingTop: SPACE.s },
  columns: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: DESK_GAP },
  column: { flex: 1, minWidth: 280, gap: DESK_GAP },
  photos: { width: LEAD_PHOTO, gap: SPACE.m },
  // Product photos are square, so the big one is too (owner, 5 Nov 2026: "product pic is 1:1").
  big: {
    width: LEAD_PHOTO,
    height: LEAD_PHOTO,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  bigImage: { width: "100%", height: "100%" },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.s },
  thumb: { borderRadius: 13, borderWidth: 2, borderColor: "transparent", padding: 1 },
  thumbImage: { width: THUMB, height: THUMB, borderRadius: 11 },
});
