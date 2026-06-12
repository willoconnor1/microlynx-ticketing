/* Data layer — the single source of truth for tickets.
   Uses Neon Postgres when DATABASE_URL is set; otherwise an in-memory
   fallback so the app runs locally before the database is provisioned. */
import { eq, and } from "drizzle-orm";
import { db, hasDb } from "./db";
import { tickets as ticketsTable, counters, type TicketRow } from "./schema";
import { SEED_TICKETS, SEED_ARCHIVE, SEED_NEXT_ID } from "./seed";
import { todayISO, cmpDue, sortQueue, POS_STEP, posBetween, type Ticket, type Status, type Person, type DeviceType, type ServiceTag } from "./tickets";

export interface AppState {
  tickets: Ticket[]; // active (non-archived)
  archive: Ticket[]; // archived
}

export interface NewTicketInput {
  name: string;
  phone: string;
  desc: string;
  urgency: number;
  charger: boolean;
  assignedTo?: Person;
  deviceType?: DeviceType | null;
  serviceTag?: ServiceTag | null;
  status?: Status;
  dropoff: string;
  dropoffAmPm?: "AM" | "PM" | null;
  dueAt?: string | null;
}

export interface TicketPatch {
  name?: string;
  phone?: string;
  desc?: string;
  urgency?: number;
  charger?: boolean;
  assignedTo?: Person;
  deviceType?: DeviceType | null;
  serviceTag?: ServiceTag | null;
  status?: Status;
  dropoff?: string;
  dropoffAmPm?: "AM" | "PM" | null;
  dueAt?: string | null;
}

/* ============================================================
   In-memory fallback (no DATABASE_URL)
   ============================================================ */
type MemDb = { rows: Ticket[]; nextNo: number };
const g = globalThis as unknown as { __mlx?: MemDb };
function mem(): MemDb {
  if (!g.__mlx) {
    const rows = [
      ...SEED_TICKETS.map((t) => ({ ...t, assignedTo: t.assignedTo ?? ("keith" as Person), dueAt: t.dueAt ?? null, archivedAt: null })),
      ...SEED_ARCHIVE.map((t) => ({ ...t, assignedTo: t.assignedTo ?? ("keith" as Person), dueAt: t.dueAt ?? null })),
    ];
    const pos = initialPositions(rows);
    for (const r of rows) r.sortPos = pos.get(r.id) ?? null;
    g.__mlx = { rows, nextNo: SEED_NEXT_ID };
  }
  return g.__mlx;
}

/* ============================================================
   Position helpers (the ranking rule's storage side)
   ============================================================ */
/* Seed/backfill: number each urgency group 1024, 2048, ... in due-date order. */
function initialPositions(rows: Ticket[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let u = 1; u <= 5; u++) {
    rows
      .filter((r) => r.urgency === u && !r.archivedAt)
      .sort(cmpDue)
      .forEach((r, i) => map.set(r.id, (i + 1) * POS_STEP));
  }
  return map;
}

const MIN_GAP = 1e-6;
type PosUpdate = { id: string; sortPos: number };

/* Where a ticket slots into a group automatically: before the first ticket due later. */
function autoIndex(group: Ticket[], probe: Ticket): number {
  const i = group.findIndex((t) => cmpDue(probe, t) < 0);
  return i === -1 ? group.length : i;
}

/* Position for inserting at `index` in `group` (sorted, probe excluded).
   Returns the probe's pos plus renumbering for the rest of the group when the
   gap between neighbors is too small (or missing) to split. */
function placeAt(group: Ticket[], probeId: string, index: number): { pos: number; renumber: PosUpdate[] } {
  const prev = index > 0 ? group[index - 1].sortPos : null;
  const next = index < group.length ? group[index].sortPos : null;
  const prevMissing = index > 0 && group[index - 1].sortPos == null;
  const nextMissing = index < group.length && group[index].sortPos == null;
  if (!prevMissing && !nextMissing) {
    if (prev == null || next == null || next - prev >= MIN_GAP) {
      return { pos: posBetween(prev, next), renumber: [] };
    }
  }
  const ids = group.map((t) => t.id);
  ids.splice(index, 0, probeId);
  const all = ids.map((tid, i) => ({ id: tid, sortPos: (i + 1) * POS_STEP }));
  return {
    pos: all.find((r) => r.id === probeId)!.sortPos,
    renumber: all.filter((r) => r.id !== probeId),
  };
}

