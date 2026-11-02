import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import type { StaffPerson } from "@/lib/staffPage";
import { fetchTeam } from "@/lib/teamApi";
import { useAuth } from "../AppProviders";

const TOAST_MS = 3000;

export type TeamMember = StaffPerson & { dayRateSatang: number | null };

/** A page's dark message above the bottom: shown, then gone on its own. */
export function useToast() {
  const [toast, setToastState] = useState<{ title: Phrase; detail: Phrase } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((title: Phrase, detail: Phrase = { th: "", en: "" }) => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ title, detail });
    timer.current = setTimeout(() => setToastState(null), TOAST_MS);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  return { toast, showToast };
}

/** Everyone on พนักงาน, fresh each time the page comes back into view; who is signed in. */
export function useTeam() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const me = auth.status === "signed-in" ? auth.staff.userId : "";
  const [people, setPeople] = useState<TeamMember[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setPeople(await fetchTeam(fetch, API_BASE, token));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { token, me, people, failed, load };
}

/** The people money and days off are kept for: switched on and paid by the day (as drawn). */
export const onPayroll = (people: readonly TeamMember[]) =>
  people.filter((p) => p.status === "active" && p.dayRateSatang != null);

/** Who may hand over cash: the shop's owners. */
export const owners = (people: readonly TeamMember[]) =>
  people.filter((p) => p.role === "super_admin" && p.status === "active");
