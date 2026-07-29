/* Dymo 30336 label printing (1" x 2-1/8" multi-purpose).
   Each selected sticker fires as its own isolated print job (separate iframe)
   so the Dymo cuts cleanly between labels — no page-break CSS needed. */

import type { Ticket } from "@/lib/tickets";
import { fmtPacific } from "@/lib/tickets";

export const SHOP_PHONE = "(253) 853-3298";
const LOGO_SRC = "/microlynx-logo-mark-bw.png";
const LABEL_W = "54mm";
const LABEL_H = "25.4mm";

export type PrintSel = {
  name: boolean;
  charger: boolean;
  password: boolean;
  desc: boolean;
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function fitName(name: string): { size: number; wrap: boolean } {
  const n = name.trim().length;
  if (n <= 10) return { size: 19, wrap: false };
  if (n <= 15) return { size: 16, wrap: false };
  if (n <= 20) return { size: 13, wrap: false };
  if (n <= 28) return { size: 10, wrap: false };
  return { size: 9, wrap: true };
}

function fitPw(pw: string): number {
  const n = pw.length;
  if (n <= 6)  return 30;
  if (n <= 10) return 26;
  if (n <= 14) return 22;
  if (n <= 20) return 17;
  if (n <= 28) return 13;
  return 10;
}

function descStartSize(text: string): number {
  const n = text.length;
  if (n <= 14) return 24;
  if (n <= 28) return 18;
  if (n <= 55) return 13;
  if (n <= 90) return 9;
  return 7;
}

/* ── Shared CSS injected into every single-label document ── */
const SHARED_CSS = `
  @page { size: ${LABEL_W} ${LABEL_H}; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: ${LABEL_W}; background: #fff; }
  body { font-family: Arial, "Helvetica Neue", sans-serif; color: #000; }
  .label { width: ${LABEL_W}; height: ${LABEL_H}; padding: 1.8mm 2.4mm;
    display: flex; flex-direction: column; justify-content: space-between;
    page-break-after: always; break-after: page; overflow: hidden; }
  .top { text-align: center; min-height: 0; }
  .cust-name { font-weight: 800; line-height: 1.05; }
  .cust-name.wrap { word-break: break-word; }
  .cust-phone { font-size: 14pt; margin-top: 1mm; letter-spacing: 0.02em; }
  .pw-wrap { flex: 1; display: flex; align-items: center; justify-content: center; }
  .pw-value { font-family: "Courier New", monospace; font-weight: 700;
    line-height: 1.1; word-break: break-all; text-align: center; }
  .label-desc { padding: 0.8mm 1.2mm; }
  .desc-body { flex: 1; display: flex; align-items: center; justify-content: center;
    padding-bottom: 0.5mm; min-height: 0; }
  .desc-value { font-weight: 700; line-height: 1.15; text-align: center;
    word-break: break-word; overflow-wrap: break-word; display: block; width: 100%; }
  .desc-foot { flex-shrink: 0; display: flex; justify-content: center; align-items: center;
    border-top: 0.3mm solid #bbb; padding-top: 0.6mm; }
  .desc-time { font-size: 6pt; color: #555; white-space: nowrap;
    font-variant-numeric: tabular-nums; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 0.3mm;
    border-top: 0.3mm solid #bbb; padding-top: 0.5mm; flex-shrink: 0; }
  .logo { height: 2.8mm; width: auto; max-width: 47mm; }
  .shop-phone { font-size: 7.5pt; color: #333; white-space: nowrap; }
`;

/* ── Per-label HTML bodies ── */
function customerHtml(t: Ticket): string {
  const fit = fitName(t.name);
  const nameStyle = `font-size:${fit.size}pt;${fit.wrap ? "" : "white-space:nowrap;"}`;
  return `<div class="label">
  <div class="top">
    <div class="cust-name${fit.wrap ? " wrap" : ""}" style="${nameStyle}">${esc(t.name)}</div>
    <div class="cust-phone">${esc(t.phone)}</div>
  </div>
  <div class="foot">
    <img class="logo" src="${LOGO_SRC}" alt="Microlynx">
    <span class="shop-phone">${esc(SHOP_PHONE)}</span>
  </div>
</div>`;
}

function passwordHtml(t: Ticket): string {
  const pw = t.password || "";
  return `<div class="label">
  <div class="pw-wrap">
    <div class="pw-value" style="font-size:${fitPw(pw)}pt">${esc(pw)}</div>
  </div>
  <div class="foot">
    <img class="logo" src="${LOGO_SRC}" alt="Microlynx">
    <span class="shop-phone">${esc(SHOP_PHONE)}</span>
  </div>
</div>`;
}

function descHtml(firstLine: string, entryTime: string): string {
  const startSize = descStartSize(firstLine);
  return `<div class="label label-desc">
  <div class="desc-body">
    <div class="desc-value" id="dv" style="font-size:${startSize}pt">${esc(firstLine)}</div>
  </div>
  <div class="desc-foot">
    <span class="desc-time">${esc(entryTime)}</span>
  </div>
</div>`;
}

/* ── Single-label document wrapper ── */
function singleDoc(bodyHtml: string, script?: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${SHARED_CSS}</style></head><body>${bodyHtml}${script ? `<script>${script}</script>` : ""}</body></html>`;
}

const DESC_SCRIPT = `(function(){
  var el=document.getElementById('dv');
  if(!el)return;
  var parent=el.parentElement;
  var size=parseFloat(el.style.fontSize)||14;
  while(el.scrollHeight>parent.clientHeight&&size>4){size-=0.5;el.style.fontSize=size+'pt';}
})();`;

/* ── Fire one label as its own isolated print job ── */
function firePrint(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed", right: "0", bottom: "0",
    width: "0", height: "0", border: "0",
  });
  document.body.appendChild(iframe);
  const win = iframe.contentWindow;
  const doc = win?.document;
  if (!win || !doc) { iframe.remove(); return; }
  doc.open();
  doc.write(html);
  doc.close();
  const fire = () => { win.focus(); win.print(); window.setTimeout(() => iframe.remove(), 1000); };
  const imgs = Array.from(doc.images);
  let pending = imgs.filter((im) => !im.complete).length;
  if (pending === 0) window.setTimeout(fire, 60);
  else imgs.forEach((im) => {
    if (im.complete) return;
    im.onload = im.onerror = () => { if (--pending === 0) window.setTimeout(fire, 40); };
  });
}

/* ── Public API ── */

export function printSelectedLabels(t: Ticket, sel: PrintSel): void {
  const bodies: string[] = [];
  if (sel.name) bodies.push(customerHtml(t));
  if (sel.charger) bodies.push(customerHtml(t));
  if (sel.password && t.password?.trim()) bodies.push(passwordHtml(t));
  if (sel.desc) {
    const firstLine = (t.desc || "").split(/\r?\n/)[0].trim();
    if (firstLine) {
      const entryTime = fmtPacific(t.createdAt) || (t.dropoff ? t.dropoff.slice(5).replace("-", "/") : "");
      bodies.push(descHtml(firstLine, entryTime));
    }
  }
  if (!bodies.length) return;
  firePrint(singleDoc(bodies.join("\n"), bodies.some((b) => b.includes("id=\"dv\"")) ? DESC_SCRIPT : undefined));
}

/* Kept for the save-and-print path — prints all applicable labels with no dialog. */
export function printTicketLabels(t: Ticket): void {
  printSelectedLabels(t, {
    name: true,
    charger: t.charger,
    password: !!t.password?.trim(),
    desc: !!(t.desc || "").trim(),
  });
}
