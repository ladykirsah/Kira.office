import type { Phrase } from "@l-shopee/shared/lang";
import {
  defaultPaymentMethod,
  parsePaymentMethods,
  serializePaymentMethods,
  type PaymentMethod,
} from "@l-shopee/core";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { saveShopFields, uploadShopImage } from "@/lib/shopInfoApi";
import {
  accountLine,
  blankDraft,
  changedFields,
  draftOf,
  langField,
  removeAccount,
  saveAccount,
  shownIn,
  textDraft,
  titleIn,
  type AccountDraft,
  type Bilingual,
  type ShopInfo,
  type ShopLang,
  type ShopProfile,
  type TextDraft,
} from "@/lib/shopInfoPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { Empty } from "../customers/parts";
import { DeskCard } from "../desk/DeskCard";
import { useWide } from "../desk/useWide";
import { WideButton } from "../desk/WideTools";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { pickPhoto } from "../products/pickPhoto";
import { AddRow, Divider, InputRow, Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { AccountSheet, DeleteAccountSheet } from "./AccountSheets";
import {
  Block,
  ColumnInput,
  CopyLine,
  DeskColumns,
  LangSwitch,
  PhotoChoice,
  QrThumb,
  ShopLogo,
  ValueLine,
} from "./parts";
import { useShopInfo } from "./useShopInfo";

const LIST = "/settings/shop";
const SAVE_FAILED: Phrase = { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved. Try again" };
const WRONG_PICTURE: Phrase = {
  th: "รูปต้องเป็น JPG PNG หรือ WebP ไม่เกิน 5MB",
  en: "Use a JPG, PNG or WebP up to 5MB",
};

const asProfile = (raw: string): ShopProfile | null =>
  raw === "denair" || raw === "airplus" ? raw : null;

const newAccountId = () => `pm-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * One shop (canvas v275, Apple Account): everything on one page — logo, name, address, ไทย | EN
 * (the page's one language switch, opening on the app's), ติดต่อ with copy buttons, รับเงิน, ตั้งค่าบิล,
 * and ส่งของ on AirPlus. แก้ไข turns the same page into the form; accounts open their own sheet.
 */
export function ShopScreen() {
  const { t, lang: appLang } = useLang();
  const { theme } = useTheme();
  const { profile: raw = "" } = useLocalSearchParams<{ profile: string }>();
  const profile = asProfile(raw);
  const shops = useShopInfo([profile ?? "denair"]);
  const [lang, setLang] = useState<ShopLang>(appLang);
  const [draft, setDraft] = useState<TextDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<AccountDraft | null>(null);
  const [deleting, setDeleting] = useState<AccountDraft | null>(null);
  const info = profile ? shops.shops?.[profile] : undefined;
  // A computer shows the whole shop at once in two columns (DeskShop, 5 Nov 2026).
  const wide = useWide();

  const save = async () => {
    if (!profile || !info || !draft || saving) return;
    const patch = changedFields(info, draft);
    if (Object.keys(patch).length === 0) return setDraft(null);
    setSaving(true);
    try {
      await saveShopFields(fetch, API_BASE, shops.token, profile, patch);
      shops.update(profile, patch);
      setDraft(null);
    } catch {
      shops.showToast(SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };

  const saveButton = { label: t({ th: "บันทึก", en: "Save" }), onPress: () => void save() };
  const cancelLabel = t({ th: "ยกเลิก", en: "Cancel" });
  useScreenChrome(
    null,
    // A computer's form ends in the pinned bar: ยกเลิก beside the red บันทึก (DeskShop 3).
    draft
      ? wide
        ? [saveButton, { label: cancelLabel, kind: "grey", onPress: () => setDraft(null) }]
        : [saveButton]
      : [],
    {
      back: draft
        ? wide
          ? null
          : { label: cancelLabel, plain: true, onPress: () => setDraft(null) }
        : {
            label: wide ? t({ th: "ข้อมูลร้าน", en: "Shop info" }) : "",
            onPress: () => (router.canGoBack() ? router.back() : router.replace(LIST as never)),
          },
      ownTitle: true,
      toast: shops.toast ? { title: t(shops.toast.title), detail: t(shops.toast.detail) } : null,
    },
  );

  if (!profile) {
    return (
      <Empty icon={ICON.search} title={t({ th: "ไม่มีร้านนี้", en: "No such shop" })} detail="" />
    );
  }
  if (!info) {
    return shops.failed ? (
      <Retry onPress={() => void shops.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }

  const accounts = parsePaymentMethods(info.paymentMethods);
  const saveAccounts = async (next: PaymentMethod[]) => {
    // A second quick tap on บันทึก or ลบ would add the account twice; one save at a time.
    if (saving) return;
    setSaving(true);
    const paymentMethods = serializePaymentMethods(next);
    try {
      await saveShopFields(fetch, API_BASE, shops.token, profile, { paymentMethods });
      shops.update(profile, { paymentMethods });
      setAccount(null);
      setDeleting(null);
    } catch {
      shops.showToast(SAVE_FAILED);
    } finally {
      setSaving(false);
    }
  };
  const changePicture = async (slot: "logo" | "qr", source: "camera" | "library") => {
    const photo = await pickPhoto(source);
    if (!photo) return;
    try {
      const key = await uploadShopImage(fetch, API_BASE, shops.token, profile, slot, photo);
      if (key === "wrong-picture") return shops.showToast(WRONG_PICTURE);
      shops.update(profile, slot === "logo" ? { logoKey: key } : { qrKey: key });
    } catch {
      shops.showToast(SAVE_FAILED);
    }
  };

  const shopName =
    titleIn(info, "name", lang) || (profile === "denair" ? "Den Air Service" : "AirPlus");
  const editLogo = (
    <PhotoChoice onChoose={(source) => void changePicture("logo", source)}>
      {(open) => (
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "เปลี่ยนโลโก้", en: "Change logo" })}
        >
          <ShopLogo
            profile={profile}
            logoKey={info.logoKey}
            size={96}
            change={t({ th: "เปลี่ยน", en: "Change" })}
          />
        </Pressable>
      )}
    </PhotoChoice>
  );
  const body = draft ? (
    <EditBody
      profile={profile}
      info={info}
      draft={draft}
      lang={lang}
      logo={editLogo}
      onChange={(patch) => setDraft((now) => (now ? { ...now, ...patch } : now))}
      onPicture={(source) => void changePicture("qr", source)}
    />
  ) : (
    <ViewBody
      profile={profile}
      info={info}
      lang={lang}
      accounts={accounts}
      onCopied={(said) => shops.showToast(said)}
      onAccount={(m) => setAccount(m ? draftOf(m, accounts) : blankDraft(accounts))}
    />
  );
  const sheets = (
    <>
      {account && (
        <AccountSheet
          start={account}
          onClose={() => setAccount(null)}
          onSave={(d) => void saveAccounts(saveAccount(accounts, d, newAccountId()))}
          onDelete={(d) => {
            setAccount(null);
            setDeleting(d);
          }}
        />
      )}
      {deleting && (
        <DeleteAccountSheet
          name={deleting.label}
          onClose={() => setDeleting(null)}
          onDelete={() => void saveAccounts(removeAccount(accounts, deleting.id ?? ""))}
        />
      )}
    </>
  );

  if (wide) {
    // DeskShop 2–3: the logo, name and address on one line with ไทย | EN and แก้ไข at its end.
    return (
      <View>
        <View style={styles.deskHead}>
          {!draft && <ShopLogo profile={profile} logoKey={info.logoKey} size={72} />}
          <View style={styles.grow}>
            <Text style={[styles.deskTitle, { color: theme.text }]} accessibilityRole="header">
              {draft ? t({ th: "แก้ไขข้อมูลร้าน", en: "Edit shop info" }) : shopName}
            </Text>
            {!draft && (
              <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                {titleIn(info, "address", lang)}
              </Text>
            )}
          </View>
          <LangSwitch value={lang} onChange={setLang} />
          {!draft && (
            <WideButton
              button={{
                label: t({ th: "แก้ไข", en: "Edit" }),
                icon: "",
                onPress: () => setDraft(textDraft(info)),
              }}
            />
          )}
        </View>
        {body}
        {sheets}
      </View>
    );
  }

  return (
    <View>
      {/* The strip lies over the frame's ‹ / ยกเลิก: only แก้ไข takes a tap, the rest lets it through. */}
      <View style={styles.top} pointerEvents="box-none">
        <View pointerEvents="none">
          <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
            {draft
              ? t({ th: "แก้ไขข้อมูลร้าน", en: "Edit shop info" })
              : t({ th: "ข้อมูลร้าน", en: "Shop info" })}
          </Text>
        </View>
        {!draft && (
          <Pressable
            onPress={() => setDraft(textDraft(info))}
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

      <View style={styles.hero}>
        {draft ? editLogo : <ShopLogo profile={profile} logoKey={info.logoKey} size={96} />}
        {!draft && (
          <>
            <Text style={[TYPE.title1, styles.center, styles.name, { color: theme.text }]}>
              {shopName}
            </Text>
            <Text style={[TYPE.subhead, styles.center, { color: theme.textMuted }]}>
              {titleIn(info, "address", lang)}
            </Text>
          </>
        )}
        <View style={styles.lang}>
          <LangSwitch value={lang} onChange={setLang} />
        </View>
      </View>

      {body}

      {sheets}
    </View>
  );
}

/** The page as read: every value, copy buttons on ติดต่อ, accounts to tap. */
function ViewBody(props: {
  profile: ShopProfile;
  info: ShopInfo;
  lang: ShopLang;
  accounts: PaymentMethod[];
  onCopied: (said: Phrase) => void;
  onAccount: (m: PaymentMethod | null) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { info, lang } = props;
  const defaultId = defaultPaymentMethod(props.accounts)?.id;
  const bill = (key: Bilingual) => shownIn(info, key, lang);
  const contact = (
    <Block title={t({ th: "ติดต่อ", en: "Contact" })}>
      <CopyLine
        label={t({ th: "เบอร์โทร", en: "Phone" })}
        what={{ th: "เบอร์โทร", en: "phone number" }}
        value={info.phone}
        onCopied={props.onCopied}
      />
      <CopyLine
        label={t({ th: "ลิงก์ LINE OA", en: "LINE OA link" })}
        what={{ th: "ลิงก์ LINE OA", en: "LINE OA link" }}
        value={info.lineUrl}
        onCopied={props.onCopied}
      />
      <Line
        label={t({ th: "QR ติดต่อ", en: "Contact QR" })}
        right={<QrThumb qrKey={info.qrKey} />}
      />
      <CopyLine
        label="Linktree"
        what={{ th: "ลิงก์ Linktree", en: "Linktree link" }}
        value={info.linktreeUrl}
        onCopied={props.onCopied}
        last
      />
    </Block>
  );
  const pay = (
    <Block title={t({ th: "รับเงิน", en: "Payments" })}>
      {props.accounts.length === 0 && (
        <Line label={t({ th: "ยังไม่มีบัญชีรับเงิน", en: "No payment account yet" })} />
      )}
      {props.accounts.map((m) => (
        <View key={m.id}>
          <Pressable
            onPress={() => props.onAccount(m)}
            accessibilityRole="button"
            style={styles.account}
          >
            <View style={styles.grow}>
              <Text style={[TYPE.body, { color: theme.text }]}>{m.label}</Text>
              <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                {t(accountLine(m, m.id === defaultId))}
              </Text>
            </View>
            <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
          </Pressable>
          <Divider />
        </View>
      ))}
      <AddRow
        label={t({ th: "เพิ่มบัญชี", en: "Add account" })}
        onPress={() => props.onAccount(null)}
      />
    </Block>
  );
  const billSetup = (
    <Block title={t({ th: "ตั้งค่าบิล", en: "Bill setup" })}>
      <ValueLine label={t({ th: "หัวข้อใต้ QR", en: "Under the QR" })} value={bill("qrHeadline")} />
      <ValueLine
        label={t({ th: "ข้อความรอง", en: "Second line" })}
        value={bill("qrSubtitle")}
        last={props.profile !== "denair"}
      />
      {props.profile === "denair" && (
        <ValueLine
          label={t({ th: "หมายเหตุท้ายใบ", en: "Footer note" })}
          value={bill("quoteNote")}
          last
        />
      )}
    </Block>
  );
  const ship = props.profile === "airplus" && (
    <Block title={t({ th: "ส่งของ", en: "Shipping" })}>
      <ValueLine
        label={t({ th: "รหัสไปรษณีย์ผู้ส่ง", en: "Sender postcode" })}
        value={info.shipFromPostcode}
      />
      <ValueLine
        label={t({ th: "เบอร์ผู้ส่ง", en: "Sender phone" })}
        value={info.shipFromPhone}
        last
      />
    </Block>
  );
  // A computer: ติดต่อ and รับเงิน on the left, ตั้งค่าบิล and ส่งของ on the right (DeskShop 2).
  return (
    <DeskColumns
      columns={[
        <>
          {contact}
          {pay}
        </>,
        <>
          {billSetup}
          {ship}
        </>,
      ]}
    />
  );
}

/** The same page as the form: the boxes of the language switched to, and เปลี่ยน on the QR. */
function EditBody(props: {
  profile: ShopProfile;
  info: ShopInfo;
  draft: TextDraft;
  lang: ShopLang;
  /** The logo with its เปลี่ยน band: a computer shows it in its own card (DeskShop 3). */
  logo: ReactNode;
  onChange: (patch: Partial<TextDraft>) => void;
  onPicture: (source: "camera" | "library") => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const wide = useWide();
  const { draft, lang } = props;
  const empty = t({ th: "ยังไม่ได้ใส่", en: "Not set" });
  const box = (
    label: Phrase,
    key: keyof TextDraft,
    last?: boolean,
    keyboardType?: "phone-pad" | "number-pad",
  ) => (
    <InputRow
      label={t(label)}
      value={draft[key]}
      placeholder={empty}
      keyboardType={keyboardType}
      onChange={(v) => props.onChange({ [key]: v })}
      last={last}
    />
  );
  const both = (label: Phrase, key: Bilingual, last?: boolean) =>
    box(label, langField(key, lang), last);
  const nameRows = (
    <>
      {both({ th: "ชื่อร้าน", en: "Shop name" }, "name")}
      <ColumnInput
        label={t({ th: "ที่อยู่", en: "Address" })}
        value={draft[langField("address", lang)]}
        placeholder={empty}
        onChange={(v) => props.onChange({ [langField("address", lang)]: v })}
        last
      />
    </>
  );
  const names = wide ? (
    <DeskCard pad={4}>{nameRows}</DeskCard>
  ) : (
    <View style={styles.firstGroup}>
      <Group>{nameRows}</Group>
    </View>
  );
  const logo = wide && (
    <DeskCard title={t({ th: "โลโก้", en: "Logo" })}>
      <View style={styles.logoCard}>{props.logo}</View>
    </DeskCard>
  );
  const contact = (
    <Block title={t({ th: "ติดต่อ", en: "Contact" })}>
      {box({ th: "เบอร์โทร", en: "Phone" }, "phone", false, "phone-pad")}
      {box({ th: "ลิงก์ LINE OA", en: "LINE OA link" }, "lineUrl")}
      <Line
        label={t({ th: "QR ติดต่อ", en: "Contact QR" })}
        right={
          <View style={styles.qrRight}>
            <QrThumb qrKey={props.info.qrKey} />
            <PhotoChoice onChoose={props.onPicture}>
              {(open) => (
                <Pressable
                  onPress={open}
                  accessibilityRole="button"
                  style={[styles.change, { backgroundColor: theme.hover }]}
                >
                  <Text style={[TYPE.subhead, { color: theme.text }]}>
                    {t({ th: "เปลี่ยน", en: "Change" })}
                  </Text>
                </Pressable>
              )}
            </PhotoChoice>
          </View>
        }
      />
      {box({ th: "Linktree", en: "Linktree" }, "linktreeUrl", true)}
    </Block>
  );
  const billSetup = (
    <Block title={t({ th: "ตั้งค่าบิล", en: "Bill setup" })}>
      {both({ th: "หัวข้อใต้ QR", en: "Under the QR" }, "qrHeadline")}
      {both({ th: "ข้อความรอง", en: "Second line" }, "qrSubtitle", props.profile !== "denair")}
      {props.profile === "denair" &&
        both({ th: "หมายเหตุท้ายใบ", en: "Footer note" }, "quoteNote", true)}
    </Block>
  );
  const ship = props.profile === "airplus" && (
    <Block title={t({ th: "ส่งของ", en: "Shipping" })}>
      {box(
        { th: "รหัสไปรษณีย์ผู้ส่ง", en: "Sender postcode" },
        "shipFromPostcode",
        false,
        "number-pad",
      )}
      {box({ th: "เบอร์ผู้ส่ง", en: "Sender phone" }, "shipFromPhone", true, "phone-pad")}
    </Block>
  );
  // A computer: the name, address and ติดต่อ on the wider left; โลโก้, ตั้งค่าบิล, ส่งของ on the right.
  return (
    <DeskColumns
      flex={[1.4, 1]}
      columns={[
        <>
          {names}
          {contact}
        </>,
        <>
          {logo}
          {billSetup}
          {ship}
        </>,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  // The frame's back pill is 36 tall with 8 under it; the title and แก้ไข sit on its line.
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
  hero: { marginTop: SPACE.m, alignItems: "center" },
  name: { marginTop: 14 },
  center: { textAlign: "center", paddingHorizontal: SPACE.m },
  lang: { marginTop: 14 },
  firstGroup: { marginTop: SPACE.xl },
  account: {
    minHeight: 52,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  grow: { flex: 1, minWidth: 0 },
  qrRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  deskHead: { flexDirection: "row", alignItems: "center", gap: SPACE.l },
  deskTitle: { fontSize: 28, lineHeight: 35, fontWeight: "600" },
  logoCard: { alignItems: "center", paddingVertical: SPACE.xs },
  change: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: "center" },
});
