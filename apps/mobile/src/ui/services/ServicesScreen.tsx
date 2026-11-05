import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { oneAtATime } from "@/lib/oneAtATime";
import { fetchServices, type ServiceRow } from "@/lib/posApi";
import { addService, deleteService, updateService } from "@/lib/servicesApi";
import {
  addFromSearch,
  draftOf,
  findServices,
  listHeading,
  newDraft,
  notFound,
  serviceBody,
  type ServiceDraft,
} from "@/lib/servicesPage";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { BigButton } from "../BigButton";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Line, SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { Chevron } from "../staff/parts";
import { useToast } from "../staff/useTeam";
import { SPACE, TYPE } from "../theme";
import { DeleteServiceSheet, ServiceSheet } from "./ServiceSheets";

/**
 * ตั้งค่าบริการ (canvas ตั้งค่าบริการ, approved 3 Nov 2026): ค้นหาบริการ, then every service with its
 * starting price — the list ทำบิล picks from. A search that finds nothing offers + เพิ่ม “…”; ＋ adds,
 * a service opens to change or delete. A save is read back from the server.
 */
export function ServicesScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [list, setList] = useState<ServiceRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ServiceDraft | null>(null);
  const [deleting, setDeleting] = useState<ServiceDraft | null>(null);
  const { toast, showToast } = useToast();
  const saves = useRef(oneAtATime()).current;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setList(await fetchServices(fetch, API_BASE, token));
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

  useScreenChrome(
    {
      label: t({ th: "เพิ่มบริการ", en: "Add a service" }),
      icon: ICON.plus,
      main: true,
      onPress: () => setEditing(newDraft()),
    },
    [],
    { toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null },
  );

  const save = async (d: ServiceDraft): Promise<boolean> => {
    try {
      await saves.run<unknown>(() =>
        d.id
          ? updateService(fetch, API_BASE, token, d.id, serviceBody(d))
          : addService(fetch, API_BASE, token, serviceBody(d)),
      );
      setEditing(null);
      await load();
      return true;
    } catch {
      return false;
    }
  };

  const remove = async (d: ServiceDraft) => {
    setDeleting(null);
    try {
      await saves.run(() => deleteService(fetch, API_BASE, token, d.id ?? ""));
    } catch {
      showToast({ th: "ลบไม่สำเร็จ", en: "Not deleted" }, { th: "ลองอีกครั้ง", en: "Try again" });
    }
    await load();
  };

  const sheets = (
    <>
      {editing && list && (
        <ServiceSheet
          start={editing}
          list={list}
          onSave={save}
          onDelete={() => {
            setDeleting(editing);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <DeleteServiceSheet
          name={deleting.name}
          onDelete={() => void remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );

  if (!list) {
    return failed ? (
      <Retry onPress={() => void load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }

  const shown = findServices(list, q);
  const typed = q.trim();
  return (
    <View>
      {failed && <Retry onPress={() => void load()} />}
      <View style={styles.search}>
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder={t({ th: "ค้นหาบริการ", en: "Find a service" })}
        />
      </View>

      {typed && shown.length === 0 ? (
        <View style={styles.none}>
          <Text style={[TYPE.headline, styles.center, { color: theme.text }]}>
            {t(notFound(typed))}
          </Text>
          <BigButton
            label={t(addFromSearch(typed))}
            kind="grey"
            onPress={() => setEditing(newDraft(typed))}
          />
        </View>
      ) : list.length === 0 ? (
        <Text style={[TYPE.title2, styles.empty, { color: theme.text }]}>
          {t({ th: "ยังไม่มีบริการ", en: "No services yet" })}
        </Text>
      ) : (
        <>
          <Text style={[TYPE.footnote, styles.heading, { color: theme.textMuted }]}>
            {t(listHeading(list, shown, q))}
          </Text>
          <Group>
            {shown.map((s, i) => (
              <Line
                key={s.id}
                label={s.name}
                right={
                  <View style={styles.right}>
                    <Text style={[TYPE.body, styles.price, { color: theme.text }]}>
                      {formatBaht(s.basePriceSatang)}
                    </Text>
                    <Chevron />
                  </View>
                }
                onPress={() => setEditing(draftOf(s))}
                last={i === shown.length - 1}
              />
            ))}
          </Group>
        </>
      )}
      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: SPACE.s },
  heading: { marginTop: SPACE.xl, marginBottom: SPACE.s, marginHorizontal: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  price: { fontVariant: ["tabular-nums"] },
  none: { marginTop: SPACE.xxxl, gap: SPACE.xl },
  center: { textAlign: "center" },
  empty: { textAlign: "center", paddingVertical: 96, paddingHorizontal: SPACE.m },
});
