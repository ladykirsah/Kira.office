/**
 * งานซ่อม — the repair job (plan 10.1, owner 17 Nov 2026). The rules are in @l-shopee/core
 * (repairJob.ts); this file keeps them in D1.
 *
 * Every write here touches stock or may, so the routes run them through the StockLedger Durable
 * Object — one writer at a time, like every other stock change.
 *
 * Stock (owner's pick A): a part taken for a job moves ขายได้ → งานนอก ('hold', source_type
 * 'repair_job'); when the customer pays it is sold ('unhold' + 'onsite_sale' on the paid bill); a
 * removed line or a cancel brings it back ('unhold'). Money counts only when paid: the bill row in
 * onsite_sales is written at payment, never before, so no money page changes.
 */
import {
  canonicalPlate,
  canonicalProvince,
  carProblem,
  checkJobMove,
  customerUpdateFor,
  isClosedJob,
  isJobStatus,
  isWorkStep,
  jobLineProblem,
  nextJobNumber,
  waitUntil,
  workStatusFor,
  type JobLineState,
  type JobStatus,
} from "@l-shopee/core";

export interface JobActor {
  /** The signed-in staff member; null only for a session with no staff row. */
  userId: string | null;
  now: number;
}

export interface RepairJobLine {
  id: string;
  lineType: "part" | "service";
  productVariantId: string | null;
  description: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang: number;
  state: JobLineState;
  expectedAt: number | null;
}

export interface RepairJobEvent {
  id: string;
  kind: string;
  fromStatus: JobStatus | null;
  toStatus: JobStatus | null;
  note: string | null;
  customerUpdate: string | null;
  expectedAt: number | null;
  userId: string | null;
  userName: string | null;
  createdAt: number;
}

export interface RepairJobDetail {
  id: string;
  jobNumber: string;
  status: JobStatus;
  licensePlate: string;
  /** The province on the plate (plan 13.11): the car is the plate AND its province. */
  plateProvince: string;
  vehicle: string | null;
  mileageKm: number | null;
  problem: string | null;
  cancelReason: string | null;
  billIssuedAt: number | null;
  saleId: string | null;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
  lines: RepairJobLine[];
  mechanics: { userId: string; name: string }[];
  events: RepairJobEvent[];
  subtotalSatang: number;
  discountSatang: number;
  totalSatang: number;
  /** รออะไหล่: the time the customer is told — the last part still waiting. */
  waitUntil: number | null;
}

export interface MissingPart {
  lineId: string;
  description: string;
  /** not_linked — a new part not yet added with เพิ่มสินค้า and linked · not_in_stock — fill stock. */
  reason: "not_linked" | "not_in_stock";
}

export type JobResult =
  | { ok: true; job: RepairJobDetail }
  | { ok: false; status: 400 | 404 | 409; error: string; parts?: MissingPart[] };

/** The counter takes these two (posBill); a job is paid the same ways. */
const PAYMENT_METHODS = ["cash", "promptpay"] as const;
const MAX_MILEAGE_KM = 9_999_999;
const MAX_TEXT_CHARS = 500;
const MAX_MECHANICS = 10;
const LIST_LIMIT = 200;

const fail = (
  status: 400 | 404 | 409,
  error: string,
  parts?: MissingPart[],
): JobResult & { ok: false } =>
  parts ? { ok: false, status, error, parts } : { ok: false, status, error };

const textOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;
const tooLong = (v: string | null) => v !== null && Array.from(v).length > MAX_TEXT_CHARS;

// ── Reads ─────────────────────────────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  jobNumber: string;
  status: JobStatus;
  licensePlate: string;
  plateProvince: string;
  vehicle: string | null;
  mileageKm: number | null;
  problem: string | null;
  cancelReason: string | null;
  billIssuedAt: number | null;
  saleId: string | null;
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
}

const JOB_COLUMNS = `id, job_number AS jobNumber, status, license_plate AS licensePlate,
  plate_province AS plateProvince, vehicle,
  mileage_km AS mileageKm, problem, cancel_reason AS cancelReason, bill_issued_at AS billIssuedAt,
  sale_id AS saleId, created_at AS createdAt, updated_at AS updatedAt, closed_at AS closedAt`;

async function readJob(db: D1Database, jobId: string): Promise<JobRow | null> {
  return db
    .prepare(`SELECT ${JOB_COLUMNS} FROM repair_jobs WHERE id = ?`)
    .bind(jobId)
    .first<JobRow>();
}

async function readLines(db: D1Database, jobId: string): Promise<RepairJobLine[]> {
  const rows = await db
    .prepare(
      `SELECT id, line_type AS lineType, product_variant_id AS productVariantId, description,
              quantity, unit_price_satang AS unitPriceSatang, discount_satang AS discountSatang,
              state, expected_at AS expectedAt
       FROM repair_job_lines WHERE job_id = ? ORDER BY position`,
    )
    .bind(jobId)
    .all<RepairJobLine>();
  return rows.results ?? [];
}

const thaiOrder = (a: string, b: string) => a.localeCompare(b, "th");

