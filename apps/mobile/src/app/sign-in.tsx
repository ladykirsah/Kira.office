import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE, isLocalApi } from "@/lib/config";
import { phoneBottoms } from "@/lib/frame";
import { shortcutTarget } from "@/lib/shortcut";
import type { Credentials } from "@/lib/signIn";
import { signInMessage } from "@/lib/signInMessage";
import {
  forgotLabel,
  keyProblem,
  langSwitchLabel,
  mailProblems,
  pinProblem,
  type SignInTab,
} from "@/lib/signInPage";
import { useAuth, useLang, useTheme } from "@/ui/AppProviders";
import { BigButton } from "@/ui/BigButton";
import { useBrandFont } from "@/ui/brandFont";
import { Group } from "@/ui/orders/parts";
import { Sheet } from "@/ui/orders/Sheet";
import { StepRow } from "@/ui/partsSetup/parts";
import { PinnedFooter, pinnedHeight } from "@/ui/PinnedFooter";
import { FieldError } from "@/ui/pos/fields";
import { InputRow } from "@/ui/products/parts";
import { NO_CHROME, type Chrome } from "@/ui/ScreenChrome";
import { Segmented } from "@/ui/Segmented";
import { PillButton } from "@/ui/staff/parts";
import { SPACE, TYPE } from "@/ui/theme";

/**
 * เข้าใช้งาน as drawn (canvas LoginPhone v328, 3 Nov 2026): the name, a รหัส 6 หลัก | อีเมล switch,
 * the red เข้าใช้งาน pinned at the bottom with ลืมรหัส? under it, the emergency key behind ลืมรหัส?,
 * and — on a practice copy only — the no-password door. Each door answers in its own place.
 */
const PRACTICE = isLocalApi(API_BASE);
type Door = "form" | "key";