/* Non-archived tickets in one urgency group, in display order, minus the moving ticket. */
function groupTickets(all: Ticket[], urgency: number, excludeId: string | null): Ticket[] {
  return all
    .filter((t) => !t.archivedAt && t.urgency === urgency && t.id !== excludeId)
    .sort(sortQueue);
}

async function dbActiveTickets(): Promise<Ticket[]> {
  const rows = await db.select().from(ticketsTable).where(eq(ticketsTable.archived, false));
  return rows.map(rowToTicket);
}

async function dbApplyRenumber(renumber: PosUpdate[]) {
  // neon-http has no transactions; per-row updates are fine for a 3-person shop.
  for (const r of renumber) {
    await db.update(ticketsTable).set({ sortPos: r.sortPos }).where(eq(ticketsTable.id, r.id));
  }
}

/* ============================================================
   Row mapping (DB <-> Ticket)
   ============================================================ */
function rowToTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    desc: r.desc,
    urgency: r.urgency,
    charger: r.charger,
    assignedTo: (r.assignedTo as Person) || "keith",
    deviceType: (r.deviceType as DeviceType | null) ?? null,
    serviceTag: (r.serviceTag as ServiceTag | null) ?? null,
    status: r.status as Status,
    dropoff: r.dropoff,
    dropoffAmPm: r.dropoffAmPm as "AM" | "PM" | null,
    dueAt: r.dueAt ? new Date(r.dueAt).toISOString() : null,
    sortPos: r.sortPos,
    pickedAt: r.pickedAt,
    statusChangedAt: r.statusChangedAt ? new Date(r.statusChangedAt).toISOString() : null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    archivedAt: r.archivedAt,
  };
}

/* ============================================================
   Seeding (DB only — runs once when the table is empty)
   ============================================================ */
async function ensureSeeded() {
  const existing = await db.select({ id: ticketsTable.id }).from(ticketsTable).limit(1);
  if (existing.length) return;
  const now = new Date();
  const seedAll = [...SEED_TICKETS, ...SEED_ARCHIVE];
  const pos = initialPositions(seedAll.map((t) => ({ ...t, archivedAt: t.archivedAt ?? null })));
  const rows = seedAll.map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    desc: t.desc,
    urgency: t.urgency,
    charger: t.charger,
    status: t.status,
    dropoff: t.dropoff,
    dueAt: t.dueAt ? new Date(t.dueAt) : null,
    sortPos: pos.get(t.id) ?? null,
    pickedAt: t.pickedAt ?? null,
    statusChangedAt: t.statusChangedAt ? new Date(t.statusChangedAt) : now,
    createdAt: now,
    archived: !!t.archivedAt,
    archivedAt: t.archivedAt ?? null,
  }));
  await db.insert(ticketsTable).values(rows);
  await db.insert(counters).values({ nextTicketNo: SEED_NEXT_ID }).onConflictDoNothing();
}

/* ============================================================
   Public API
   ============================================================ */
export async function getState(): Promise<AppState> {
  // Auto-archive on every read so stale picked-up tickets leave the boards.
  await sweepArchive();

  if (!hasDb) {
    const m = mem();
    return {
      tickets: m.rows.filter((t) => !t.archivedAt),
      archive: m.rows.filter((t) => t.archivedAt),
    };
  }

  await ensureSeeded();
  const rows = await db.select().from(ticketsTable);
  const all = rows.map(rowToTicket);
  return {
    tickets: all.filter((t) => !t.archivedAt),
    archive: all.filter((t) => t.archivedAt),
  };
}

