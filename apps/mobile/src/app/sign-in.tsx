import { Redirect } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
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
import type { Credentials } from "@/lib/signIn";
import { signInMessage } from "@/lib/signInMessage";
import { useAuth, useLang, useTheme } from "@/ui/AppProviders";
import type { Theme } from "@/ui/theme";

/**
 * The web back office's sign-in card, rebuilt for the app: PIN or password, the emergency key under
 * its own rule, and — on a practice copy only — the one-click door. Each door answers in its own
 * place (apps/admin/src/app/login/loginError.ts explains why that matters).
 */
const PRACTICE = isLocalApi(API_BASE);

export default function SignIn() {
  const auth = useAuth();
  const { lang, t, toggleLang } = useLang();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const s = styles(theme);

  const [method, setMethod] = useState<"pin" | "password">("pin");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ door: "form" | "key"; text: string } | null>(null);

  if (auth.status === "signed-in") return <Redirect href="/" />;

  async function attempt(door: "form" | "key", c: Credentials) {
    setBusy(true);
    setError(null);
    const result = await auth.signInWith(c);
    setBusy(false);
    if (!result.ok) setError({ door, text: t(signInMessage(c.kind, result.failure)) });
  }

  const canSubmit =
    !busy && (method === "pin" ? /^\d{6}$/.test(pin) : email.trim() !== "" && password !== "");

  return (
    <KeyboardAvoidingView
      style={[s.page, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {PRACTICE && (
        <Text style={s.practiceBanner}>
          ⚠ PRACTICE COPY — this is not the real shop. It runs on this computer with its own
          separate database, so its products, orders and staff passwords are its own and do not
          match the real ones. The real back office is at admin.airplusauto.com.
        </Text>
      )}
      <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
        <View style={s.box}>
          <View style={s.langRow}>
            <Pressable
              onPress={toggleLang}
              accessibilityRole="button"
              accessibilityLabel={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
              style={s.iconButton}
            >
              <Text style={{ fontSize: 16 }}>{lang === "th" ? "🇬🇧" : "🇹🇭"}</Text>
            </Pressable>
          </View>
          <Text style={s.title}>Kira.office</Text>
          <Text style={s.subtitle}>
            {t({
              th: "ระบบหลังร้าน Den Air Service + AirPlus",
              en: "Den Air Service + AirPlus back office",
            })}
          </Text>

          <View style={s.card}>
            <View style={s.tabs} accessibilityRole="tablist">
              {(["pin", "password"] as const).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => {
                    setMethod(m);
                    setError(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: method === m }}
                  style={[s.tab, method === m && s.tabOn]}
                >
                  <Text style={[s.tabText, method === m && s.tabTextOn]}>
                    {m === "pin"
                      ? t({ th: "รหัส 6 หลัก", en: "PIN" })
                      : t({ th: "รหัสผ่าน", en: "Password" })}
                  </Text>
                </Pressable>
              ))}
            </View>

            {method === "pin" ? (
              <View>
                <Text style={s.label}>{t({ th: "รหัส 6 หลัก", en: "6-digit PIN" })}</Text>
                <PinBoxes value={pin} onChange={setPin} theme={theme} />
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={s.label}>{t({ th: "อีเมล", en: "Email" })}</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    style={s.input}
                  />
                </View>
                <View>
                  <Text style={s.label}>{t({ th: "รหัสผ่าน", en: "Password" })}</Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoComplete="password"
                    style={s.input}
                  />
                </View>
              </View>
            )}

            {error?.door === "form" && <Text style={s.error}>{error.text}</Text>}

            <Pressable
              disabled={!canSubmit}
              onPress={() =>
                void attempt(
                  "form",
                  method === "pin"
                    ? { kind: "pin", pin }
                    : { kind: "password", email: email.trim(), password },
                )
              }
              accessibilityRole="button"
              style={[s.primary, !canSubmit && s.primaryDisabled]}
            >
              {busy && !showKey ? (
                <ActivityIndicator color={theme.onPrimary} />
              ) : (
                <Text style={s.primaryText}>{t({ th: "เข้าใช้งาน", en: "Sign in" })}</Text>
              )}
            </Pressable>

            <View style={s.rule} />
            {showKey ? (
              <View style={{ gap: 10 }}>
                <Text style={s.label}>{t({ th: "กุญแจฉุกเฉิน", en: "Emergency key" })}</Text>
                <TextInput
                  value={key}
                  onChangeText={setKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={s.input}
                />
                {error?.door === "key" && <Text style={s.error}>{error.text}</Text>}
                <Pressable
                  disabled={busy || key === ""}
                  onPress={() => void attempt("key", { kind: "key", key })}
                  accessibilityRole="button"
                  style={[s.primary, (busy || key === "") && s.primaryDisabled]}
                >
                  <Text style={s.primaryText}>
                    {t({ th: "เข้าใช้งานด้วยกุญแจ", en: "Sign in with the key" })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowKey(false);
                    setKey("");
                    setError(null);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={s.linkCentered}>{t({ th: "ยกเลิก", en: "Cancel" })}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => setShowKey(true)} accessibilityRole="button">
                <Text style={[s.linkCentered, s.underline]}>
                  {t({ th: "ทางเข้าฉุกเฉิน", en: "Emergency entrance" })}
                </Text>
              </Pressable>
            )}

            {PRACTICE && (
              <>
                <View style={s.rule} />
                <Pressable
                  disabled={busy}
                  onPress={() => void attempt("form", { kind: "practice" })}
                  accessibilityRole="button"
                  style={s.secondary}
                >
                  <Text style={s.secondaryText}>
                    {t({ th: "เข้าใช้งานเครื่องซ้อม", en: "Sign in to the practice copy" })}
                  </Text>
                </Pressable>
                <Text style={s.note}>
                  {t({
                    th: "ไม่ต้องใช้รหัส — เครื่องนี้รันอยู่บนคอมของคุณ และไม่มีข้อมูลจริง",
                    en: "No password — this copy runs on your computer and holds no real data.",
                  })}
                </Text>
              </>
            )}
          </View>

          <Text style={s.footer}>
            {t({
              th: "ลืมรหัสผ่าน? ให้เจ้าของร้านตั้งให้ใหม่",
              en: "Forgotten your password? Ask the owner to set a new one.",
            })}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Six boxes in two groups of three — how people say a PIN out loud. One hidden input carries the
 * digits, so the phone's number pad, paste and one-time-code autofill all just work.
 */
function PinBoxes(props: { value: string; onChange: (v: string) => void; theme: Theme }) {
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const s = styles(props.theme);
  const digits = props.value.padEnd(6, " ").split("");
  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityRole="none" style={s.pinRow}>
      {digits.map((d, i) => (
        <View key={i} style={[s.pinBox, i === 2 && { marginRight: 14 }]}>
          <Text style={s.pinDigit}>{d.trim() === "" ? "" : "•"}</Text>
        </View>
      ))}
      <TextInput
        ref={input}
        value={props.value}
        onChangeText={(v) => props.onChange(v.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={6}
        autoFocus
        accessibilityLabel="PIN"
        style={s.pinInput}
      />
    </Pressable>
  );
}

const styles = (c: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: c.bg },
    practiceBanner: {
      backgroundColor: "#fff4e5",
      color: "#7a4100",
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      lineHeight: 21,
    },
    center: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 32,
      paddingHorizontal: 20,
    },
    box: { width: "100%", maxWidth: 340 },
    langRow: { alignItems: "flex-end", marginBottom: 12 },
    iconButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      backgroundColor: c.surface,
    },
    title: { color: c.primary, fontSize: 26, fontWeight: "700", textAlign: "center" },
    subtitle: {
      color: c.textMuted,
      fontSize: 15,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 24,
    },
    card: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 20,
      gap: 14,
    },
    tabs: { flexDirection: "row", gap: 6, backgroundColor: c.codeBg, padding: 4, borderRadius: 10 },
    tab: {
      flex: 1,
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    },
    tabOn: { backgroundColor: c.surface },
    tabText: { fontSize: 13.5, fontWeight: "600", color: c.textMuted },
    tabTextOn: { color: c.text },
    label: { fontSize: 13, fontWeight: "600", color: c.text, marginBottom: 6 },
    input: {
      height: 44,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 16,
      color: c.text,
      backgroundColor: c.surface,
    },
    pinRow: { flexDirection: "row", gap: 8, width: "100%" },
    pinBox: {
      flex: 1,
      aspectRatio: 1,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    pinDigit: { fontSize: 22, fontWeight: "700", color: c.text },
    pinInput: { position: "absolute", opacity: 0, width: 1, height: 1 },
    error: { color: c.danger, fontSize: 14, lineHeight: 20 },
    primary: {
      height: 44,
      borderRadius: 10,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryDisabled: { opacity: 0.45 },
    primaryText: { color: c.onPrimary, fontSize: 16, fontWeight: "600" },
    rule: { height: 1, backgroundColor: c.border },
    linkCentered: { textAlign: "center", color: c.textMuted, fontSize: 14, paddingVertical: 4 },
    underline: { textDecorationLine: "underline" },
    secondary: {
      height: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryText: { color: c.text, fontSize: 15, fontWeight: "600" },
    note: { color: c.textMuted, fontSize: 13, textAlign: "center", lineHeight: 19 },
    footer: { color: c.textMuted, fontSize: 13.5, textAlign: "center", marginTop: 18 },
  });
