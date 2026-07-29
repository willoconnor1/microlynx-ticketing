/* Shared ticket types, config, and helpers (server + client safe). */

export type Status = "todo" | "prog" | "call" | "resp" | "parts" | "done" | "picked";
export type Person = "keith" | "garrett" | "marisa";
export type DeviceType = "desktop" | "laptop" | "printer" | "aio" | "misc";
export type ServiceTag = "expedite" | "contract";

export const PEOPLE: { key: Person; label: string }[] = [
  { key: "keith", label: "Keith" },
  { key: "garrett", label: "Garrett" },
  { key: "marisa", label: "Marisa" },
];

export const DEVICE_TYPES: { key: DeviceType; label: string }[] = [
  { key: "laptop", label: "Laptop" },
  { key: "desktop", label: "Desktop" },
  { key: "printer", label: "Printer" },
  { key: "aio", label: "AIO" },
  { key: "misc", label: "Misc" },
];

/* Expedite and contract are mutually exclusive; most tickets are neither (null). */
export const SERVICE_TAGS: { key: ServiceTag; label: string }[] = [
  { key: "expedite", label: "Expedite" },
  { key: "contract", label: "Contract" },
];

export interface Ticket {
  id: string;
  name: string;
  phone: string;
  password?: string; // device login password so techs can get into the customer's computer
  desc: string;
  notes?: string | null; // internal shop notes — not customer-facing
  urgency: number; // 1-5, 1 = most urgent
  charger: boolean;
  assignedTo?: Person[]; // one or more; defaults to [keith]
  deviceType?: DeviceType | null; // null on pre-feature tickets
  serviceTag?: ServiceTag | null; // expedite | contract | null (neither)
  status: Status;
  dropoff: string; // YYYY-MM-DD
  dropoffAmPm?: "AM" | "PM" | null; // morning vs afternoon drop-off
  dueAt?: string | null; // ISO timestamp — optional promised-by date & time
  sortPos?: number | null; // position within the urgency group (auto from dueAt, manual on drag)
  pickedAt?: string | null; // YYYY-MM-DD set when status === 'picked'
  statusChangedAt?: string | null; // ISO timestamp, updated on any status change
  reorderedAt?: string | null; // ISO timestamp, set when the queue position changes (drag or urgency/due re-slot)
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
  call: { label: "Need to call", cls: "call" },
  resp: { label: "Awaiting response", cls: "resp" },
  parts: { label: "Waiting on parts", cls: "parts" },
  done: { label: "Complete", cls: "done" },
  picked: { label: "Picked up", cls: "picked" },
};

export const STATUS_ORDER: Status[] = ["todo", "prog", "call", "resp", "parts", "done", "picked"];

/* Single source for the "default Keith" rule: every ticket has at least one assignee. */
export function assignees(t: { assignedTo?: Person[] | null }): Person[] {
  return t.assignedTo && t.assignedTo.length ? t.assignedTo : ["keith"];
}

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;
  return `${p.year}-${p.month}-${p.day}`;
}
export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA + "T12:00:00").getTime();
  const b = new Date(isoB + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}
/* MM/DD HH:MM in 24-hour Pacific time — printed on description labels */
export function fmtPacific(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const p: Record<string, string> = {};
  for (const { type, value } of parts) p[type] = value;
  return `${p.month}/${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
/* Shop staff are Pacific; pin the display timezone so any stray browser shows shop time. */
export function fmtDueAt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/* ---- half-day due dates ---- */
export type AmPm = "AM" | "PM";

/* Due dates are half-days ("ready Thursday AM"), stored in the dueAt timestamp:
   AM = 11:00 local, PM = 17:00 local — so AM sorts before PM on the same day and
   cmpDue's plain ISO compare keeps working. */
export function buildDueAt(date: string, half: AmPm): string {
  return new Date(`${date}T${half === "AM" ? "11" : "17"}:00:00`).toISOString();
}

/* Decode for display/editing, pinned to shop time. Legacy exact-time rows
   bucket by hour: before noon = AM. */
export function dueParts(iso: string): { date: string; half: AmPm } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const hour = +get("hour") % 24; // en-CA can emit "24" for midnight
  return { date: `${get("year")}-${get("month")}-${get("day")}`, half: hour < 12 ? "AM" : "PM" };
}

/* "Jun 12 · AM" */
export function fmtDueHalf(iso: string): string {
  const { date, half } = dueParts(iso);
  return `${fmtDate(date)} · ${half}`;
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
  // Same drop-off day: AM first, PM next, unknown last.
  const half = (t: Ticket) => (t.dropoffAmPm === "AM" ? 0 : t.dropoffAmPm === "PM" ? 1 : 2);
  if (half(a) !== half(b)) return half(a) - half(b);
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