export async function createTicket(input: NewTicketInput): Promise<AppState> {
  const nowIso = new Date().toISOString();
  const dueAt = input.dueAt ?? null;

  if (!hasDb) {
    const m = mem();
    const id = `MLX-${m.nextNo++}`;
    const t: Ticket = {
      id,
      name: input.name,
      phone: input.phone,
      desc: input.desc,
      urgency: input.urgency,
      charger: input.charger,
      assignedTo: input.assignedTo ?? "keith",
      deviceType: input.deviceType ?? null,
      serviceTag: input.serviceTag ?? null,
      status: input.status ?? "todo",
      dropoff: input.dropoff,
      dropoffAmPm: input.dropoffAmPm ?? null,
      dueAt,
      sortPos: null,
      pickedAt: input.status === "picked" ? todayISO() : null,
      statusChangedAt: nowIso,
      createdAt: nowIso,
      archivedAt: null,
    };
    const group = groupTickets(m.rows, t.urgency, t.id);
    const placed = placeAt(group, t.id, autoIndex(group, t));
    t.sortPos = placed.pos;
    for (const r of placed.renumber) {
      const row = m.rows.find((x) => x.id === r.id);
      if (row) row.sortPos = r.sortPos;
    }
    m.rows.unshift(t);
    return getState();
  }

  await ensureSeeded();
  // Atomically take the next ticket number.
  const [c] = await db.select().from(counters).limit(1);
  const nextNo = c?.nextTicketNo ?? SEED_NEXT_ID;
  await db.update(counters).set({ nextTicketNo: nextNo + 1 }).where(eq(counters.id, c.id));

  const id = `MLX-${nextNo}`;
  const probe: Ticket = {
    id, name: input.name, phone: input.phone, desc: input.desc,
    urgency: input.urgency, charger: input.charger, status: input.status ?? "todo",
    dropoff: input.dropoff, dueAt,
  };
  const group = groupTickets(await dbActiveTickets(), probe.urgency, id);
  const placed = placeAt(group, id, autoIndex(group, probe));
  await dbApplyRenumber(placed.renumber);

  await db.insert(ticketsTable).values({
    id,
    name: input.name,
    phone: input.phone,
    desc: input.desc,
    urgency: input.urgency,
    charger: input.charger,
    assignedTo: input.assignedTo ?? "keith",
    deviceType: input.deviceType ?? null,
    serviceTag: input.serviceTag ?? null,
    status: input.status ?? "todo",
    dropoff: input.dropoff,
    dropoffAmPm: input.dropoffAmPm ?? null,
    dueAt: dueAt ? new Date(dueAt) : null,
    sortPos: placed.pos,
    pickedAt: input.status === "picked" ? todayISO() : null,
  });
  return getState();
}

export async function updateTicket(id: string, patch: TicketPatch): Promise<AppState> {
  const statusChanging = patch.status !== undefined;

  if (!hasDb) {
    const m = mem();
    const t = m.rows.find((x) => x.id === id);
    if (t) {
      const reslot =
        (patch.urgency !== undefined && patch.urgency !== t.urgency) ||
        (patch.dueAt !== undefined && (patch.dueAt ?? null) !== (t.dueAt ?? null));
      if (patch.name !== undefined) t.name = patch.name;
      if (patch.phone !== undefined) t.phone = patch.phone;
      if (patch.desc !== undefined) t.desc = patch.desc;
      if (patch.urgency !== undefined) t.urgency = patch.urgency;
      if (patch.charger !== undefined) t.charger = patch.charger;
      if (patch.assignedTo !== undefined) t.assignedTo = patch.assignedTo;
      if (patch.deviceType !== undefined) t.deviceType = patch.deviceType ?? null;
      if (patch.serviceTag !== undefined) t.serviceTag = patch.serviceTag ?? null;
      if (patch.dropoff !== undefined) t.dropoff = patch.dropoff;
      if (patch.dropoffAmPm !== undefined) t.dropoffAmPm = patch.dropoffAmPm ?? null;
      if (patch.dueAt !== undefined) t.dueAt = patch.dueAt ?? null;
      if (statusChanging && patch.status) {
        t.status = patch.status;
        t.statusChangedAt = new Date().toISOString();
        t.pickedAt = patch.status === "picked" ? t.pickedAt || todayISO() : null;
        // Picked up = archived immediately; any other status pulls it back out.
        t.archivedAt = patch.status === "picked" ? t.archivedAt || todayISO() : null;
      }
      if (reslot) {
        // Urgency or due date changed — the ticket re-enters the automatic order
        // (this intentionally clears any manual pin).
        const group = groupTickets(m.rows, t.urgency, t.id);
        const placed = placeAt(group, t.id, autoIndex(group, t));
        t.sortPos = placed.pos;
        for (const r of placed.renumber) {
          const row = m.rows.find((x) => x.id === r.id);
          if (row) row.sortPos = r.sortPos;
        }
      }
    }
    return getState();
  }

  const set: Partial<TicketRow> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.phone !== undefined) set.phone = patch.phone;
  if (patch.desc !== undefined) set.desc = patch.desc;
  if (patch.urgency !== undefined) set.urgency = patch.urgency;
  if (patch.charger !== undefined) set.charger = patch.charger;
  if (patch.assignedTo !== undefined) set.assignedTo = patch.assignedTo;
  if (patch.deviceType !== undefined) set.deviceType = patch.deviceType ?? null;
  if (patch.serviceTag !== undefined) set.serviceTag = patch.serviceTag ?? null;
  if (patch.dropoff !== undefined) set.dropoff = patch.dropoff;
  if (patch.dropoffAmPm !== undefined) set.dropoffAmPm = patch.dropoffAmPm ?? null;
  if (patch.dueAt !== undefined) set.dueAt = patch.dueAt ? new Date(patch.dueAt) : null;
  if (statusChanging && patch.status) {
    set.status = patch.status;
    set.statusChangedAt = new Date();
    if (patch.status === "picked") {
      const [cur] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
      set.pickedAt = cur?.pickedAt || todayISO();
      // Picked up = archived immediately.
      set.archived = true;
      set.archivedAt = cur?.archivedAt || todayISO();
    } else {
      set.pickedAt = null;
      // Any other status pulls the ticket back out of the archive.
      set.archived = false;
      set.archivedAt = null;
    }
  }

  if (patch.urgency !== undefined || patch.dueAt !== undefined) {
    const all = await dbActiveTickets();
    const cur = all.find((t) => t.id === id);
    if (cur) {
      const nextUrgency = patch.urgency ?? cur.urgency;
      const nextDueAt = patch.dueAt !== undefined ? patch.dueAt ?? null : cur.dueAt ?? null;
      const changed = nextUrgency !== cur.urgency || nextDueAt !== (cur.dueAt ?? null);
      if (changed) {
        // Re-enter the automatic order (clears any manual pin).
        const probe: Ticket = { ...cur, urgency: nextUrgency, dueAt: nextDueAt };
        const group = groupTickets(all, nextUrgency, id);
        const placed = placeAt(group, id, autoIndex(group, probe));
        set.sortPos = placed.pos;
        await dbApplyRenumber(placed.renumber);
      }
    }
  }

  await db.update(ticketsTable).set(set).where(eq(ticketsTable.id, id));
  return getState();
}

