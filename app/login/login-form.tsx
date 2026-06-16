"use client";

import React from "react";
import { useActionState } from "react";
import { Lock, Eye, EyeOff, ArrowRight, LoaderCircle } from "lucide-react";
import { loginAction, type LoginState } from "@/lib/auth-actions";

/* ---------- Bridge geometry (Tacoma Narrows nod) ----------
   One math function describes the main cable so the suspender lines always
   meet it exactly. Towers at x=380 / x=1060, deck at y=312, in a 1440x440 box. */
const W = 1440, DECK = 312, TOP = 64, T1 = 380, T2 = 1060, MID = 720, HALF = (T2 - T1) / 2;

function cableY(x: number): number {
  if (x <= T1) return TOP + (235 - TOP) * Math.pow((T1 - x) / T1, 1.5);
  if (x >= T2) return TOP + (235 - TOP) * Math.pow((x - T2) / (W - T2), 1.5);
  const u = (x - MID) / HALF;            // -1 .. 1 across the center span
  return 210 + (TOP - 210) * u * u;      // sags to y=210 mid-span, up to TOP at towers
}

const CABLE_PATH = (() => {
  let d = `M 0 ${cableY(0).toFixed(1)}`;
  for (let x = 8; x <= W; x += 8) d += ` L ${x} ${cableY(x).toFixed(1)}`;
  return d;
})();

const SUSPENDERS = (() => {
  const lines: { x: number; y: number }[] = [];
  for (let x = 40; x < W; x += 40) {
    if (Math.abs(x - T1) < 28 || Math.abs(x - T2) < 28) continue; // skip at towers
    lines.push({ x, y: cableY(x) });
  }
  return lines;
})();

function Bridge() {
  return (
    <svg className="login-bridge" viewBox={`0 0 ${W} 440`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      {/* water shimmer */}
      <rect x="0" y={DECK} width={W} height={440 - DECK} fill="url(#water)" />
      {/* suspender cables */}
      <g className="lb-susp">
        {SUSPENDERS.map((s, i) => (
          <line key={i} x1={s.x} y1={s.y} x2={s.x} y2={DECK} />
        ))}
      </g>
      {/* main cables */}
      <path className="lb-cable" d={CABLE_PATH} />
      {/* towers */}
      {[T1, T2].map((tx) => (
        <g key={tx} className="lb-tower">
          <rect x={tx - 9} y={TOP - 8} width="18" height={DECK - TOP + 40} />
          <rect x={tx - 22} y={TOP + 78} width="44" height="11" />
          <rect x={tx - 20} y={TOP + 150} width="40" height="11" />
        </g>
      ))}
      {/* deck */}
      <line className="lb-deck" x1="0" y1={DECK} x2={W} y2={DECK} />
      <defs>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = React.useState(false);

  return (
    <div className="login-screen">
      <Bridge />
      <div className="login-glow" aria-hidden="true" />

      <main className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="login-logo" src="/microlynx-logo-white.png" alt="Microlynx" />
        <div className="login-eyebrow">{"</"} SECURE ACCESS {">"}</div>
        <h1 className="login-title">Enter your password</h1>
        <p className="login-sub">This is a private workspace for the Microlynx team.</p>

        <form action={formAction} className="login-form">
          <div className="login-field">
            <Lock className="login-field-icon" size={18} aria-hidden="true" />
            <input
              name="password"
              type={show ? "text" : "password"}
              placeholder="Password"
              autoFocus
              autoComplete="current-password"
              aria-label="Password"
              className="login-input"
            />
            <button
              type="button"
              className="login-eye"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {state.error && <div className="login-error">{state.error}</div>}

          <button type="submit" className="login-submit" disabled={pending}>
            {pending ? <LoaderCircle className="login-spin" size={18} /> : <>Unlock <ArrowRight size={18} /></>}
          </button>
        </form>

        <div className="login-foot">Microlynx · Gig Harbor, WA</div>
      </main>
    </div>
  );
}
