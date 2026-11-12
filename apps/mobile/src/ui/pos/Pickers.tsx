import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { searchParts } from "@/lib/posApi";
import { pickOnEnter } from "@/lib/posPage";
import { lookupPart } from "@/lib/scanApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { CameraBox } from "../scan/CameraBox";
import { RADIUS, SPACE, TYPE } from "../theme";
import { FieldRow, Note } from "./fields";
import { usePos } from "./PosSessionProvider";
import { CodeCopy } from "../CodeCopy";
import { rowSizeCode } from "@/lib/sizeLine";

/** How many matches the list draws at once; the count above it is always the full number. */
const SHOWN = 60;

/**
 * เพิ่มสินค้า's body — search by name or code, or scan. Sold-out parts never show. A phone shows it
 * in a sheet; a computer keeps it open beside the bill, where a USB scanner types into the search
 * box and Enter adds the one match or looks the code up (`desk`, DeskPos board).
 */
export function PartPicker({ desk = false }: { desk?: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const pos = usePos();
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState(false);
  const found = searchParts(pos.data.products, query);

  const onCode = async (code: string) => {
    setCamera(false);
    const token = auth.status === "signed-in" ? auth.token : "";
    try {
      const part = await lookupPart(fetch, API_BASE, token, code);
      const row = part && pos.data.products.find((p) => p.variantId === part.variantId);
      if (!part || !row) {
        pos.showToast({ th: "ไม่พบสินค้า", en: "No such part" }, { th: code, en: code });
      } else if (part.onHand <= 0) {
        pos.showToast(
          { th: "สินค้าหมด", en: "Sold out" },
          { th: `${row.name} · ไม่เพิ่มเข้าบิล`, en: `${row.name} · not added` },
        );
      } else {
        pos.addPart({ ...row, onHand: part.onHand });
      }
    } catch {
      pos.showToast(
        { th: "สแกนไม่ได้", en: "Scan failed" },
        { th: "ไม่มีเน็ต ค้นด้วยชื่อแทน", en: "No internet; search by name instead" },
      );
    }
  };

  // Enter on a computer: the one match goes on the bill, no match is a barcode to look up.
  const onEnter = () => {
    const pick = pickOnEnter(found, query);
    if (pick.kind === "none") return;
    setQuery("");
    if (pick.kind === "add") pos.addPart(pick.row);
    else void onCode(pick.code);
  };

  return (
    <>
      <View
        style={[
          styles.search,
          {
            backgroundColor: theme.surface,
            borderWidth: theme.cardLine,
            borderColor: theme.border,
          },
        ]}
      >
        <LineIcon d={ICON.search} color={theme.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={desk ? onEnter : undefined}
          blurOnSubmit={desk ? false : undefined}
          placeholder={t({ th: "ชื่อ หรือรหัสสินค้า", en: "Name or code" })}
          placeholderTextColor={theme.textFaint}
          autoFocus
          accessibilityLabel={t({ th: "ค้นหาสินค้า", en: "Search parts" })}
          style={[TYPE.body, styles.searchInput, { color: theme.text }]}
        />
        <Pressable
          onPress={() => setCamera((c) => !c)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "สแกน", en: "Scan" })}
          hitSlop={8}
        >
          <LineIcon d={ICON.scan} color={theme.text} size={20} />
        </Pressable>
      </View>
      {camera && <CameraBox height={142} showHint={false} onCode={(c) => void onCode(c)} />}
      <Text style={[TYPE.subhead, styles.count, { color: theme.text }]}>
        {t({ th: `พบ ${found.length} รายการ`, en: `${found.length} found` })}
      </Text>
      {found.length > 0 && (
        <Group>
          {found.slice(0, SHOWN).map((p, i) => (
            <View
              key={p.variantId ?? p.id}
              style={[
                styles.result,
                i < Math.min(found.length, SHOWN) - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              {p.imageKey ? (
                <Image
                  source={{ uri: `${API_BASE}/img/${p.imageKey}` }}
                  style={[styles.thumb, { backgroundColor: theme.bg }]}
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: theme.bg }]} />
              )}
              {/* You pick here, so the full name: regular, 2 lines …, then the code, then the stock ·
                  the price (owner, 4 Nov 2026: "name · id · [stock] dot [price]"). */}
              <View style={styles.grow}>
                <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
                  {p.name}
                </Text>
                {rowSizeCode(p).code ? (
                  <CodeCopy
                    code={rowSizeCode(p).code!}
                    tag={rowSizeCode(p).tag}
                    style={[TYPE.subhead, { color: theme.textMuted }]}
                  />
                ) : null}
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                  {t({ th: `เหลือ ${p.onHand} · `, en: `${p.onHand} left · ` })}
                  <Text style={{ color: theme.text }}>{formatBaht(p.offlinePriceSatang)}</Text>
                </Text>
              </View>
              <Pressable
                onPress={() => pos.addPart(p)}
                accessibilityRole="button"
                accessibilityLabel={t({ th: `เพิ่ม ${p.name}`, en: `Add ${p.name}` })}
                style={[styles.plus, { backgroundColor: theme.hover }]}
              >
                <LineIcon d={ICON.plus} color={theme.text} size={16} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
        </Group>
      )}
      <Note>
        {t({
          th: "สินค้าที่หมด (เหลือ 0) ไม่ขึ้นในรายการ · สแกนตัวที่หมดจะบอกว่าหมด ไม่เพิ่มเข้าบิล",
          en: "Sold-out parts never show · scanning one says so and adds nothing",
        })}
      </Note>
    </>
  );
}

/** เพิ่มบริการ's body — one of the shop's services, or a line typed in (no stock either way). */
export function ServicePicker() {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addTyped = () => {
    const baht = parseFloat(price.replace(/,/g, ""));
    if (!name.trim()) return setError(t({ th: "ใส่ชื่อรายการ", en: "Enter a name" }));
    if (!(baht >= 0)) return setError(t({ th: "ใส่ราคา", en: "Enter a price" }));
    pos.addService({ name: name.trim(), priceSatang: Math.round(baht * 100) });
    setName("");
    setPrice("");
    setError(null);
  };
  return (
    <>
      <Text style={[TYPE.subhead, styles.label, { color: theme.text }]}>
        {t({ th: "บริการของร้าน", en: "The shop's services" })}
      </Text>
      <Group>
        {pos.data.services.map((s, i) => {
          const name = lang === "en" && s.nameEn ? s.nameEn : s.name;
          return (
            <View
              key={s.id}
              style={[
                styles.result,
                i < pos.data.services.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{name}</Text>
              <Text style={[TYPE.body, { color: theme.textMuted }]}>
                {formatBaht(s.basePriceSatang)}
              </Text>
              <Pressable
                onPress={() => pos.addService({ name: s.name, priceSatang: s.basePriceSatang })}
                accessibilityRole="button"
                accessibilityLabel={t({ th: `เพิ่ม ${name}`, en: `Add ${name}` })}
                style={[styles.plus, { backgroundColor: theme.hover }]}
              >
                <LineIcon d={ICON.plus} color={theme.text} size={16} strokeWidth={2.4} />
              </Pressable>
            </View>
          );
        })}
      </Group>
      <Text style={[TYPE.subhead, styles.label, { color: theme.text }]}>
        {t({ th: "รายการอื่น (พิมพ์เอง)", en: "Something else (type it)" })}
      </Text>
      <Group>
        <FieldRow
          label={t({ th: "ชื่อรายการ", en: "Name" })}
          value={name}
          placeholder={t({ th: "เช่น ค่าเดินทาง", en: "e.g. Travel" })}
          onChange={setName}
        />
        <FieldRow
          label={t({ th: "ราคา ฿", en: "Price ฿" })}
          value={price}
          placeholder="0"
          keyboardType="decimal-pad"
          onChange={setPrice}
          error={error}
          last
        />
      </Group>
      <BigButton label={t({ th: "เพิ่มรายการนี้", en: "Add it" })} kind="grey" onPress={addTyped} />
      <Note>
        {t({
          th: "บริการและรายการอื่นไม่ตัดสต็อก · ราคาแก้ได้ในบิล",
          en: "Services take no stock · the price can change on the bill",
        })}
      </Note>
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 44,
    borderRadius: RADIUS.field,
    paddingHorizontal: SPACE.m,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  searchInput: { flex: 1, minWidth: 0, outlineStyle: "none" } as never,
  count: { fontWeight: "600", marginHorizontal: SPACE.xs },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: 10,
  },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  grow: { flex: 1, minWidth: 0 },
  plus: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  label: { fontWeight: "600", marginHorizontal: SPACE.xs },
});
