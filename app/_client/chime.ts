"use client";

/* Notification sounds, synthesized with the Web Audio API so there are no audio
   files to ship or license. Browsers block audio until the user interacts with
   the page, so unlockAudio() must be called from a real click/tap (the "play
   sounds on this screen" toggle and the preview buttons do this). */

type Note = { f: number; t: number; d: number; type?: OscillatorType; gain?: number };
type Preset = { key: string; label: string; notes: Note[] };

/* Sounds for a new ticket — brighter, "something arrived" feel. */
export const NEW_PRESETS: Preset[] = [
  { key: "chime", label: "Chime", notes: [{ f: 660, t: 0, d: 0.16 }, { f: 988, t: 0.11, d: 0.26 }] },
  { key: "ping", label: "Ping", notes: [{ f: 1175, t: 0, d: 0.28, type: "sine" }] },
  { key: "marimba", label: "Marimba", notes: [{ f: 587, t: 0, d: 0.14, type: "triangle" }, { f: 784, t: 0.1, d: 0.14, type: "triangle" }, { f: 1175, t: 0.2, d: 0.22, type: "triangle" }] },
  { key: "bell", label: "Bell", notes: [{ f: 880, t: 0, d: 0.5, type: "sine" }, { f: 1320, t: 0, d: 0.5, type: "sine", gain: 0.4 }] },
];

/* Sounds for a queue reorder — lower, shorter, clearly different from "new". */
export const REORDER_PRESETS: Preset[] = [
  { key: "blip", label: "Blip", notes: [{ f: 392, t: 0, d: 0.12, type: "sine" }] },
  { key: "swoosh", label: "Swoosh", notes: [{ f: 588, t: 0, d: 0.1, type: "triangle" }, { f: 392, t: 0.07, d: 0.16, type: "triangle" }] },
  { key: "tick", label: "Double tick", notes: [{ f: 520, t: 0, d: 0.05, type: "square", gain: 0.3 }, { f: 520, t: 0.09, d: 0.05, type: "square", gain: 0.3 }] },
  { key: "thunk", label: "Thunk", notes: [{ f: 240, t: 0, d: 0.18, type: "sine" }] },
];

export const DEFAULT_NEW = "chime";
export const DEFAULT_REORDER = "blip";

let ctx: AudioContext | null = null;

/* Create or resume the AudioContext. Must run inside a user gesture the first
   time. Returns true once the context is actually running. */
export async function unlockAudio(): Promise<boolean> {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

export function audioRunning(): boolean {
  return ctx?.state === "running";
}

function playNotes(notes: Note[]) {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = n.type ?? "sine";
    osc.frequency.value = n.f;
    const peak = n.gain ?? 0.18;
    const start = now + n.t;
    // Quick attack, exponential decay — avoids the click of a hard stop.
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
    osc.connect(g).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + n.d + 0.02);
  }
}

const findPreset = (list: Preset[], key: string) => list.find((p) => p.key === key) || list[0];

/* Play the chosen preset for an event kind. Silent if audio isn't unlocked. */
export function playChime(kind: "new" | "reorder", presetKey: string) {
  if (!audioRunning()) return;
  const list = kind === "new" ? NEW_PRESETS : REORDER_PRESETS;
  playNotes(findPreset(list, presetKey).notes);
}

/* Preview a preset from the settings UI (the click itself unlocks audio). */
export async function previewChime(kind: "new" | "reorder", presetKey: string) {
  await unlockAudio();
  const list = kind === "new" ? NEW_PRESETS : REORDER_PRESETS;
  playNotes(findPreset(list, presetKey).notes);
}
