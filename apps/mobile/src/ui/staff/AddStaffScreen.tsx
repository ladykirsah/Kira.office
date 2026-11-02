import type { Phrase } from "@l-shopee/shared/lang";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { blankDraft, newStaffBody, type PersonDraft } from "@/lib/staffForm";
import { addProblems, refusalWords } from "@/lib/staffPage";
import { StaffRefusal, createStaff, uploadPhoto } from "@/lib/teamApi";
import { useAuth, useLang } from "../AppProviders";
import { FormPage } from "../products/FormPage";
import { pickPhoto, photoPreview } from "../products/pickPhoto";
import { PhotoChoice } from "../shop/parts";
import { SPACE } from "../theme";
import { Avatar } from "./parts";
import { PersonFields, type Problems } from "./PersonFields";
import type { Photo } from "./PayWays";
import { BASE } from "./Tabs";
import { useToast } from "./useTeam";

/**
 * เพิ่มคน (canvas v292, 1.2 – 1.5): the whole person on one page — photo, names, contact, emergency
 * contact, work, bank, and the two codes. บันทึก names only the boxes still empty, and anything the
 * server refuses shows under its own box; once saved, the list says เพิ่ม … แล้ว.
 */
export function AddStaffScreen() {
  const { t } = useLang();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const { toast, showToast } = useToast();
  const [draft, setDraft] = useState<PersonDraft>(() => blankDraft(Date.now()));
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<{ field: string; words: Phrase } | null>(null);
  const [busy, setBusy] = useState(false);

  const missing: Problems = tried ? addProblems(draft) : {};
  const problems: Problems = refused ? { ...missing, [refused.field]: refused.words } : missing;
  const change = (patch: Partial<PersonDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    // A refusal goes once its box is touched again.
    if (refused && refused.field in patch) setRefused(null);
  };
  const leave = () => (router.canGoBack() ? router.back() : router.replace(BASE as never));

  const save = async () => {
    setTried(true);
    if (busy || Object.keys(addProblems(draft)).length > 0) return;
    setBusy(true);
    try {
      const id = await createStaff(fetch, API_BASE, token, newStaffBody(draft));
      if (photo) await uploadPhoto(fetch, API_BASE, token, id, photo.blob).catch(() => undefined);
      router.replace(`${BASE}?added=${encodeURIComponent(draft.nameTh.trim())}` as never);
    } catch (e) {
      if (e instanceof StaffRefusal && e.field) {
        setRefused({ field: e.field, words: refusalWords(e.code, e.message) });
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

  const choose = async (source: "camera" | "library") => {
    const blob = await pickPhoto(source);
    if (blob) setPhoto({ blob, uri: photoPreview(blob) });
  };

  return (
    <FormPage
      title={t({ th: "เพิ่มคน", en: "Add a person" })}
      onCancel={leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void save() }}
      toast={toast ? { title: t(toast.title), detail: t(toast.detail) } : null}
    >
      <View style={styles.photo}>
        <PhotoChoice onChoose={(s) => void choose(s)}>
          {(open) => (
            <Pressable
              onPress={open}
              accessibilityRole="button"
              accessibilityLabel={t({ th: "เพิ่มรูป", en: "Add a photo" })}
            >
              <Avatar
                name=""
                uri={photo?.uri}
                size={88}
                band={t(
                  photo ? { th: "เปลี่ยน", en: "Change" } : { th: "เพิ่มรูป", en: "Add photo" },
                )}
              />
            </Pressable>
          )}
        </PhotoChoice>
      </View>
      <PersonFields
        draft={draft}
        onChange={change}
        problems={problems}
        codes
        onCopied={(said) => showToast(said)}
      />
    </FormPage>
  );
}

const styles = StyleSheet.create({
  photo: { alignItems: "center", marginTop: SPACE.s },
});
