import { otherLang, readLang, say, type Lang, type Phrase } from "@l-shopee/shared/lang";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useColorScheme } from "react-native";
import { API_BASE } from "@/lib/config";
import { signIn, type Credentials, type SignedInStaff, type SignInResult } from "@/lib/signIn";
import { currentStaff, signOut } from "@/lib/staffApi";
import { readPref, readToken, writePref, writeToken } from "./prefs";
import { DARK, LIGHT, type Theme } from "./theme";

/**
 * The three things every screen reads: which language, which colours, and who is signed in.
 * Thai is the default, as on the web (owner, 2026-08-25); light/dark follows the phone unless the
 * moon button has picked one.
 */

interface LangValue {
  lang: Lang;
  t: (p: Phrase) => string;
  toggleLang: () => void;
}

interface ThemeValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

type AuthValue =
  | { status: "loading"; staff: null }
  | { status: "signed-out"; staff: null }
  /** `token` is what each screen sends with its own API calls; the API checks it every time. */
  | { status: "signed-in"; staff: SignedInStaff; token: string };

interface AuthActions {
  signInWith: (c: Credentials) => Promise<SignInResult>;
  signOutNow: () => Promise<void>;
}

const LangContext = createContext<LangValue | null>(null);
const ThemeContext = createContext<ThemeValue | null>(null);
const AuthContext = createContext<(AuthValue & AuthActions) | null>(null);

function must<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`${name} used outside <AppProviders>`);
  return value;
}

export const useLang = () => must(useContext(LangContext), "useLang");
export const useTheme = () => must(useContext(ThemeContext), "useTheme");
export const useAuth = () => must(useContext(AuthContext), "useAuth");

function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");
  useEffect(() => {
    void readPref("kira_lang").then((raw) => setLang(readLang(raw)));
  }, []);
  const toggleLang = useCallback(() => {
    setLang((current) => {
      const next = otherLang(current);
      void writePref("kira_lang", next);
      return next;
    });
  }, []);
  const value = useMemo(
    () => ({ lang, t: (p: Phrase) => say(lang, p), toggleLang }),
    [lang, toggleLang],
  );
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [chosen, setChosen] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    void readPref("kira_theme").then((raw) => {
      if (raw === "light" || raw === "dark") setChosen(raw);
    });
  }, []);
  const isDark = (chosen ?? system) === "dark";
  const toggleTheme = useCallback(() => {
    const next = isDark ? "light" : "dark";
    setChosen(next);
    void writePref("kira_theme", next);
  }, [isDark]);
  const value = useMemo(
    () => ({ theme: isDark ? DARK : LIGHT, isDark, toggleTheme }),
    [isDark, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthValue>({ status: "loading", staff: null });

  // On launch: a saved session is only as good as the API says it is.
  useEffect(() => {
    void (async () => {
      const saved = await readToken();
      const staff = saved ? await currentStaff(fetch, API_BASE, saved) : null;
      if (saved && staff) {
        setToken(saved);
        setAuth({ status: "signed-in", staff, token: saved });
      } else {
        if (saved) await writeToken(null);
        setAuth({ status: "signed-out", staff: null });
      }
    })();
  }, []);

  const signInWith = useCallback(async (c: Credentials) => {
    const result = await signIn(fetch, API_BASE, c);
    if (result.ok) {
      await writeToken(result.token);
      setToken(result.token);
      setAuth({ status: "signed-in", staff: result.staff, token: result.token });
    }
    return result;
  }, []);

  const signOutNow = useCallback(async () => {
    if (token) await signOut(fetch, API_BASE, token);
    await writeToken(null);
    setToken(null);
    setAuth({ status: "signed-out", staff: null });
  }, [token]);

  const value = useMemo(
    () => ({ ...auth, signInWith, signOutNow }),
    [auth, signInWith, signOutNow],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <ThemeProvider>
        <AuthProvider>{children}</AuthProvider>
      </ThemeProvider>
    </LangProvider>
  );
}
