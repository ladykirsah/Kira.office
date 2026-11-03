import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  addCarBrand,
  addCarModel,
  deleteCarBrand,
  deleteCarModel,
  fetchCarFitment,
  renameCarBrand,
  saveCarModel,
} from "@/lib/carFitmentApi";
import { modelSave, type CarBrand, type ModelDraft } from "@/lib/carFitmentPage";
import { API_BASE } from "@/lib/config";
import { oneAtATime } from "@/lib/oneAtATime";
import { removePicture, uploadPicture } from "@/lib/partsSetupApi";
import type { NameDraft } from "@/lib/partsSetupPage";
import { useAuth } from "../AppProviders";
import type { PictureChange, SaveResult } from "../partsSetup/usePartsSetup";
import { useToast } from "../staff/useTeam";

/**
 * รุ่นรถที่ใช้ได้'s data: one read of every car brand with its models, reloaded on focus and after
 * every save. Saves run one at a time, so a quick second บันทึก can't add a thing twice.
 */
export function useCarFitment() {
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [brands, setBrands] = useState<CarBrand[] | null>(null);
  const [failed, setFailed] = useState(false);
  const saves = useRef(oneAtATime()).current;
  const { toast, showToast } = useToast();

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setBrands(await fetchCarFitment(fetch, API_BASE, token));
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

  const run = async (work: () => Promise<SaveResult>): Promise<SaveResult> => {
    try {
      const out = await saves.run(work);
      await load();
      return out;
    } catch {
      return "failed";
    }
  };

  /** A car brand and its รูปปก: add, or set its two names. */
  const saveBrand = (d: NameDraft, change: PictureChange) =>
    run(async () => {
      const id = d.id ?? (await addCarBrand(fetch, API_BASE, token, d));
      if (d.id) await renameCarBrand(fetch, API_BASE, token, d.id, d);
      if (change === "remove") await removePicture(fetch, API_BASE, token, "car-brand", id);
      else if (change) {
        const key = await uploadPicture(fetch, API_BASE, token, "car-brand", id, change.photo);
        if (key === "wrong-picture") return "wrong-picture";
      }
      return "saved";
    });

  const addModel = (brandId: string, d: ModelDraft) =>
    run(async () => {
      await addCarModel(fetch, API_BASE, token, brandId, modelSave(d));
      return "saved";
    });

  const saveModel = (id: string, d: ModelDraft) =>
    run(async () => {
      await saveCarModel(fetch, API_BASE, token, id, modelSave(d));
      return "saved";
    });

  /** true once it is gone; a refusal or a failure says so in a toast. */
  const remove = async (kind: "brand" | "model", id: string): Promise<boolean> => {
    let gone = false;
    try {
      const out = await saves.run(() =>
        kind === "brand"
          ? deleteCarBrand(fetch, API_BASE, token, id)
          : deleteCarModel(fetch, API_BASE, token, id),
      );
      gone = out === "deleted";
      if (!gone) {
        showToast(
          { th: "ลบไม่ได้ ยังมีสินค้าใช้อยู่", en: "Products still fit it" },
          { th: "เอาออกจากสินค้าก่อน", en: "Take it off them first" },
        );
      }
    } catch {
      showToast({ th: "ลบไม่สำเร็จ", en: "Not deleted" }, { th: "ลองอีกครั้ง", en: "Try again" });
    }
    await load();
    return gone;
  };

  return { brands, failed, load, toast, showToast, saveBrand, addModel, saveModel, remove };
}

export type CarFitmentState = ReturnType<typeof useCarFitment>;
