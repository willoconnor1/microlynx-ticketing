"use client";

/* Dynamic import keeps the confetti code out of the initial bundle. */
export async function celebrate() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 } });
}
