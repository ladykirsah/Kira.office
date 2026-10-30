import {
  CarSheet,
  AddPartSheet,
  AddServiceSheet,
  DiscountSheet,
  EditLineSheet,
} from "./PickSheets";
import {
  CustomerSheet,
  DateSheet,
  DeleteDraftSheet,
  DraftsSheet,
  NoteSheet,
  OptionSheet,
  PreviewSheet,
  QueueSheet,
} from "./MoreSheets";
import { PosPaySheet } from "./PosPaySheet";
import { usePos } from "./PosSessionProvider";

/** The one sheet ทำบิล has open, if any. */
export function PosSheets() {
  const pos = usePos();
  const close = () => pos.setSheet(null);
  const s = pos.sheet;
  if (s === null) return null;
  if (typeof s === "object") {
    return "line" in s ? (
      <EditLineSheet lineKey={s.line} onClose={close} />
    ) : (
      <DeleteDraftSheet id={s.deleteDraft} onClose={() => pos.setSheet("drafts")} />
    );
  }
  switch (s) {
    case "part":
      return <AddPartSheet onClose={close} />;
    case "service":
      return <AddServiceSheet onClose={close} />;
    case "discount":
      return <DiscountSheet onClose={close} />;
    case "car":
      return <CarSheet onClose={close} />;
    case "drafts":
      return <DraftsSheet onClose={close} />;
    case "pay":
      return <PosPaySheet onClose={close} />;
    case "queue":
      return <QueueSheet onClose={close} />;
    case "customer":
      return <CustomerSheet onClose={close} />;
    case "note":
      return <NoteSheet onClose={close} />;
    case "date":
      return <DateSheet onClose={close} />;
    case "style":
    case "language":
      return <OptionSheet what={s} onClose={close} />;
    case "preview":
      return <PreviewSheet onClose={close} />;
  }
}