/** One job with its lines, mechanics and history — what every write hands back. */
export async function getRepairJob(db: D1Database, jobId: string): Promise<RepairJobDetail | null> {
  const job = await readJob(db, jobId);
  if (!job) return null;
  const lines = await readLines(db, jobId);
  const mechanics = await db
    .prepare(
      `SELECT u.id AS userId, COALESCE(u.name_th, u.name) AS name
       FROM repair_job_mechanics m JOIN users u ON u.id = m.user_id WHERE m.job_id = ?`,
    )
    .bind(jobId)
    .all<{ userId: string; name: string }>();
  const events = await db
    .prepare(
      `SELECT e.id, e.kind, e.from_status AS fromStatus, e.to_status AS toStatus, e.note,
              e.customer_update AS customerUpdate, e.expected_at AS expectedAt, e.user_id AS userId,
              COALESCE(u.name_th, u.name) AS userName, e.created_at AS createdAt
       FROM repair_job_events e LEFT JOIN users u ON u.id = e.user_id
       WHERE e.job_id = ? ORDER BY e.created_at, e.rowid`,
    )
    .bind(jobId)
    .all<RepairJobEvent>();
  const live = lines.filter((l) => l.state !== "removed");
  const subtotalSatang = live.reduce((s, l) => s + l.unitPriceSatang * l.quantity, 0);
  const discountSatang = live.reduce((s, l) => s + l.discountSatang, 0);
  return {
    ...job,
    lines,
    mechanics: [...(mechanics.results ?? [])].sort((a, b) => thaiOrder(a.name, b.name)),
    events: events.results ?? [],
    subtotalSatang,
    discountSatang,
    totalSatang: subtotalSatang - discountSatang,
    waitUntil: waitUntil(lines),
  };
}

export interface RepairJobFilter {
  status?: string;
  plate?: string;
  /** With `plate`: one car's jobs (plan 13.11 — the same plate in another province is another car). */
  province?: string;
  mechanicId?: string;
  /** Only jobs not yet paid or cancelled. */
  open?: boolean;
}

export interface RepairJobSummary {
  id: string;
  jobNumber: string;
  status: JobStatus;
  licensePlate: string;
  plateProvince: string;
  vehicle: string | null;
  problem: string | null;
  mechanics: string[];
  totalSatang: number;
  waitUntil: number | null;
  createdAt: number;
  updatedAt: number;
}

/** The job board: newest first, with how many jobs sit at each step. */
export async function listRepairJobs(
  db: D1Database,
  filter: RepairJobFilter,
): Promise<{ jobs: RepairJobSummary[]; counts: Partial<Record<JobStatus, number>> }> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (filter.plate) {
    where.push("j.license_plate = ?");
    binds.push(canonicalPlate(filter.plate));
    if (filter.province !== undefined) {
      where.push("j.plate_province = ?");
      binds.push(canonicalProvince(filter.province));
    }
  }
  if (filter.mechanicId) {
    where.push(
      "EXISTS (SELECT 1 FROM repair_job_mechanics m WHERE m.job_id = j.id AND m.user_id = ?)",
    );
    binds.push(filter.mechanicId);
  }
  if (filter.open) where.push("j.status NOT IN ('paid', 'cancelled')");
  const countWhere = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const counts = await db
    .prepare(`SELECT j.status, COUNT(*) AS n FROM repair_jobs j ${countWhere} GROUP BY j.status`)
    .bind(...binds)
    .all<{ status: JobStatus; n: number }>();

  if (filter.status && isJobStatus(filter.status)) {
    where.push("j.status = ?");
    binds.push(filter.status);
  }
  const listWhere = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await db
    .prepare(
      `SELECT j.id, j.job_number AS jobNumber, j.status, j.license_plate AS licensePlate,
              j.plate_province AS plateProvince, j.vehicle,
              j.problem, j.created_at AS createdAt, j.updated_at AS updatedAt,
              (SELECT COALESCE(SUM(l.unit_price_satang * l.quantity - l.discount_satang), 0)
                 FROM repair_job_lines l WHERE l.job_id = j.id AND l.state != 'removed') AS totalSatang,
              (SELECT MAX(l.expected_at) FROM repair_job_lines l
                 WHERE l.job_id = j.id AND l.state = 'waiting') AS waitUntil,
              (SELECT GROUP_CONCAT(COALESCE(u.name_th, u.name), char(31))
                 FROM repair_job_mechanics m JOIN users u ON u.id = m.user_id
                 WHERE m.job_id = j.id) AS mechanicNames
       FROM repair_jobs j ${listWhere}
       ORDER BY j.created_at DESC, j.job_number DESC LIMIT ${LIST_LIMIT}`,
    )
    .bind(...binds)
    .all<Omit<RepairJobSummary, "mechanics"> & { mechanicNames: string | null }>();

  const jobs = (rows.results ?? []).map(({ mechanicNames, ...j }) => ({
    ...j,
    totalSatang: Number(j.totalSatang),
    mechanics: mechanicNames ? mechanicNames.split("\u001f").sort(thaiOrder) : [],
  }));
  const countMap: Partial<Record<JobStatus, number>> = {};
  for (const c of counts.results ?? []) countMap[c.status] = Number(c.n);
  return { jobs, counts: countMap };
}

// ── Stock helpers ─────────────────────────────────────────────────────────────────────────────

