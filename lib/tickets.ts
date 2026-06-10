/* Shared ticket types, config, and helpers (server + client safe). */

export type Status = "todo" | "prog" | "done" | "picked";

export interface Ticket {
  id: string;
  name: string;
  phone: string;
  desc: string;
  urgency: number; // 1-5, 1 = most urgent
  charger: boolean;
  status: Status;
  dropoff: string; // YYYY-MM-DD
  dueAt?: string | null; // ISO timestamp — optional promised-by date & time
  sortPos?: number | null; // position within the urgency group (auto from dueAt, manual on drag)
  pickedAt?: string | null; // YYYY-MM-DD set when status === 'picked'
  statusChangedAt?: string | null; // ISO timestamp, updated on any status change
  createdAt?: string | null; // ISO timestamp
  archivedAt?: string | null; // YYYY-MM-DD set when archived
}

export const URGENCY: Record<number, { label: string; short: string }> = {
  1: { label: "Most urgent", short: "Critical" },
  2: { label: "High", short: "High" },
  3: { label: "Medium", short: "Medium" },
  4: { label: "Low", short: "Low" },
  5: { label: "Whenever", short: "Backlog" },
};

export const STATUS: Record<Status, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "todo" },
  prog: { label: "In progress", cls: "prog" },
  done: { label: "Complete", cls: "done" },
  picked: { label: "Picked up", cls: "picked" },
};

export const STATUS_ORDER: Status[] = ["todo", "prog", "done", "picked"];

/* ---- date helpers ---- */
export function fmtDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export function fmtDateLong(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T12:00:00").getTime();
  const b = new Date(isoB + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}
/* Shop staff are Pacific; pin the display timezone so any stray browser shows shop time. */
export function fmtDueAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/* ---- sorting ---- */
/* Order within an urgency group when no position is saved:
   soonest due first, no due date last, then oldest drop-off, then id. */
export function cmpDue(a: Ticket, b: Ticket): number {
  const ad = a.dueAt || "", bd = b.dueAt || "";
  if (ad !== bd) {
    if (!ad) return 1;
    if (!bd) return -1;
    return ad.localeCompare(bd);
  }
  if (a.dropoff !== b.dropoff) return a.dropoff.localeCompare(b.dropoff);
  return a.id.localeCompare(b.id);
}
/* The master queue rule: urgency first (a level-N ticket never sorts above level N-1),
   then the saved position. sortPos is assigned automatically from the due date and
   overridden by manual drags in the list. */
export function sortQueue(a: Ticket, b: Ticket): number {
  if (a.urgency !== b.urgency) return a.urgency - b.urgency; // 1 first
  const ap = a.sortPos ?? Infinity, bp = b.sortPos ?? Infinity;
  if (ap !== bp) return ap - bp;
  return cmpDue(a, b);
}

/* ---- positions ---- */
export const POS_STEP = 1024;
/* Midpoint between two neighbors' positions; ends step out by POS_STEP. */
export function posBetween(prev: number | null | undefined, next: number | null | undefined): number {
  if (prev == null && next == null) return POS_STEP;
  if (prev == null) return (next as number) - POS_STEP;
  if (next == null) return prev + POS_STEP;
  return (prev + next) / 2;
}
/* Complete & Picked Up columns: order by when they entered that status (entry order). */
export function sortEntryOrder(a: Ticket, b: Ticket): number {
  return (a.statusChangedAt || "").localeCompare(b.statusChangedAt || "");
}
