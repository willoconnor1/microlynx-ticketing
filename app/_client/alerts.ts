/* Pure helpers that decide when a ticket should "glow" and why.
   Kept server-safe (no React, no window) so the logic is easy to reason about
   and the same rules drive both the visual glow and the notification feed. */
import type { Ticket } from "@/lib/tickets";

export type AlertKind = "new" | "reorder";

/* How long a new/reordered ticket stays highlighted if nobody clears it. */
export const ALERT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

/* Active = still in the working queue (matches the List's own filter). */
export function isActiveStatus(t: Ticket): boolean {
  return t.status === "todo" || t.status === "prog" || t.status === "resp";
}

const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/* Why a ticket is alerting right now, or null if it isn't. A freshly created
   ticket reads as "new" even if it was also just dragged — the brand-new signal
   wins so Keith doesn't get a second sound for a one-minute-old ticket. */
export function alertReason(t: Ticket, now: number): AlertKind | null {
  if (!isActiveStatus(t)) return null;
  if (ms(t.createdAt) && now - ms(t.createdAt) < ALERT_WINDOW_MS) return "new";
  if (ms(t.reorderedAt) && now - ms(t.reorderedAt) < ALERT_WINDOW_MS) return "reorder";
  return null;
}

/* A stable fingerprint for the current alert. It changes when a *new* event
   happens on the same ticket (e.g. a second reorder), which is exactly when we
   want to re-glow, re-chime, and re-surface it after a "Resolve all". */
export function alertSignature(t: Ticket, kind: AlertKind): string {
  return kind === "new" ? `n:${t.createdAt}` : `r:${t.reorderedAt}`;
}

/* Millisecond timestamp of the event behind an alert (for ordering the feed). */
export function alertTime(t: Ticket, kind: AlertKind): number {
  return kind === "new" ? ms(t.createdAt) : ms(t.reorderedAt);
}