async function stockFor(
  db: D1Database,
  variantIds: readonly string[],
): Promise<{ sellable: Map<string, number>; held: Map<string, number> }> {
  const sellable = new Map<string, number>();
  const held = new Map<string, number>();
  for (const id of new Set(variantIds)) {
    const row = await db
      .prepare(
        `SELECT COALESCE(SUM(quantity_delta), 0) AS onHand,
                COALESCE(SUM(CASE WHEN movement_type IN ('hold', 'unhold') THEN quantity_delta END), 0) AS holds
         FROM stock_ledger_entries WHERE product_variant_id = ?`,
      )
      .bind(id)
      .first<{ onHand: number; holds: number }>();
    sellable.set(id, Number(row?.onHand ?? 0));
    held.set(id, -Number(row?.holds ?? 0) || 0);
  }
  return { sellable, held };
}

interface LedgerWrite {
  variantId: string;
  type: "hold" | "unhold" | "onsite_sale";
  delta: number;
  after: number;
  sourceType: "repair_job" | "onsite_sale";
  sourceId: string;
  reason: string | null;
}

function ledgerStmt(db: D1Database, w: LedgerWrite, actor: JobActor): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO stock_ledger_entries
         (id, product_variant_id, movement_type, quantity_delta, quantity_after, source_type,
          source_id, reason, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      w.variantId,
      w.type,
      w.delta,
      w.after,
      w.sourceType,
      w.sourceId,
      w.reason,
      actor.userId,
      actor.now,
    );
}

/**
 * Plan taking parts into งานนอก for a job, one after another against what is sellable now. Parts
 * that can't be taken (no product yet, or not enough stock) come back as missing.
 */
async function planTake(
  db: D1Database,
  job: JobRow,
  lines: readonly RepairJobLine[],
  actor: JobActor,
): Promise<{ taken: string[]; missing: MissingPart[]; statements: D1PreparedStatement[] }> {
  const parts = lines.filter((l) => l.lineType === "part");
  const { sellable } = await stockFor(
    db,
    parts.flatMap((l) => (l.productVariantId ? [l.productVariantId] : [])),
  );
  const taken: string[] = [];
  const missing: MissingPart[] = [];
  const statements: D1PreparedStatement[] = [];
  for (const line of lines) {
    if (line.lineType === "service") {
      taken.push(line.id);
      continue;
    }
    const vid = line.productVariantId;
    if (!vid) {
      missing.push({ lineId: line.id, description: line.description, reason: "not_linked" });
      continue;
    }
    const now = sellable.get(vid) ?? 0;
    if (now < line.quantity) {
      missing.push({ lineId: line.id, description: line.description, reason: "not_in_stock" });
      continue;
    }
    sellable.set(vid, now - line.quantity);
    taken.push(line.id);
    statements.push(
      ledgerStmt(
        db,
        {
          variantId: vid,
          type: "hold",
          delta: -line.quantity,
          after: now - line.quantity,
          sourceType: "repair_job",
          sourceId: job.id,
          reason: `taken for repair job ${job.jobNumber}`,
        },
        actor,
      ),
    );
  }
  return { taken, missing, statements };
}

/**
 * Bring a job's taken parts back to ขายได้. Never more than งานนอก holds: if someone already put
 * the part back on the shelf by hand, there is nothing left to bring back.
 */
async function returnStmts(
  db: D1Database,
  job: JobRow,
  lines: readonly RepairJobLine[],
  actor: JobActor,
): Promise<D1PreparedStatement[]> {
  const parts = lines.filter((l) => l.state === "taken" && l.productVariantId);
  const { sellable, held } = await stockFor(
    db,
    parts.map((l) => l.productVariantId!),
  );
  const statements: D1PreparedStatement[] = [];
  for (const line of parts) {
    const vid = line.productVariantId!;
    const back = Math.min(line.quantity, held.get(vid) ?? 0);
    if (back <= 0) continue;
    held.set(vid, (held.get(vid) ?? 0) - back);
    const after = (sellable.get(vid) ?? 0) + back;
    sellable.set(vid, after);
    statements.push(
      ledgerStmt(
        db,
        {
          variantId: vid,
          type: "unhold",
          delta: back,
          after,
          sourceType: "repair_job",
          sourceId: job.id,
          reason: `back from repair job ${job.jobNumber}`,
        },
        actor,
      ),
    );
  }
  return statements;
}

// ── Write helpers ─────────────────────────────────────────────────────────────────────────────

interface EventInput {
  kind: string;
  from?: JobStatus | null;
  to?: JobStatus | null;
  note?: string | null;
  customerUpdate?: string | null;
  expectedAt?: number | null;
}

