/* Data layer — the single source of truth for tickets.
   Uses Neon Postgres when DATABASE_URL is set; otherwise an in-memory
   fallback so the app runs locally before the database is provisioned. */
import { eq, and, lt } from "drizzle-orm";
import { db, hasDb } from "./db";
import { tickets as ticketsTable, counters, type TicketRow } from "./schema";
import { SEED_TICKETS, SEED_ARCHIVE, SEED_NEXT_ID } from "./seed";
import { todayISO, daysBetween, sortUrgencyOldest, type Ticket, type Status } from "./tickets";

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
  status?: Status;
  dropoff: string;
  dueDate?: string | null;
}

export interface TicketPatch {
  name?: string;
  phone?: string;
  desc?: string;
  urgency?: number;
  charger?: boolean;
  status?: Status;
  dropoff?: string;
  dueDate?: string | null;
  sortOrder?: number;
}

const ARCHIVE_AFTER_DAYS = 3;

/* ============================================================
   In-memory fallback (no DATABASE_URL)
   ============================================================ */
type MemDb = { rows: Ticket[]; nextNo: number };
const g = globalThis as unknown as { __mlx?: MemDb };
function mem(): MemDb {
  if (!g.__mlx) {
    g.__mlx = {
      rows: [
        ...SEED_TICKETS.map((t) => ({ ...t, archivedAt: null })),
        ...SEED_ARCHIVE.map((t) => ({ ...t })),
      ],
      nextNo: SEED_NEXT_ID,
    };
  }
  return g.__mlx;
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
    status: r.status as Status,
    dropoff: r.dropoff,
    dueDate: r.dueDate ?? null,
    sortOrder: r.sortOrder ?? 0,
    pickedAt: r.pickedAt,
    statusChangedAt: r.statusChangedAt ? new Date(r.statusChangedAt).toISOString() : null,
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    archivedAt: r.archivedAt,
  };
}

/* ============================================================
   Sort-order helpers
   ============================================================ */

// Returns active tickets in an urgency group, sorted by current sort order.
function getGroupSortedMem(urgency: number): Ticket[] {
  return mem().rows
    .filter((t) => t.urgency === urgency && !t.archivedAt)
    .sort(sortUrgencyOldest);
}

async function getGroupSortedDb(urgency: number): Promise<Ticket[]> {
  const rows = await db
    .select()
    .from(ticketsTable)
    .where(and(eq(ticketsTable.urgency, urgency), eq(ticketsTable.archived, false)));
  return rows.map(rowToTicket).sort(sortUrgencyOldest);
}

/*
  Given a sorted urgency group and a dueDate, returns:
  - sortOrder for the new ticket
  - renumberMap: existing ticket ids → new sortOrder values

  Rules (per the ranking rule):
  - No dueDate → insert at the bottom of the group.
  - With dueDate → insert after the last ticket (in current list order) whose dueDate
    is strictly earlier. If none, insert at the top.

  All existing tickets are renumbered with 1000-step intervals to make clean room.
*/
function computeInsertSortOrder(
  group: Ticket[],
  dueDate: string | null | undefined
): { sortOrder: number; renumberMap: Map<string, number> } {
  let insertIdx = group.length; // default: bottom

  if (dueDate) {
    insertIdx = 0; // default: top (due-date tickets jump ahead)
    for (let i = 0; i < group.length; i++) {
      if (group[i].dueDate && group[i].dueDate! < dueDate) {
        insertIdx = i + 1;
      }
    }
  }

  // Renumber existing tickets: before insertIdx → 1000,2000,…; after → (insertIdx+2)*1000,…
  const renumberMap = new Map<string, number>();
  for (let i = 0; i < group.length; i++) {
    const newOrder = i < insertIdx ? (i + 1) * 1000 : (i + 2) * 1000;
    if ((group[i].sortOrder ?? 0) !== newOrder) {
      renumberMap.set(group[i].id, newOrder);
    }
  }

  return { sortOrder: (insertIdx + 1) * 1000, renumberMap };
}

