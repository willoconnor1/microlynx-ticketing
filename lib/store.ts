/* Data layer — the single source of truth for tickets.
   Uses Neon Postgres when DATABASE_URL is set; otherwise an in-memory
   fallback so the app runs locally before the database is provisioned. */
import { eq, and, lt } from "drizzle-orm";
import { db, hasDb } from "./db";
import { tickets as ticketsTable, counters, type TicketRow } from "./schema";
import { SEED_TICKETS, SEED_ARCHIVE, SEED_NEXT_ID } from "./seed";
import { todayISO, daysBetween, type Ticket, type Status } from "./tickets";

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
}

export interface TicketPatch {
  name?: string;
  phone?: string;
  desc?: string;
  urgency?: number;
  charger?: boolean;
  status?: Status;
  dropoff?: string;
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

  if (!hasDb) {
    const m = mem();
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
      pickedAt: input.status === "picked" ? todayISO() : null,
      statusChangedAt: nowIso,
      createdAt: nowIso,
      archivedAt: null,
    });
    return getState();
  }

  await ensureSeeded();
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
      if (patch.name !== undefined) t.name = patch.name;
      if (patch.phone !== undefined) t.phone = patch.phone;
      if (patch.desc !== undefined) t.desc = patch.desc;
      if (patch.urgency !== undefined) t.urgency = patch.urgency;
      if (patch.charger !== undefined) t.charger = patch.charger;
      if (patch.dropoff !== undefined) t.dropoff = patch.dropoff;
      if (statusChanging && patch.status) {
        t.status = patch.status;
        t.statusChangedAt = new Date().toISOString();
        t.pickedAt = patch.status === "picked" ? t.pickedAt || todayISO() : null;
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
  if (patch.dropoff !== undefined) set.dropoff = patch.dropoff;
  if (statusChanging && patch.status) {
    set.status = patch.status;
    set.statusChangedAt = new Date();
    if (patch.status === "picked") {
      const [cur] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id)).limit(1);
      set.pickedAt = cur?.pickedAt || todayISO();
    } else {
      set.pickedAt = null;
    }
  }
  await db.update(ticketsTable).set(set).where(eq(ticketsTable.id, id));
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