function eventStmt(db: D1Database, jobId: string, e: EventInput, actor: JobActor) {
  return db
    .prepare(
      `INSERT INTO repair_job_events
         (id, job_id, kind, from_status, to_status, note, customer_update, expected_at, user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      jobId,
      e.kind,
      e.from ?? null,
      e.to ?? null,
      e.note ?? null,
      e.customerUpdate ?? null,
      e.expectedAt ?? null,
      actor.userId,
      actor.now,
    );
}

/** A status change and its history row, with the customer's update for the step it reaches. */
function statusStmts(
  db: D1Database,
  job: JobRow,
  to: JobStatus,
  actor: JobActor,
  expectedAt: number | null = null,
): D1PreparedStatement[] {
  // The bill is issued to pay only while the job sits at พร้อมรับรถ.
  const billIssuedAt = to === "ready" ? actor.now : null;
  return [
    db
      .prepare("UPDATE repair_jobs SET status = ?, bill_issued_at = ?, updated_at = ? WHERE id = ?")
      .bind(to, billIssuedAt, actor.now, job.id),
    eventStmt(
      db,
      job.id,
      {
        kind: "status",
        from: job.status,
        to,
        customerUpdate: customerUpdateFor(to),
        expectedAt: to === "waiting_parts" ? expectedAt : null,
      },
      actor,
    ),
  ];
}

/** While the job is worked on, its status follows the lines: รออะไหล่ while a part waits. */
function restatusStmts(
  db: D1Database,
  job: JobRow,
  linesAfter: readonly RepairJobLine[],
  actor: JobActor,
): D1PreparedStatement[] {
  if (!isWorkStep(job.status)) return [];
  const derived = workStatusFor(linesAfter);
  if (derived === job.status) return [];
  return statusStmts(db, job, derived, actor, waitUntil(linesAfter));
}

const setState = (db: D1Database, lineIds: readonly string[], state: JobLineState, now: number) =>
  lineIds.map((id) =>
    db
      .prepare("UPDATE repair_job_lines SET state = ?, updated_at = ? WHERE id = ?")
      .bind(state, now, id),
  );

async function done(db: D1Database, jobId: string): Promise<JobResult> {
  const job = await getRepairJob(db, jobId);
  return job ? { ok: true, job } : fail(404, "not_found");
}

async function staffProblem(db: D1Database, ids: unknown): Promise<string | null> {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) return "no_such_staff";
  if (new Set(ids).size > MAX_MECHANICS) return "too_many_mechanics";
  for (const id of new Set(ids as string[])) {
    const row = await db
      .prepare("SELECT id FROM users WHERE id = ? AND status = 'active'")
      .bind(id)
      .first<{ id: string }>();
    if (!row) return "no_such_staff";
  }
  return null;
}

function mechanicStmts(db: D1Database, jobId: string, ids: readonly string[]) {
  return [
    db.prepare("DELETE FROM repair_job_mechanics WHERE job_id = ?").bind(jobId),
    ...[...new Set(ids)].map((id) =>
      db
        .prepare("INSERT INTO repair_job_mechanics (job_id, user_id) VALUES (?, ?)")
        .bind(jobId, id),
    ),
  ];
}

async function variantExists(db: D1Database, id: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT id FROM product_variants WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  return !!row;
}

// ── Open ──────────────────────────────────────────────────────────────────────────────────────

export interface OpenJobInput {
  licensePlate?: unknown;
  /** The province on the plate (plan 13.11, owner's pick A: required with the plate). */
  plateProvince?: unknown;
  vehicle?: unknown;
  mileageKm?: unknown;
  problem?: unknown;
  mechanicIds?: unknown;
}

/** A car comes in: เข้าใหม่, with the server's job number. */
export async function openRepairJob(
  db: D1Database,
  input: OpenJobInput,
  actor: JobActor,
): Promise<JobResult> {
  const plate = typeof input.licensePlate === "string" ? canonicalPlate(input.licensePlate) : "";
  if (!plate) return fail(400, "plate_required");
  const typedProvince = typeof input.plateProvince === "string" ? input.plateProvince : null;
  if (carProblem(plate, typedProvince)) return fail(400, "province_required");
  const province = canonicalProvince(typedProvince!);
  const vehicle = textOrNull(input.vehicle);
  const problem = textOrNull(input.problem);
  if (tooLong(vehicle) || tooLong(problem)) return fail(400, "text_too_long");
  const km = input.mileageKm ?? null;
  if (
    km !== null &&
    !(typeof km === "number" && Number.isInteger(km) && km >= 0 && km <= MAX_MILEAGE_KM)
  ) {
    return fail(400, "mileage must be a whole number of km, 0 to 9,999,999");
  }
  const mechanicIds = input.mechanicIds ?? [];
  const staff = await staffProblem(db, mechanicIds);
  if (staff) return fail(400, staff);

  const todayPrefix = nextJobNumber([], actor.now).slice(0, -3);
  const today = await db
    .prepare("SELECT job_number AS n FROM repair_jobs WHERE job_number LIKE ?")
    .bind(`${todayPrefix}%`)
    .all<{ n: string }>();
  const jobNumber = nextJobNumber(
    (today.results ?? []).map((r) => r.n),
    actor.now,
  );
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO repair_jobs
           (id, job_number, status, license_plate, plate_province, vehicle, mileage_km, problem,
            opened_by_user_id, created_at, updated_at)
         VALUES (?, ?, 'in', ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        jobNumber,
        plate,
        province,
        vehicle,
        km,
        problem,
        actor.userId,
        actor.now,
        actor.now,
      ),
    ...mechanicStmts(db, id, mechanicIds as string[]),
    eventStmt(db, id, { kind: "opened", to: "in", customerUpdate: customerUpdateFor("in") }, actor),
  ]);
  return done(db, id);
}

// ── Move ──────────────────────────────────────────────────────────────────────────────────────

/** Move a job to another step — forward one at a time, or back to any earlier one. */
export async function moveRepairJob(
  db: D1Database,
  jobId: string,
  to: unknown,
  actor: JobActor,
): Promise<JobResult> {
  if (!isJobStatus(to)) return fail(400, "unknown_status");
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  const lines = await readLines(db, jobId);
  const check = checkJobMove(job.status, to, lines);
  if (!check.ok) return fail(409, check.error);

  if (check.kind === "forward" || check.kind === "back" || check.kind === "ready") {
    await db.batch(statusStmts(db, job, to, actor));
    return done(db, jobId);
  }

  if (check.kind === "start_work") {
    // The estimate goes onto the job's bill: parts in stock into งานนอก, the rest wait.
    const estimate = lines.filter((l) => l.state === "estimate");
    const plan = await planTake(db, job, estimate, actor);
    const waiting = plan.missing.map((m) => m.lineId);
    const after = lines.map((l) =>
      waiting.includes(l.id)
        ? { ...l, state: "waiting" as const }
        : plan.taken.includes(l.id)
          ? { ...l, state: "taken" as const }
          : l,
    );
    await db.batch([
      ...plan.statements,
      ...setState(db, plan.taken, "taken", actor.now),
      ...setState(db, waiting, "waiting", actor.now),
      ...statusStmts(db, job, workStatusFor(after), actor, waitUntil(after)),
    ]);
    return done(db, jobId);
  }

  // end_wait: every waiting part must be in the system and in stock now — or nothing changes.
  const waiting = lines.filter((l) => l.state === "waiting");
  const plan = await planTake(db, job, waiting, actor);
  if (plan.missing.length > 0) return fail(409, "parts_missing", plan.missing);
  await db.batch([
    ...plan.statements,
    ...setState(db, plan.taken, "taken", actor.now),
    ...statusStmts(db, job, "working", actor),
  ]);
  return done(db, jobId);
}

// ── Lines ─────────────────────────────────────────────────────────────────────────────────────

export interface JobLineAdd {
  lineType?: unknown;
  productVariantId?: unknown;
  description?: unknown;
  quantity?: unknown;
  unitPriceSatang?: unknown;
  discountSatang?: unknown;
  expectedAt?: unknown;
}

const isTime = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

/** Lines can change until the bill is issued (พร้อมรับรถ) — and never on a closed job. */
function lockedError(job: JobRow): JobResult | null {
  if (isClosedJob(job.status)) return fail(409, "closed");
  if (job.status === "ready") return fail(409, "bill_issued");
  return null;
}

/**
 * Add a line. Before the work it is only on the estimate. During the work it goes straight onto the
 * job's bill: a part in stock into งานนอก, a missing one waits (and the job shows รออะไหล่).
 */
export async function addJobLine(
  db: D1Database,
  jobId: string,
  input: JobLineAdd,
  actor: JobActor,
): Promise<JobResult> {
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  const locked = lockedError(job);
  if (locked) return locked;
  const problem = jobLineProblem({
    lineType: input.lineType,
    productVariantId: input.productVariantId,
    description: input.description,
    quantity: input.quantity,
    unitPriceSatang: input.unitPriceSatang,
    discountSatang: input.discountSatang,
  });
  if (problem) return fail(400, problem);
  const variantId = typeof input.productVariantId === "string" ? input.productVariantId : null;
  if (variantId && !(await variantExists(db, variantId))) return fail(400, "no_such_product");
  const expectedAt = input.expectedAt ?? null;
  if (expectedAt !== null && !isTime(expectedAt)) return fail(400, "expected_at must be a time");

  const lines = await readLines(db, jobId);
  const draft: RepairJobLine = {
    id: crypto.randomUUID(),
    lineType: input.lineType as "part" | "service",
    productVariantId: variantId,
    description: (input.description as string).trim(),
    quantity: input.quantity as number,
    unitPriceSatang: input.unitPriceSatang as number,
    discountSatang: (input.discountSatang as number | undefined) ?? 0,
    state: "estimate",
    expectedAt,
  };
  // During the work a new line goes straight onto the job's bill; before it, on the estimate.
  const plan = isWorkStep(job.status) ? await planTake(db, job, [draft], actor) : null;
  const line: RepairJobLine = plan
    ? { ...draft, state: plan.missing.length > 0 ? "waiting" : "taken" }
    : draft;
  await db.batch([
    db
      .prepare(
        `INSERT INTO repair_job_lines
           (id, job_id, line_type, product_variant_id, description, quantity, unit_price_satang,
            discount_satang, state, expected_at, position, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        line.id,
        jobId,
        line.lineType,
        line.productVariantId,
        line.description,
        line.quantity,
        line.unitPriceSatang,
        line.discountSatang,
        line.state,
        line.state === "waiting" ? line.expectedAt : null,
        lines.length + 1,
        actor.now,
        actor.now,
      ),
    ...(plan?.statements ?? []),
    eventStmt(db, jobId, { kind: "line_added", note: line.description }, actor),
    ...restatusStmts(db, job, [...lines, line], actor),
  ]);
  return done(db, jobId);
}

