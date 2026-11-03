import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { API_BASE } from "@/lib/config";
import { oneAtATime } from "@/lib/oneAtATime";
import {
  addPart,
  deletePart,
  fetchPartsSetup,
  removePicture,
  renamePart,
  setCategorySystem,
  setDescription,
  setTerms,
  setWarranty,
  uploadPicture,
  type PartsSetup,
} from "@/lib/partsSetupApi";
import {
  categoryChanges,
  type Category,
  type CategoryDraft,
  type Kind,
  type NameDraft,
} from "@/lib/partsSetupPage";
import { useAuth } from "../AppProviders";
import { useToast } from "../staff/useTeam";

/** A picture change held in a sheet until บันทึก: a picked photo, or take the saved one away. */
export type PictureChange = { photo: Blob } | "remove" | null;
/** "wrong-picture": everything else saved, the photo was refused (type or size). */
export type SaveResult = "saved" | "wrong-picture" | "failed";

/**
 * ตั้งค่าอะไหล่'s data: one read of brands, systems and categories, reloaded on focus and after
 * every save. Saves run one at a time, so a quick second บันทึก can't add a thing twice.
 */
export function usePartsSetup() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [data, setData] = useState<PartsSetup | null>(null);
  const [failed, setFailed] = useState(false);
  const saves = useRef(oneAtATime()).current;
  const { toast, showToast } = useToast();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setData(await fetchPartsSetup(fetch, API_BASE, token));
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

  const picture = async (
    kind: "brand" | "type",
    id: string,
    change: PictureChange,
  ): Promise<SaveResult> => {
    if (change === "remove") await removePicture(fetch, API_BASE, token, kind, id);
    else if (change) {
      const key = await uploadPicture(fetch, API_BASE, token, kind, id, change.photo);
      if (key === "wrong-picture") return "wrong-picture";
    }
    return "saved";
  };

  const run = async (work: () => Promise<SaveResult>): Promise<SaveResult> => {
    try {
      const out = await saves.run(work);
      await load();
      return out;
    } catch {
      return "failed";
    }
  };

  /** A brand (with its logo) or a system: add, or set its two names. */
  const saveNames = (kind: "brand" | "system", d: NameDraft, change: PictureChange = null) =>
    run(async () => {
      const id = d.id ?? (await addPart(fetch, API_BASE, token, kind, d));
      if (d.id) await renamePart(fetch, API_BASE, token, kind, d.id, d);
      return kind === "brand" ? picture("brand", id, change) : "saved";
    });

  const saveCategory = (before: Category | null, d: CategoryDraft, change: PictureChange) =>
    run(async () => {
      const id = d.id ?? (await addPart(fetch, API_BASE, token, "category", d));
      const send = categoryChanges(before, d);
      if (send.rename) await renamePart(fetch, API_BASE, token, "category", id, d);
      if (send.system) await setCategorySystem(fetch, API_BASE, token, id, d.systemId);
      if (send.warranty) await setWarranty(fetch, API_BASE, token, id, d.warrantyDays);
      if (send.description) await setDescription(fetch, API_BASE, token, id, d.description);
      if (send.terms) await setTerms(fetch, API_BASE, token, id, d.terms);
      return picture("type", id, change);
    });

  /** A new system from inside a category's อยู่ในระบบ step: saved now, then picked. */
  const addSystem = async (d: NameDraft): Promise<string | null> => {
    try {
      const id = await saves.run(() => addPart(fetch, API_BASE, token, "system", d));
      await load();
      return id;
    } catch {
      return null;
    }
  };

  const remove = async (kind: Kind, id: string) => {
    try {
      const out = await saves.run(() => deletePart(fetch, API_BASE, token, kind, id));
      if (out === "in-use") {
        showToast(
          { th: "ลบไม่ได้ ยังมีของใช้อยู่", en: "Still in use" },
          { th: "ย้ายออกก่อน แล้วลองใหม่", en: "Move them first, then try again" },
        );
      }
    } catch {
      showToast({ th: "ลบไม่สำเร็จ", en: "Not deleted" }, { th: "ลองอีกครั้ง", en: "Try again" });
    }
    await load();
  };

  return { data, failed, load, toast, showToast, saveNames, saveCategory, addSystem, remove };
}

export type PartsSetupState = ReturnType<typeof usePartsSetup>;
