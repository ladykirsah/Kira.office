import type { Phrase } from "@l-shopee/shared/lang";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { draftOf, profileChanges, type PersonDraft } from "@/lib/staffForm";
import { refusalWords, roleWord, showsDelete, shownName } from "@/lib/staffPage";
import {
  StaffRefusal,
  deleteStaff,
  fetchProfile,
  photoPath,
  updateProfile,
  updateStaff,
  uploadPhoto,
  type DayOff,
  type StaffProfile,
} from "@/lib/teamApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { useWide } from "../desk/useWide";
import { WideButton } from "../desk/WideTools";
import { ICON } from "../orders/icons";
import { Sheet } from "../orders/Sheet";
import { pickPhoto } from "../products/pickPhoto";
import { useScreenChrome } from "../ScreenChrome";
import { PhotoChoice } from "../shop/parts";
import { SPACE, TYPE } from "../theme";
import { PasswordSheet, PinSheet } from "./CodeSheets";
import { DayOffSheet } from "./DayOffSheet";
import { Avatar, CopyIcon } from "./parts";
import { PersonFields, type Problems } from "./PersonFields";
import { PersonView } from "./PersonView";
import { BASE } from "./Tabs";
import { useTeam, useToast } from "./useTeam";

type Open = "password" | "pin" | "delete" | { dayOff: DayOff } | null;

/**
 * One person (canvas v292, 3.1 – 3.8): the header as ข้อมูลร้าน's — photo, ตำแหน่ง · ชื่อเล่น, the phone
 * to copy — then ชื่อ, ผู้ติดต่อฉุกเฉิน, งาน, บัญชีธนาคาร, เงินเดือน, วันหยุด and การเข้าใช้งาน. แก้ไข turns
 * the page into the form; the codes and ลบคนนี้ open their own sheets.
 */
