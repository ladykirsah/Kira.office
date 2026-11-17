/**
 * งานซ่อม — the repair job's rules (plan 10.1, owner 17 Nov 2026). Pure: the API enforces them,
 * the screens read them.
 *
 * The owner's flow, one step at a time:
 *   in (เข้าใหม่) → check (ตรวจเช็ค) → estimate (ประเมินราคา) → agreed (ลูกค้าตกลงราคา)
 *   → the work: waiting_parts (รออะไหล่) while any part is missing, else working (กำลังซ่อม)
 *   → ready (พร้อมรับรถ — the bill is issued to pay) → paid (ชำระเงินแล้ว)
 * Any step can go back ("backward = yes"). Paid and cancelled are closed.
 */
export const JOB_STATUSES = [
  "in",
  "check",
  "estimate",
  "agreed",
  "waiting_parts",
  "working",
  "ready",
  "paid",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/**
 * estimate — on the price estimate only, no stock · taken — on the job's bill (a part sits in
 * งานนอก for this job) · waiting — a part not in stock yet · sold — the job is paid · removed — taken
 * off the job.
 */
export type JobLineState = "estimate" | "taken" | "waiting" | "sold" | "removed";

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

/** Paid or cancelled: nothing on the job changes any more. */
export function isClosedJob(status: JobStatus): status is "paid" | "cancelled" {
  return status === "paid" || status === "cancelled";
}

/** รออะไหล่ and กำลังซ่อม are one step — the work — shown two ways. */
export function isWorkStep(status: JobStatus): boolean {
  return status === "waiting_parts" || status === "working";
}

/** Each step's place in the flow; รออะไหล่ and กำลังซ่อม share one. */
const RANK: Record<Exclude<JobStatus, "paid" | "cancelled">, number> = {
  in: 0,
  check: 1,
  estimate: 2,
  agreed: 3,
  waiting_parts: 4,
  working: 4,
  ready: 5,
};

export type JobMoveKind = "forward" | "back" | "start_work" | "end_wait" | "ready";
export type JobMoveError =
  | "closed"
  | "same"
  | "use_pay"
  | "use_cancel"
  | "skip"
  | "not_waiting"
  | "nothing_on_bill"
  | "lines_not_taken";
export type JobMoveCheck = { ok: true; kind: JobMoveKind } | { ok: false; error: JobMoveError };

/**
 * May a job go from `from` to `to`, given its lines?
 *  · start_work (agreed → the work): the estimate goes onto the job's bill — parts in stock are
 *    taken into งานนอก, missing ones wait. Asked as working or รออะไหล่, the lines decide which.
 *  · end_wait (รออะไหล่ → working): every waiting part must now be in stock.
 *  · ready: every line is on the bill (none waiting, none estimate-only) and there is at least one.
 *  · รออะไหล่ is never chosen by hand otherwise — a part missing puts the job there.
 */
export function checkJobMove(
  from: JobStatus,
  to: JobStatus,
  lines: readonly { state: JobLineState }[],
): JobMoveCheck {
  if (isClosedJob(from)) return { ok: false, error: "closed" };
  if (to === "paid") return { ok: false, error: "use_pay" };
  if (to === "cancelled") return { ok: false, error: "use_cancel" };
  if (to === from) return { ok: false, error: "same" };

  if (from === "agreed" && isWorkStep(to)) return { ok: true, kind: "start_work" };
  if (to === "waiting_parts") return { ok: false, error: "not_waiting" };
  if (from === "waiting_parts" && to === "working") return { ok: true, kind: "end_wait" };

  if (RANK[to] < RANK[from]) return { ok: true, kind: "back" };
  if (RANK[to] !== RANK[from] + 1) return { ok: false, error: "skip" };
  if (to !== "ready") return { ok: true, kind: "forward" };

  const live = lines.filter((l) => l.state !== "removed");
  if (live.length === 0) return { ok: false, error: "nothing_on_bill" };
  if (live.some((l) => l.state !== "taken")) return { ok: false, error: "lines_not_taken" };
  return { ok: true, kind: "ready" };
}

/** While the job is worked on, it shows รออะไหล่ as long as any part is still waiting. */
export function workStatusFor(lines: readonly { state: JobLineState }[]): JobStatus {
  return lines.some((l) => l.state === "waiting") ? "waiting_parts" : "working";
}

/**
 * The time the customer is told under รออะไหล่: the last part still waiting. A part with no time
 * yet doesn't hide the others'; none known → null.
 */
export function waitUntil(
  lines: readonly { state: JobLineState; expectedAt: number | null }[],
): number | null {
  const times = lines
    .filter((l) => l.state === "waiting" && l.expectedAt != null)
    .map((l) => l.expectedAt as number);
  return times.length > 0 ? Math.max(...times) : null;
}

/** The steps that send the customer a LINE OA update (owner's list); the rest are shop-only. */
const CUSTOMER_UPDATES = ["in", "check", "waiting_parts", "working", "ready"] as const;
export type JobCustomerUpdate = (typeof CUSTOMER_UPDATES)[number];

export function customerUpdateFor(status: JobStatus): JobCustomerUpdate | null {
  return (CUSTOMER_UPDATES as readonly string[]).includes(status)
    ? (status as JobCustomerUpdate)
    : null;
}

export interface JobLineInput {
  lineType: unknown;
  productVariantId?: unknown;
  description: unknown;
  quantity: unknown;
  unitPriceSatang: unknown;
  discountSatang?: unknown;
}

const MAX_LINE_NAME_CHARS = 200;
const isWhole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

/**
 * What's wrong with a job line, or null. A part may be typed by name with no product yet (a part
 * that never existed): staff add it with เพิ่มสินค้า and link it before its wait can end.
 */
export function jobLineProblem(line: JobLineInput): string | null {
  if (line.lineType !== "part" && line.lineType !== "service") {
    return "line type must be part or service";
  }
  if (line.lineType === "service" && line.productVariantId) return "a service line has no product";
  const name = typeof line.description === "string" ? line.description.trim() : "";
  if (!name) return "a line needs a name";
  if (Array.from(name).length > MAX_LINE_NAME_CHARS)
    return "a line's name is 200 characters at most";
  if (!isWhole(line.quantity) || line.quantity < 1) {
    return "quantity must be a whole number, 1 or more";
  }
  if (!isWhole(line.unitPriceSatang) || line.unitPriceSatang < 0) {
    return "price must be a whole number of satang, 0 or more";
  }
  const discount = line.discountSatang ?? 0;
  if (!isWhole(discount) || discount < 0 || discount > line.unitPriceSatang * line.quantity) {
    return "discount must be between 0 and the line's price";
  }
  return null;
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const JOB_NUMBER = /^JB(\d{6})-(\d{2})(\d+)$/;
const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * The next job number, JByyyymm-ddnnn by the Thai date — after today's highest. The job's bill
 * carries it too, so it never clashes with a phone's DAS… walk-in bill.
 */
export function nextJobNumber(known: readonly string[], now: number): string {
  const d = new Date(now + BANGKOK_OFFSET_MS);
  const month = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1, 2)}`;
  const day = pad(d.getUTCDate(), 2);
  let highest = 0;
  for (const n of known) {
    const hit = JOB_NUMBER.exec(n);
    if (hit && hit[1] === month && hit[2] === day) highest = Math.max(highest, Number(hit[3]));
  }
  return `JB${month}-${day}${pad(highest + 1, 3)}`;
}
