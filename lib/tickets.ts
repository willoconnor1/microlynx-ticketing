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
  dueDate?: string | null;  // YYYY-MM-DD optional deadline; drives initial list placement
  sortOrder?: number;       // manual drag order within urgency group (0 = natural sort)
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

/* ---- sorting ---- */
export function sortUrgencyOldest(a: Ticket, b: Ticket): number {
  if (a.urgency !== b.urgency) return a.urgency - b.urgency;
  // Manual drag order (0 = not yet ordered; ties fall through to natural rule below)
  const aOrd = a.sortOrder ?? 0;
  const bOrd = b.sortOrder ?? 0;
  if (aOrd !== bOrd) return aOrd - bOrd;
  // Natural ranking rule tiebreak: due-date tickets first, then by date, then by dropoff
  const aHasDue = !!a.dueDate;
  const bHasDue = !!b.dueDate;
  if (aHasDue !== bHasDue) return aHasDue ? -1 : 1;
  if (aHasDue && bHasDue) {
    const d = a.dueDate!.localeCompare(b.dueDate!);
    if (d !== 0) return d;
  }
  const dd = a.dropoff.localeCompare(b.dropoff);
  if (dd !== 0) return dd;
  return a.id.localeCompare(b.id);
}
export function sortOldest(a: Ticket, b: Ticket): number {
  return a.dropoff.localeCompare(b.dropoff);
}
/* Complete & Picked Up columns: order by when they entered that status (entry order). */
export function sortEntryOrder(a: Ticket, b: Ticket): number {
  return (a.statusChangedAt || "").localeCompare(b.statusChangedAt || "");
}