export default function SignIn() {
  const auth = useAuth();
  const { lang, t, toggleLang } = useLang();
  const { theme } = useTheme();
  const brandFont = useBrandFont();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<SignInTab>("pin");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [error, setError] = useState<{ door: Door; text: string } | null>(null);
  const busy = useRef(false);
  // The owner's shortcut (this computer only): /sign-in?practice=1 goes straight in, to Scan.
  const shortcut = shortcutTarget(API_BASE, useLocalSearchParams());
  const shortcutTried = useRef(false);
  useEffect(() => {
    if (!shortcut || shortcutTried.current || auth.status !== "signed-out") return;
    shortcutTried.current = true;
    void attempt("form", { kind: "practice" });
  });

  if (auth.status === "signed-in") return <Redirect href={(shortcut ?? "/") as never} />;

  async function attempt(door: Door, c: Credentials) {
    if (busy.current) return; // two quick taps sign in once
    busy.current = true;
    setError(null);
    const result = await auth.signInWith(c);
    busy.current = false;
    if (!result.ok) setError({ door, text: t(signInMessage(c.kind, result.failure)) });
  }

  // Typing again takes the server's answer away; the empty-box lines follow what is typed.
  const typed = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
  };

  function signIn() {
    setTried(true);
    if (tab === "pin") {
      if (!pinProblem(pin)) void attempt("form", { kind: "pin", pin });
    } else if (mailProblems(email, password).length === 0) {
      void attempt("form", { kind: "password", email: email.trim(), password });
    }
  }

  const pinLine = tried && tab === "pin" ? pinProblem(pin) : null;
  const mailLines = tried && tab === "password" ? mailProblems(email, password) : [];
  const serverLine = error?.door === "form" ? error.text : null;
  const chrome: Chrome = {
    ...NO_CHROME,
    footer: [
      { label: t({ th: "เข้าใช้งาน", en: "Sign in" }), onPress: signIn },
      { label: t(forgotLabel(tab)), kind: "grey", onPress: () => setForgot(true) },
    ],
  };
  const bottoms = phoneBottoms({
    bar: "none",
    insetBottom: insets.bottom,
    pinned: pinnedHeight(chrome),
  });

  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACE.s, paddingBottom: bottoms.content },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {PRACTICE && (
          <View style={[styles.practice, { backgroundColor: theme.surface }]}>
            <View style={[styles.dot, { backgroundColor: theme.waiting }]} />
            <Text style={[TYPE.subhead, { color: theme.text, flex: 1 }]}>
              {t({
                th: "เครื่องซ้อมในคอมนี้ · ไม่ใช่ข้อมูลร้านจริง",
                en: "Practice copy · not the shop's real data",
              })}
            </Text>
          </View>
        )}
        <View style={styles.langRow}>
          <PillButton label={langSwitchLabel(lang)} onPress={toggleLang} />
        </View>
        <Text style={[TYPE.title1, styles.center, { color: theme.text }, brandFont]}>
          CrewEngine
        </Text>
        <Text style={[TYPE.subhead, styles.center, styles.sub, { color: theme.textMuted }]}>
          Den Air Service + AirPlus
        </Text>

        <View style={styles.switch}>
          <Segmented
            label={t({ th: "เข้าใช้งานด้วย", en: "Sign in with" })}
            options={[
              { value: "pin", label: t({ th: "รหัส 6 หลัก", en: "PIN" }) },
              { value: "password", label: t({ th: "อีเมล", en: "Email" }) },
            ]}
            value={tab}
            onChange={(v) => {
              setTab(v);
              setTried(false);
              setError(null);
            }}
          />
        </View>

        {tab === "pin" ? (
          <>
            <PinBoxes value={pin} onChange={typed(setPin)} />
            {(pinLine || serverLine) && (
              <Text
                accessibilityRole="alert"
                style={[TYPE.footnote, styles.center, styles.pinError, { color: theme.danger }]}
              >
                {pinLine ? t(pinLine) : serverLine}
              </Text>
            )}
          </>
        ) : (
          <>
            <Group>
              <InputRow
                label={t({ th: "อีเมล", en: "Email" })}
                value={email}
                placeholder={t({ th: "ชื่อ@อีเมล.com", en: "name@email.com" })}
                keyboardType="email-address"
                autoComplete="email"
                onChange={typed(setEmail)}
              />
              <InputRow
                label={t({ th: "รหัสผ่าน", en: "Password" })}
                value={password}
                placeholder={t({ th: "รหัสผ่าน", en: "Password" })}
                secure
                autoComplete="password"
                onChange={typed(setPassword)}
                last
              />
            </Group>
            {mailLines.map((p) => (
              <FieldError key={p.en} text={t(p)} />
            ))}
            {serverLine && <FieldError text={serverLine} />}
          </>
        )}

        {PRACTICE && (
          <View style={styles.practiceDoor}>
            <Group>
              <StepRow
                label={t({ th: "เข้าเครื่องซ้อม", en: "Sign in to the practice copy" })}
                second={t({ th: "ไม่ต้องใช้รหัส", en: "No password" })}
                onPress={() => void attempt("form", { kind: "practice" })}
              />
            </Group>
          </View>
        )}
      </ScrollView>

      <PinnedFooter chrome={chrome} bottom={bottoms.footer} />

      {forgot && (
        <ForgotSheet
          error={error?.door === "key" ? error.text : null}
          onKey={(key) => void attempt("key", { kind: "key", key })}
          clearError={() => setError(null)}
          onClose={() => {
            setForgot(false);
            setError(null);
          }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * Six boxes in two groups of three — how people say a PIN out loud. One hidden input carries the
 * digits, so the phone's number pad, paste and one-time-code autofill all just work. The next box to
 * fill is ringed while the pad is up.
 */
function PinBoxes(props: { value: string; onChange: (v: string) => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityRole="none" style={styles.pins}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={[
            styles.pinBox,
            { backgroundColor: theme.surface },
            i === 2 && styles.pinGroupEnd,
            focused && i === props.value.length && { borderColor: theme.text },
          ]}
        >
          {i < props.value.length && (
            <View style={[styles.pinDot, { backgroundColor: theme.text }]} />
          )}
        </View>
      ))}
      <TextInput
        ref={input}
        value={props.value}
        onChangeText={(v) => props.onChange(v.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        accessibilityLabel={t({ th: "รหัส 6 หลัก", en: "PIN" })}
        style={styles.pinInput}
      />
    </Pressable>
  );
}

/**
 * ลืมรหัส?: the owner sets a new PIN in พนักงาน; the owner alone, locked out, uses the emergency key —
 * a step inside the same sheet ("‹ ลืมรหัส").
 */
function ForgotSheet(props: {
  error: string | null;
  onKey: (key: string) => void;
  /** Typing a new key, or stepping back, takes the last answer away. */
  clearError: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [step, setStep] = useState<"help" | "key">("help");
  const [key, setKey] = useState("");
  const [tried, setTried] = useState(false);
  if (step === "help") {
    return (
      <Sheet title={t({ th: "ลืมรหัส", en: "Forgot your PIN" })} onClose={props.onClose}>
        <Group>
          <View style={styles.help}>
            <Text style={[TYPE.body, { color: theme.text }]}>
              {t({ th: "ให้เจ้าของร้านตั้งรหัสใหม่ให้", en: "Ask the owner to set a new one" })}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
              {t({
                th: "เมนู พนักงาน → ชื่อคุณ → รหัส 6 หลัก",
                en: "Menu: Staff → your name → PIN",
              })}
            </Text>
          </View>
        </Group>
        <Group>
          <StepRow
            label={t({ th: "ใช้กุญแจฉุกเฉิน", en: "Use the emergency key" })}
            second={t({
              th: "เจ้าของร้าน เมื่อเข้าไม่ได้เลย",
              en: "For the owner, when nothing else works",
            })}
            onPress={() => setStep("key")}
          />
        </Group>
      </Sheet>
    );
  }
  const keyLine = tried ? keyProblem(key) : null;
  return (
    <Sheet
      title={t({ th: "กุญแจฉุกเฉิน", en: "Emergency key" })}
      left={{
        label: t({ th: "‹ ลืมรหัส", en: "‹ Forgot" }),
        onPress: () => {
          setStep("help");
          props.clearError();
        },
      }}
      onClose={props.onClose}
    >
      <Group>
        <InputRow
          label={t({ th: "กุญแจ", en: "Key" })}
          value={key}
          placeholder={t({ th: "วางกุญแจที่เก็บไว้", en: "Paste the key you kept" })}
          secure
          onChange={(v) => {
            setKey(v);
            props.clearError();
          }}
          last
        />
      </Group>
      {keyLine && <FieldError text={t(keyLine)} />}
      {props.error && <FieldError text={props.error} />}
      <BigButton
        label={t({ th: "เข้าใช้งานด้วยกุญแจ", en: "Sign in with the key" })}
        onPress={() => {
          setTried(true);
          if (!keyProblem(key)) props.onKey(key);
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: SPACE.l },
  center: { textAlign: "center" },
  practice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: SPACE.m,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  langRow: {
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: SPACE.xxl,
  },
  sub: { marginTop: SPACE.xs },
  switch: { marginTop: SPACE.xxl, marginBottom: SPACE.xl },
  pins: { flexDirection: "row", justifyContent: "center", gap: SPACE.s },
  pinBox: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  pinGroupEnd: { marginRight: SPACE.m },
  pinDot: { width: 12, height: 12, borderRadius: 6 },
  pinInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
  pinError: { marginTop: SPACE.m, paddingHorizontal: SPACE.l },
  practiceDoor: { marginTop: SPACE.xxl },
  help: { paddingVertical: SPACE.m, paddingHorizontal: SPACE.l },
});
