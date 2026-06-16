"use client";

/* Per-screen notification settings, saved in this browser's localStorage so each
   screen remembers its own choices (Keith's shop screen turns sound on; others
   stay silent). Everything is window-guarded so it's safe during SSR. */
import type { AlertKind } from "./alerts";

export type FeedItem = { key: string; id: string; kind: AlertKind; text: string; ts: number };

export const FEED_MAX = 40;

const KEYS = {
  resolved: "mlx:notif:resolved",
  feed: "mlx:notif:feed",
  soundOn: "mlx:notif:soundOn",
  soundNew: "mlx:notif:soundNew",
  soundReorder: "mlx:notif:soundReorder",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — non-fatal, notifications just won't persist */
  }
}

/* resolved: ticket id -> the alert signature that's been acknowledged. */
export const loadResolved = (): Record<string, string> => read(KEYS.resolved, {});
export const saveResolved = (v: Record<string, string>) => write(KEYS.resolved, v);

export const loadFeed = (): FeedItem[] => read(KEYS.feed, []);
export const saveFeed = (v: FeedItem[]) => write(KEYS.feed, v);

export const loadSoundOn = (): boolean => read(KEYS.soundOn, false);
export const saveSoundOn = (v: boolean) => write(KEYS.soundOn, v);

export const loadSoundChoice = (kind: AlertKind, fallback: string): string =>
  read(kind === "new" ? KEYS.soundNew : KEYS.soundReorder, fallback);
export const saveSoundChoice = (kind: AlertKind, v: string) =>
  write(kind === "new" ? KEYS.soundNew : KEYS.soundReorder, v);