/* ============================================================
   Seeding (DB only — runs once when the table is empty)
   ============================================================ */
async function ensureSeeded() {
  const existing = await db.select({ id: ticketsTable.id }).from(ticketsTable).limit(1);
  if (existing.length) return;
  const now = new Date();
  const rows = [...SEED_TICKETS, ...SEED_ARCHIVE].map((t) => ({
    id: t.id,
    name: t.name,
    phone: t.phone,
    desc: t.desc,
    urgency: t.urgency,
    charger: t.charger,
    status: t.status,
    dropoff: t.dropoff,
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
  const dueDate = input.dueDate ?? null;

  if (!hasDb) {
    const m = mem();
    const group = getGroupSortedMem(input.urgency);
    const { sortOrder, renumberMap } = computeInsertSortOrder(group, dueDate);
    for (const t of m.rows) {
      if (renumberMap.has(t.id)) t.sortOrder = renumberMap.get(t.id)!;
    }
    const id = `MLX-${m.nextNo++}`;
    m.rows.unshift({
      id,
      name: input.name,
      phone: input.phone,
      desc: input.desc,
      urgency: input.urgency,
      charger: input.charger,
      status: input.status ?? "todo",
      dropoff: input.dropoff,
      dueDate,
      sortOrder,
      pickedAt: input.status === "picked" ? todayISO() : null,
      statusChangedAt: nowIso,
      createdAt: nowIso,
      archivedAt: null,
    });
    return getState();
  }

  await ensureSeeded();
  const group = await getGroupSortedDb(input.urgency);
  const { sortOrder, renumberMap } = computeInsertSortOrder(group, dueDate);
  for (const [tid, newSortOrder] of renumberMap) {
    await db.update(ticketsTable).set({ sortOrder: newSortOrder }).where(eq(ticketsTable.id, tid));
  }

  // Atomically take the next ticket number.
  const [c] = await db.select().from(counters).limit(1);
  const nextNo = c?.nextTicketNo ?? SEED_NEXT_ID;
  await db.update(counters).set({ nextTicketNo: nextNo + 1 }).where(eq(counters.id, c.id));

  await db.insert(ticketsTable).values({
    id: `MLX-${nextNo}`,
    name: input.name,
    phone: input.phone,
    desc: input.desc,
    urgency: input.urgency,
    charger: input.charger,
    status: input.status ?? "todo",
    dropoff: input.dropoff,
    dueDate,
    sortOrder,
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
      // When urgency actually changes, recompute sort position in the new group.
      if (patch.urgency !== undefined && patch.urgency !== t.urgency) {
        t.urgency = patch.urgency;
        const newGroup = getGroupSortedMem(patch.urgency).filter((x) => x.id !== id);
        const { sortOrder, renumberMap } = computeInsertSortOrder(newGroup, t.dueDate);
        for (const r of m.rows) {
          if (renumberMap.has(r.id)) r.sortOrder = renumberMap.get(r.id)!;
        }
        t.sortOrder = sortOrder;
      } else if (patch.urgency !== undefined) {
        t.urgency = patch.urgency;
      }
      if (patch.name !== undefined) t.name = patch.name;
      if (patch.phone !== undefined) t.phone = patch.phone;
      if (patch.desc !== undefined) t.desc = patch.desc;
      if (patch.charger !== undefined) t.charger = patch.charger;
      if (patch.dropoff !== undefined) t.dropoff = patch.dropoff;
      if (patch.dueDate !== undefined) t.dueDate = patch.dueDate;
      if (patch.sortOrder !== undefined) t.sortOrder = patch.sortOrder;
      if (statusChanging && patch.status) {
        t.status = patch.status;
        t.statusChangedAt = new Date().toISOString();
        t.pickedAt = patch.status === "picked" ? t.pickedAt || todayISO() : null;
      }
    }
    return getState();
  }

  // Fetch the current row if we need it for urgency comparison or picked status.
  let cur: TicketRow | undefined;
  if (patch.urgency !== undefined || (statusChanging && patch.status === "picked")) {
    const [row] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
    cur = row;
  }

  const set: Partial<TicketRow> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.phone !== undefined) set.phone = patch.phone;
  if (patch.desc !== undefined) set.desc = patch.desc;
  if (patch.charger !== undefined) set.charger = patch.charger;
  if (patch.dropoff !== undefined) set.dropoff = patch.dropoff;
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;

  if (patch.urgency !== undefined) {
    set.urgency = patch.urgency;
    // When urgency actually changes, re-place the ticket in the new group.
    if (cur && cur.urgency !== patch.urgency) {
      const curTicket = rowToTicket(cur);
      const newGroup = (await getGroupSortedDb(patch.urgency)).filter((t) => t.id !== id);
      const { sortOrder, renumberMap } = computeInsertSortOrder(newGroup, curTicket.dueDate);
      for (const [tid, newSortOrder] of renumberMap) {
        await db.update(ticketsTable).set({ sortOrder: newSortOrder }).where(eq(ticketsTable.id, tid));
      }
      set.sortOrder = sortOrder;
    }
  }

  if (statusChanging && patch.status) {
    set.status = patch.status;
    set.statusChangedAt = new Date();
    if (patch.status === "picked") {
      set.pickedAt = cur?.pickedAt || todayISO();
    } else {
      set.pickedAt = null;
    }
  }

  await db.update(ticketsTable).set(set).where(eq(ticketsTable.id, id));
  return getState();
}

/*
  Move ticket `id` to the position just after `prevId` (null = move to top)
  within its urgency group, then renumber the whole group with 1000-step intervals.
*/
export async function reorderTicket(id: string, prevId: string | null): Promise<AppState> {
  if (!hasDb) {
    const m = mem();
    const ticket = m.rows.find((t) => t.id === id && !t.archivedAt);
    if (!ticket) return getState();
    const group = getGroupSortedMem(ticket.urgency);
    const others = group.filter((t) => t.id !== id);
    const prevIdx = prevId ? others.findIndex((t) => t.id === prevId) : -1;
    const newOrder = [...others.slice(0, prevIdx + 1), ticket, ...others.slice(prevIdx + 1)];
    newOrder.forEach((t, i) => {
      const row = m.rows.find((r) => r.id === t.id);
      if (row) row.sortOrder = (i + 1) * 1000;
    });
    return getState();
  }

  await ensureSeeded();
  const [row] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
  if (!row) return getState();
  const ticket = rowToTicket(row);
  const group = await getGroupSortedDb(ticket.urgency);
  const others = group.filter((t) => t.id !== id);
  const prevIdx = prevId ? others.findIndex((t) => t.id === prevId) : -1;
  const newOrder = [...others.slice(0, prevIdx + 1), ticket, ...others.slice(prevIdx + 1)];
  for (let i = 0; i < newOrder.length; i++) {
    await db
      .update(ticketsTable)
      .set({ sortOrder: (i + 1) * 1000 })
      .where(eq(ticketsTable.id, newOrder[i].id));
  }
  return getState();
}

export async function sweepArchive(): Promise<number> {
  const today = todayISO();

  if (!hasDb) {
    const m = mem();
    let n = 0;
    for (const t of m.rows) {
      if (t.status === "picked" && !t.archivedAt && t.pickedAt && daysBetween(t.pickedAt, today) > ARCHIVE_AFTER_DAYS) {
        t.archivedAt = today;
        n++;
      }
    }
    return n;
  }

  const cutoff = new Date(Date.now() - ARCHIVE_AFTER_DAYS * 86400000).toISOString().slice(0, 10);
  const res = await db
    .update(ticketsTable)
    .set({ archived: true, archivedAt: today })
    .where(and(eq(ticketsTable.status, "picked"), eq(ticketsTable.archived, false), lt(ticketsTable.pickedAt, cutoff)))
    .returning({ id: ticketsTable.id });
  return res.length;
}