export function PersonScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const team = useTeam();
  const { toast, showToast } = useToast();
  const [person, setPerson] = useState<StaffProfile | null>(null);
  const [state, setState] = useState<"loading" | "failed" | "gone" | "ok">("loading");
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [active, setActive] = useState(true);
  const [problems, setProblems] = useState<Problems>({});
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const [stamp, setStamp] = useState(0);
  const [photoAt, setPhotoAt] = useState(0);
  // A computer shows the whole person at once, in three columns of cards (DeskStaff 2–3).
  const wide = useWide();

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      setPerson(await fetchProfile(fetch, API_BASE, token, id));
      setState("ok");
    } catch (e) {
      setState(e instanceof Error && /404/.test(e.message) ? "gone" : "failed");
    }
  }, [token, id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const leave = () => (router.canGoBack() ? router.back() : router.replace(BASE as never));
  const done = (said: Phrase) => {
    setOpen(null);
    showToast(said);
    setStamp((n) => n + 1);
    void load();
  };

  const save = async () => {
    if (!person || !draft || busy) return;
    setBusy(true);
    setProblems({});
    try {
      const patch = profileChanges(person, draft);
      if (Object.keys(patch).length > 0) {
        await updateProfile(fetch, API_BASE, token, person.id, patch);
      }
      const status = active ? "active" : "disabled";
      if (draft.role !== person.role || status !== person.status) {
        await updateStaff(fetch, API_BASE, token, person.id, { role: draft.role, status });
      }
      setDraft(null);
      done({ th: "บันทึกแล้ว", en: "Saved" });
    } catch (e) {
      if (e instanceof StaffRefusal && e.field) {
        setProblems({ [e.field]: refusalWords(e.code, e.message) });
      } else {
        showToast(
          { th: "บันทึกไม่สำเร็จ", en: "Not saved" },
          { th: "ลองอีกครั้ง", en: "Try again" },
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const name = person ? shownName(person) : "";
  const saveButton = { label: t({ th: "บันทึก", en: "Save" }), onPress: () => void save() };
  const cancelLabel = t({ th: "ยกเลิก", en: "Cancel" });
  useScreenChrome(
    null,
    // A computer's form ends in the pinned bar: ยกเลิก beside the red บันทึก (DeskStaff 3).
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
        : { label: wide ? t({ th: "พนักงาน", en: "Staff" }) : "", onPress: leave },
      ownTitle: true,
      toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null,
      layout: "full",
    },
  );

  if (state !== "ok" || !person) {
    if (state === "gone") {
      return (
        <Empty
          icon={ICON.search}
          title={t({ th: "ไม่มีคนนี้แล้ว", en: "This person is gone" })}
          detail={t({ th: "อาจถูกลบไปแล้ว", en: "They may have been deleted" })}
        />
      );
    }
    return state === "failed" ? (
      <Retry onPress={() => void load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }

  const photo = person.hasPhoto ? `${photoPath(person.id)}?v=${photoAt}` : null;
  const changePhoto = async (source: "camera" | "library") => {
    const blob = await pickPhoto(source);
    if (!blob) return;
    try {
      await uploadPhoto(fetch, API_BASE, token, person.id, blob);
      setPhotoAt(Date.now());
      void load();
    } catch (e) {
      showToast(
        e instanceof StaffRefusal
          ? refusalWords(e.code, e.message)
          : { th: "บันทึกรูปไม่สำเร็จ", en: "Photo not saved" },
      );
    }
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteStaff(fetch, API_BASE, token, person.id);
      router.replace(BASE as never);
    } catch (e) {
      setOpen(null);
      showToast(
        { th: "ลบไม่สำเร็จ", en: "Not deleted" },
        { th: e instanceof Error ? e.message : "ลองอีกครั้ง", en: "Try again" },
      );
    } finally {
      setBusy(false);
    }
  };
  const edit = () => {
    setProblems({});
    setActive(person.status === "active");
    setDraft(draftOf(person));
  };

  const changeablePhoto = (size: number) => (
    <PhotoChoice onChoose={(s) => void changePhoto(s)}>
      {(openMenu) => (
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "เปลี่ยนรูป", en: "Change photo" })}
        >
          <Avatar name={name} photo={photo} size={size} band={t({ th: "เปลี่ยน", en: "Change" })} />
        </Pressable>
      )}
    </PhotoChoice>
  );
  const phoneLine = person.phone ? (
    <View style={styles.phone}>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{person.phone}</Text>
      <CopyIcon
        value={person.phone}
        what={{ th: "เบอร์โทร", en: "phone number" }}
        onCopied={(said) => showToast(said)}
      />
    </View>
  ) : null;
  const body = draft ? (
    <PersonFields
      draft={draft}
      onChange={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
      problems={problems}
      codes={false}
      locked={person.locked}
      active={active}
      onActive={setActive}
      onCopied={(said) => showToast(said)}
      deskColumns
    />
  ) : (
    <PersonView
      person={person}
      stamp={stamp}
      onCopied={(said) => showToast(said)}
      onPassword={() => setOpen("password")}
      onPin={() => setOpen("pin")}
      onDayOff={(d) => setOpen({ dayOff: d })}
      onDelete={showsDelete(person, team.me) ? () => setOpen("delete") : undefined}
    />
  );
  const sheets = (
    <>
      {open === "password" && (
        <PasswordSheet
          id={person.id}
          token={token}
          now={person.password}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      )}
      {open === "pin" && (
        <PinSheet
          id={person.id}
          token={token}
          now={person.pin}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      )}
      {open === "delete" && (
        <Sheet
          title={t({ th: `ลบพนักงาน ${name}?`, en: `Delete ${name}?` })}
          onClose={() => setOpen(null)}
          noPill
        >
          <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove()} />
          <BigButton
            label={t({ th: "ยกเลิก", en: "Cancel" })}
            kind="grey"
            onPress={() => setOpen(null)}
          />
        </Sheet>
      )}
      {open && typeof open === "object" && (
        <DayOffSheet
          start={{
            edit: open.dayOff,
            person: (team.people ?? []).find((p) => p.id === person.id) ?? null,
          }}
          people={team.people ?? []}
          token={token}
          onClose={() => setOpen(null)}
          onDone={done}
        />
      )}
    </>
  );

  if (wide) {
    // DeskStaff 2–3: photo, ตำแหน่ง · ชื่อ and the phone on one line, แก้ไข at its end.
    return (
      <View>
        <View style={styles.deskHead}>
          {draft ? changeablePhoto(64) : <Avatar name={name} photo={photo} size={64} />}
          <View style={styles.grow}>
            <Text style={[styles.deskTitle, { color: theme.text }]} accessibilityRole="header">
              {draft
                ? t({ th: `แก้ไข${name}`, en: `Edit ${name}` })
                : `${t(roleWord(person.role))} · ${name}`}
            </Text>
            {!draft && phoneLine}
          </View>
          {!draft && (
            <WideButton
              button={{ label: t({ th: "แก้ไข", en: "Edit" }), icon: "", onPress: edit }}
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
      <View style={styles.top}>
        <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
          {draft
            ? t({ th: `แก้ไข${name}`, en: `Edit ${name}` })
            : t({ th: "พนักงาน", en: "Staff" })}
        </Text>
        {!draft && (
          <Pressable
            onPress={edit}
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
        {draft ? (
          changeablePhoto(88)
        ) : (
          <>
            <Avatar name={name} photo={photo} size={88} />
            <Text style={[TYPE.title1, styles.name, { color: theme.text }]}>
              {`${t(roleWord(person.role))} · ${name}`}
            </Text>
            {phoneLine}
          </>
        )}
      </View>

      {body}

      {sheets}
    </View>
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
  name: { marginTop: 14, textAlign: "center" },
  phone: { flexDirection: "row", alignItems: "center", gap: 2 },
  deskHead: { flexDirection: "row", alignItems: "center", gap: SPACE.l, marginBottom: SPACE.xs },
  deskTitle: { fontSize: 28, lineHeight: 35, fontWeight: "600" },
  grow: { flex: 1, minWidth: 0 },
});