/* Manual reorder from the list: pin the ticket between two neighbors (and adopt the
   group's urgency when the drag crossed groups). Neighbors are resolved by id on the
   server so a concurrent edit degrades to auto-placement instead of a bad position. */
export async function moveTicket(
  id: string,
  urgency: number,
  prevId: string | null,
  nextId: string | null
): Promise<AppState> {
  const place = (all: Ticket[], t: Ticket): { pos: number; renumber: PosUpdate[] } => {
    const group = groupTickets(all, urgency, id);
    let index = -1;
    if (nextId) {
      const i = group.findIndex((x) => x.id === nextId);
      if (i !== -1) index = i;
    } else if (prevId) {
      const i = group.findIndex((x) => x.id === prevId);
      if (i !== -1) index = i + 1;
    } else {
      index = group.length;
    }
    if (index === -1) index = autoIndex(group, { ...t, urgency }); // neighbor vanished — fall back
    return placeAt(group, id, index);
  };

  if (!hasDb) {
    const m = mem();
    const t = m.rows.find((x) => x.id === id);
    if (t) {
      const placed = place(m.rows, t);
      t.urgency = urgency;
      t.sortPos = placed.pos;
      for (const r of placed.renumber) {
        const row = m.rows.find((x) => x.id === r.id);
        if (row) row.sortPos = r.sortPos;
      }
    }
    return getState();
  }

  const all = await dbActiveTickets();
  const t = all.find((x) => x.id === id);
  if (t) {
    const placed = place(all, t);
    await dbApplyRenumber(placed.renumber);
    await db.update(ticketsTable).set({ urgency, sortPos: placed.pos }).where(eq(ticketsTable.id, id));
  }
  return getState();
}

/* Permanent removal — no archive, no undo. The UI confirms before calling this. */
export async function deleteTicket(id: string): Promise<AppState> {
  if (!hasDb) {
    const m = mem();
    const i = m.rows.findIndex((x) => x.id === id);
    if (i !== -1) m.rows.splice(i, 1);
    return getState();
  }
  await db.delete(ticketsTable).where(eq(ticketsTable.id, id));
  return getState();
}

/* Backstop only: picked-up tickets archive the moment their status changes (see
   updateTicket). This catches rows picked before that rule existed, or any edge
   case that slipped through. "parts" tickets are never touched — only "picked". */
export async function sweepArchive(): Promise<number> {
  const today = todayISO();

  if (!hasDb) {
    const m = mem();
    let n = 0;
    for (const t of m.rows) {
      if (t.status === "picked" && !t.archivedAt) {
        t.archivedAt = today;
        n++;
      }
    }
    return n;
  }

  const res = await db
    .update(ticketsTable)
    .set({ archived: true, archivedAt: today })
    .where(and(eq(ticketsTable.status, "picked"), eq(ticketsTable.archived, false)))
    .returning({ id: ticketsTable.id });
  return res.length;
}