export interface JobLineChange {
  description?: unknown;
  quantity?: unknown;
  unitPriceSatang?: unknown;
  discountSatang?: unknown;
  /** รออะไหล่ only: when the part should arrive (date and time). */
  expectedAt?: unknown;
  /** Link a part typed by name to the product staff just added with เพิ่มสินค้า. */
  productVariantId?: unknown;
}

/** Change a line: its name and price, a waiting part's time, or link a new part to its product. */
export async function changeJobLine(
  db: D1Database,
  jobId: string,
  lineId: string,
  patch: JobLineChange,
  actor: JobActor,
): Promise<JobResult> {
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  const locked = lockedError(job);
  if (locked) return locked;
  const lines = await readLines(db, jobId);
  const line = lines.find((l) => l.id === lineId);
  if (!line) return fail(404, "line_not_found");
  if (line.state === "removed" || line.state === "sold") return fail(409, "line_closed");

  let variantId = line.productVariantId;
  if (patch.productVariantId !== undefined) {
    if (line.lineType !== "part" || line.productVariantId) return fail(409, "already_linked");
    if (
      typeof patch.productVariantId !== "string" ||
      !(await variantExists(db, patch.productVariantId))
    ) {
      return fail(400, "no_such_product");
    }
    variantId = patch.productVariantId;
  }
  let expectedAt = line.expectedAt;
  if (patch.expectedAt !== undefined) {
    if (line.state !== "waiting") return fail(409, "expected_only_waiting");
    if (patch.expectedAt !== null && !isTime(patch.expectedAt)) {
      return fail(400, "expected_at must be a time");
    }
    expectedAt = patch.expectedAt;
  }
  const quantity = patch.quantity ?? line.quantity;
  if (quantity !== line.quantity && line.state === "taken" && line.lineType === "part") {
    // The part already sits in งานนอก for this job: take the line off and add it again.
    return fail(409, "quantity_locked");
  }
  const next = {
    lineType: line.lineType,
    productVariantId: variantId,
    description: patch.description ?? line.description,
    quantity,
    unitPriceSatang: patch.unitPriceSatang ?? line.unitPriceSatang,
    discountSatang: patch.discountSatang ?? line.discountSatang,
  };
  const problem = jobLineProblem(next);
  if (problem) return fail(400, problem);

  const changed: RepairJobLine = {
    ...line,
    ...next,
    description: (next.description as string).trim(),
    quantity: next.quantity as number,
    unitPriceSatang: next.unitPriceSatang as number,
    discountSatang: next.discountSatang as number,
    expectedAt,
  };
  const after = lines.map((l) => (l.id === lineId ? changed : l));
  const before = waitUntil(lines);
  const told = waitUntil(after);
  const tellCustomer = job.status === "waiting_parts" && told !== before;
  await db.batch([
    db
      .prepare(
        `UPDATE repair_job_lines SET product_variant_id = ?, description = ?, quantity = ?,
           unit_price_satang = ?, discount_satang = ?, expected_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(
        changed.productVariantId,
        changed.description,
        changed.quantity,
        changed.unitPriceSatang,
        changed.discountSatang,
        changed.expectedAt,
        actor.now,
        lineId,
      ),
    eventStmt(
      db,
      jobId,
      {
        kind: "line_changed",
        note: changed.description,
        customerUpdate: tellCustomer ? "waiting_parts" : null,
        expectedAt: tellCustomer ? told : null,
      },
      actor,
    ),
  ]);
  return done(db, jobId);
}

/** Take a line off the job. A part in งานนอก goes back to ขายได้; the line is kept as removed. */
export async function removeJobLine(
  db: D1Database,
  jobId: string,
  lineId: string,
  actor: JobActor,
): Promise<JobResult> {
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  const locked = lockedError(job);
  if (locked) return locked;
  const lines = await readLines(db, jobId);
  const line = lines.find((l) => l.id === lineId);
  if (!line) return fail(404, "line_not_found");
  if (line.state === "removed" || line.state === "sold") return fail(409, "line_closed");
  const after = lines.map((l) => (l.id === lineId ? { ...l, state: "removed" as const } : l));
  await db.batch([
    ...(await returnStmts(db, job, [line], actor)),
    ...setState(db, [lineId], "removed", actor.now),
    eventStmt(db, jobId, { kind: "line_removed", note: line.description }, actor),
    ...restatusStmts(db, job, after, actor),
  ]);
  return done(db, jobId);
}

// ── Mechanics ─────────────────────────────────────────────────────────────────────────────────

/** One or several mechanics on the job. */
export async function setJobMechanics(
  db: D1Database,
  jobId: string,
  userIds: unknown,
  actor: JobActor,
): Promise<JobResult> {
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  if (isClosedJob(job.status)) return fail(409, "closed");
  const staff = await staffProblem(db, userIds);
  if (staff) return fail(400, staff);
  await db.batch([
    ...mechanicStmts(db, jobId, userIds as string[]),
    eventStmt(db, jobId, { kind: "mechanics" }, actor),
  ]);
  return done(db, jobId);
}

// ── Cancel ────────────────────────────────────────────────────────────────────────────────────

/** Cancel with a reason: every part in งานนอก goes back to ขายได้; the job is kept, never deleted. */
export async function cancelRepairJob(
  db: D1Database,
  jobId: string,
  reason: unknown,
  actor: JobActor,
): Promise<JobResult> {
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  if (isClosedJob(job.status)) return fail(409, "closed");
  const why = textOrNull(reason);
  if (!why) return fail(400, "reason_required");
  if (tooLong(why)) return fail(400, "text_too_long");
  const lines = await readLines(db, jobId);
  const live = lines.filter((l) => l.state !== "removed");
  await db.batch([
    ...(await returnStmts(db, job, live, actor)),
    ...setState(
      db,
      live.map((l) => l.id),
      "removed",
      actor.now,
    ),
    db
      .prepare(
        `UPDATE repair_jobs SET status = 'cancelled', cancel_reason = ?, closed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(why, actor.now, actor.now, jobId),
    eventStmt(
      db,
      jobId,
      { kind: "cancelled", from: job.status, to: "cancelled", note: why },
      actor,
    ),
  ]);
  return done(db, jobId);
}

// ── Pay ───────────────────────────────────────────────────────────────────────────────────────

/** A bill line as the counter's pricing reads it (index.ts SyncLine). */
export interface BillLineIn {
  productVariantId: string | null;
  lineType: "part" | "service";
  description: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang: number;
}

/** The same line with the server's cost, VAT and profit filled in. */
export interface PricedBillLine {
  productVariantId?: string | null;
  lineType?: "part" | "service";
  description?: string;
  quantity: number;
  unitPriceSatang: number;
  discountSatang?: number;
  taxSatang?: number;
  unitCostSatang?: number;
  grossProfitSatang: number;
}

/** Handed in by index.ts (priceBillLines) so the job's bill is priced exactly like the counter's. */
export type PriceBillLines = (lines: BillLineIn[]) => Promise<PricedBillLine[]>;

/**
 * The customer pays: the job's bill becomes a paid bill (onsite_sales, sale_type 'repair', the
 * job's number), its parts are sold out of งานนอก, and the job closes — all in one write.
 */
export async function payRepairJob(
  db: D1Database,
  jobId: string,
  input: { paymentMethod?: unknown },
  actor: JobActor,
  priceLines: PriceBillLines,
): Promise<JobResult> {
  const job = await readJob(db, jobId);
  if (!job) return fail(404, "not_found");
  if (isClosedJob(job.status)) return fail(409, "closed");
  if (job.status !== "ready") return fail(409, "not_ready");
  const method = input.paymentMethod;
  if (!(PAYMENT_METHODS as readonly unknown[]).includes(method)) return fail(400, "payment_method");

  const lines = (await readLines(db, jobId)).filter((l) => l.state === "taken");
  const priced = await priceLines(
    lines.map((l) => ({
      productVariantId: l.productVariantId,
      lineType: l.lineType,
      description: l.description,
      quantity: l.quantity,
      unitPriceSatang: l.unitPriceSatang,
      discountSatang: l.discountSatang,
    })),
  );

  // Sold out of งานนอก first; anything brought back to the shelf by hand is sold from ขายได้.
  const parts = lines.filter((l) => l.lineType === "part" && l.productVariantId);
  const { sellable, held } = await stockFor(
    db,
    parts.map((l) => l.productVariantId!),
  );
  const need = new Map<string, number>();
  for (const l of parts)
    need.set(l.productVariantId!, (need.get(l.productVariantId!) ?? 0) + l.quantity);
  const missing: MissingPart[] = [];
  const unholds: D1PreparedStatement[] = [];
  for (const [vid, qty] of need) {
    const back = Math.min(qty, held.get(vid) ?? 0);
    const after = (sellable.get(vid) ?? 0) + back;
    if (after < qty) {
      for (const l of parts.filter((p) => p.productVariantId === vid)) {
        missing.push({ lineId: l.id, description: l.description, reason: "not_in_stock" });
      }
      continue;
    }
    sellable.set(vid, after);
    if (back > 0) {
      unholds.push(
        ledgerStmt(
          db,
          {
            variantId: vid,
            type: "unhold",
            delta: back,
            after,
            sourceType: "repair_job",
            sourceId: jobId,
            reason: `sold on repair job ${job.jobNumber}`,
          },
          actor,
        ),
      );
    }
  }
  if (missing.length > 0) return fail(409, "parts_missing", missing);

  const saleId = crypto.randomUUID();
  const subtotal = priced.reduce((s, l) => s + l.unitPriceSatang * l.quantity, 0);
  const discount = priced.reduce((s, l) => s + (l.discountSatang ?? 0), 0);
  const tax = priced.reduce((s, l) => s + (l.taxSatang ?? 0), 0);
  const saleLines: D1PreparedStatement[] = [];
  priced.forEach((l, i) => {
    const vid = lines[i]!.productVariantId;
    const isPart = lines[i]!.lineType === "part" && !!vid;
    saleLines.push(
      db
        .prepare(
          `INSERT INTO onsite_sale_lines
             (id, onsite_sale_id, product_variant_id, line_type, description, barcode_value, quantity,
              unit_price_satang, discount_satang, tax_satang, unit_cost_satang, gross_profit_satang)
           VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          saleId,
          isPart ? vid : null,
          isPart ? "part" : "service",
          lines[i]!.description,
          l.quantity,
          l.unitPriceSatang,
          l.discountSatang ?? 0,
          l.taxSatang ?? 0,
          isPart ? (l.unitCostSatang ?? 0) : 0,
          l.grossProfitSatang,
        ),
    );
    if (!isPart) return;
    const after = (sellable.get(vid) ?? 0) - l.quantity;
    sellable.set(vid, after);
    saleLines.push(
      ledgerStmt(
        db,
        {
          variantId: vid,
          type: "onsite_sale",
          delta: -l.quantity,
          after,
          sourceType: "onsite_sale",
          sourceId: saleId,
          reason: null,
        },
        actor,
      ),
    );
  });

  await db.batch([
    ...unholds,
    db
      .prepare(
        `INSERT INTO onsite_sales
           (id, client_uuid, sale_number, payment_method, sale_type, license_plate, plate_province,
            vehicle, notes, mileage_km, buyer_name, sync_status, subtotal_satang,
            discount_total_satang, tax_total_satang, grand_total_satang, sale_status, created_at)
         VALUES (?, ?, ?, ?, 'repair', ?, ?, ?, NULL, ?, NULL, 'synced', ?, ?, ?, ?, 'completed', ?)`,
      )
      .bind(
        saleId,
        `repair-job:${jobId}`,
        job.jobNumber,
        method as string,
        job.licensePlate,
        job.plateProvince,
        job.vehicle,
        job.mileageKm,
        subtotal,
        discount,
        tax,
        subtotal - discount,
        actor.now,
      ),
    ...saleLines,
    ...setState(
      db,
      lines.map((l) => l.id),
      "sold",
      actor.now,
    ),
    db
      .prepare(
        `UPDATE repair_jobs SET status = 'paid', sale_id = ?, closed_at = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(saleId, actor.now, actor.now, jobId),
    eventStmt(
      db,
      jobId,
      { kind: "paid", from: "ready", to: "paid", note: method as string },
      actor,
    ),
  ]);
  return done(db, jobId);
}

// ── One door for the StockLedger object ───────────────────────────────────────────────────────

/** Every job write, as the routes hand it to the StockLedger object. */
export type RepairJobAction =
  | { kind: "open"; input: OpenJobInput }
  | { kind: "move"; jobId: string; to: unknown }
  | { kind: "addLine"; jobId: string; input: JobLineAdd }
  | { kind: "changeLine"; jobId: string; lineId: string; patch: JobLineChange }
  | { kind: "removeLine"; jobId: string; lineId: string }
  | { kind: "mechanics"; jobId: string; userIds: unknown }
  | { kind: "cancel"; jobId: string; reason: unknown }
  | { kind: "pay"; jobId: string; input: { paymentMethod?: unknown } };

export function runRepairJobAction(
  db: D1Database,
  action: RepairJobAction,
  actor: JobActor,
  priceLines: PriceBillLines,
): Promise<JobResult> {
  switch (action.kind) {
    case "open":
      return openRepairJob(db, action.input, actor);
    case "move":
      return moveRepairJob(db, action.jobId, action.to, actor);
    case "addLine":
      return addJobLine(db, action.jobId, action.input, actor);
    case "changeLine":
      return changeJobLine(db, action.jobId, action.lineId, action.patch, actor);
    case "removeLine":
      return removeJobLine(db, action.jobId, action.lineId, actor);
    case "mechanics":
      return setJobMechanics(db, action.jobId, action.userIds, actor);
    case "cancel":
      return cancelRepairJob(db, action.jobId, action.reason, actor);
    case "pay":
      return payRepairJob(db, action.jobId, action.input, actor, priceLines);
  }
}

/**
 * Read a job route into its action; null when the path isn't a job write. `body` is the parsed
 * JSON (an object), or null for a DELETE.
 */
export function repairJobActionFor(
  method: string,
  path: string,
  body: Record<string, unknown> | null,
): RepairJobAction | null {
  const b = body ?? {};
  if (path === "/repair-jobs" && method === "POST") return { kind: "open", input: b };
  const m = path.match(
    /^\/repair-jobs\/([^/]+)(?:\/(status|lines|mechanics|cancel|pay)(?:\/([^/]+))?)?$/,
  );
  if (!m) return null;
  const jobId = decodeURIComponent(m[1]!);
  const lineId = m[3] ? decodeURIComponent(m[3]) : null;
  const what = m[2];
  if (what === "status" && method === "POST" && !lineId) return { kind: "move", jobId, to: b.to };
  if (what === "lines" && method === "POST" && !lineId) return { kind: "addLine", jobId, input: b };
  if (what === "lines" && method === "PATCH" && lineId) {
    return { kind: "changeLine", jobId, lineId, patch: b };
  }
  if (what === "lines" && method === "DELETE" && lineId)
    return { kind: "removeLine", jobId, lineId };
  if (what === "mechanics" && method === "PUT" && !lineId) {
    return { kind: "mechanics", jobId, userIds: b.userIds };
  }
  if (what === "cancel" && method === "POST" && !lineId)
    return { kind: "cancel", jobId, reason: b.reason };
  if (what === "pay" && method === "POST" && !lineId) return { kind: "pay", jobId, input: b };
  return null;
}
