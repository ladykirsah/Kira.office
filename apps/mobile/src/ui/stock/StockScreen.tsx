import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { DATE_PRESETS } from "@/lib/orderList";
import {
  MOVEMENT_KINDS,
  movementSections,
  movementSubtitle,
  noMatchDetail,
  periodLabel,
} from "@/lib/stockHistory";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { MenuButton } from "../orders/MenuButton";
import { SmallButton } from "../orders/parts";
import { RangeSheet } from "../orders/RangeSheet";
import { ScanCodeSheet } from "../products/ScanCodeSheet";
import { RoundTool, SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { KindChips } from "./KindChips";
import { MovementRow } from "./MovementRow";
import { MovementsTable } from "./MovementsTable";
import { MovementSheet } from "./MovementSheet";
import { useStockHistory, type StockHistory } from "./useStockHistory";

/**
 * ประวัติซื้อขาย (owner approved the drawing, canvas v228, 1 Nov 2026): every stock change by day,
 * newest first; search with scan beside it, the type buttons, and Orders' date button. A tap opens
 * what sold, for how much, and what is left. No แก้สต็อก here (owner: "no need many function here").
 * A computer puts search, scan and the date button in one row and each day in a table (DeskStock).
 */
export function StockScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const h = useStockHistory();
  const wide = useWide();
  // A computer shows each day as a full-width table (DeskStock board).
  useScreenChrome(null, [], { layout: "full" });
  const searchHint = t({ th: "รหัสหรือชื่อสินค้า", en: "Code or product name" });
  const dates = (
    <MenuButton
      name={t({ th: "ช่วงวันที่", en: "Dates" })}
      label={t(periodLabel(h.date, h.custom))}
      on={h.date !== "all"}
      options={DATE_PRESETS}
      value={h.date}
      onPick={(date) => (date === "custom" ? h.setSheet("range") : h.pickDate(date))}
    />
  );

  return (
    <View>
      {h.rows && h.shown && (
        <Text style={[TYPE.subhead, styles.subtitle, { color: theme.textMuted }]}>
          {t(movementSubtitle({ shown: h.shown.length, total: h.rows.length, limit: h.limit }))}
        </Text>
      )}
      <View style={styles.searchRow}>
        {wide ? (
          <View style={styles.wideSearch}>
            <SearchBox value={h.q} onChange={h.setQ} placeholder={searchHint} />
          </View>
        ) : (
          <SearchBox grow value={h.q} onChange={h.setQ} placeholder={searchHint} />
        )}
        <RoundTool
          icon={ICON.scan}
          label={t({ th: "สแกนหาสินค้า", en: "Scan a product" })}
          onPress={() => h.setSheet("scan")}
        />
        {wide && dates}
      </View>
      <KindChips value={h.kind} onPick={h.setKind} />
      {!wide && <View style={styles.menus}>{dates}</View>}
      <List h={h} wide={wide} />
      {h.sheet === "scan" && <ScanCodeSheet onClose={() => h.setSheet(null)} onCode={h.scanned} />}
      {h.sheet === "range" && (
        <RangeSheet
          range={h.custom}
          now={Date.now()}
          onApply={(range) => {
            h.pickDate("custom", range);
            h.setSheet(null);
          }}
          onClose={() => h.setSheet(null)}
        />
      )}
      {h.open && <MovementSheet m={h.open} onClose={() => h.setOpen(null)} />}
    </View>
  );
}

function List({ h, wide }: { h: StockHistory; wide: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  if (h.failed) {
    return (
      <View style={styles.retry}>
        <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>
          {t({ th: "โหลดรายการไม่ได้", en: "The list did not load" })}
        </Text>
        <SmallButton label={t({ th: "ลองอีกครั้ง", en: "Try again" })} onPress={h.reload} />
      </View>
    );
  }
  if (!h.rows || !h.shown) {
    return <ActivityIndicator style={styles.loading} color={theme.textMuted} />;
  }
  if (h.rows.length === 0) {
    return h.date === "all" ? (
      <Empty
        icon={ICON.search}
        title={t({ th: "ยังไม่มีรายการ", en: "Nothing yet" })}
        detail={t({
          th: "ขาย เติมสต็อก หรือปรับสต็อกแล้ว จะขึ้นที่นี่",
          en: "Sales, restocks and adjustments show here",
        })}
      />
    ) : (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีรายการในช่วงนี้", en: "Nothing in these dates" })}
        detail={t(periodLabel(h.date, h.custom))}
        action={
          <Link
            label={t({ th: "ดูทุกวัน", en: "Show every date" })}
            onPress={() => h.pickDate("all")}
          />
        }
      />
    );
  }
  if (h.shown.length === 0) {
    const kind = MOVEMENT_KINDS.find((k) => k.key === h.kind && k.key !== "all")?.label ?? null;
    const limited = h.rows.length >= h.limit ? h.limit : null;
    return (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่พบรายการที่ตรงกัน", en: "No matching changes" })}
        detail={t(noMatchDetail(kind, h.q, limited))}
        action={
          <Link label={t({ th: "ล้างการค้นหา", en: "Clear the search" })} onPress={h.clearSearch} />
        }
      />
    );
  }
  if (wide) {
    return (
      <View>
        {movementSections(h.shown, Date.now()).map((section) => (
          <View key={section.title.en}>
            <Text style={[styles.deskHeading, { color: theme.text }]} accessibilityRole="header">
              {t(section.title)}
            </Text>
            <MovementsTable rows={section.rows} onOpen={h.setOpen} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {movementSections(h.shown, Date.now()).map((section) => (
        <View key={section.title.en}>
          <Text style={[styles.heading, { color: theme.text }]} accessibilityRole="header">
            {t(section.title)}
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderWidth: theme.cardLine,
                borderColor: theme.border,
              },
            ]}
          >
            {section.rows.map((m, i) => (
              <MovementRow
                key={m.id}
                m={m}
                last={i === section.rows.length - 1}
                onPress={() => h.setOpen(m)}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** The red words that undo what emptied the list (as on the drawing's empty pages). */
function Link(props: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={props.onPress} accessibilityRole="button" hitSlop={8} style={styles.link}>
      <Text style={[TYPE.body, { color: theme.primary }]}>{props.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  menus: { marginTop: SPACE.l, flexDirection: "row", gap: SPACE.s },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.xxl },
  grow: { flex: 1 },
  loading: { marginTop: SPACE.xxxl },
  heading: { ...TYPE.title2, marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  deskHeading: {
    ...TYPE.headline,
    marginTop: SPACE.xl,
    marginBottom: SPACE.s + 2,
    marginHorizontal: 2,
  },
  wideSearch: { width: 320 },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  link: { marginTop: SPACE.xs },
});
