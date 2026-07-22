/* Dymo 30336 label printing (1" x 2-1/8" multi-purpose).

   Three stickers per ticket:
     1. Customer    — name + phone, centered, maximised (always)
     2. Password    — just the password, big mono text (only when a password is on file)
     3. Job summary — first line of the description field, big text (always when desc present)

   Browser-native: hidden iframe + window.print(). No SDK required. */

import type { Ticket } from "@/lib/tickets";

export const SHOP_PHONE = "(253) 853-3298";
const LOGO_SRC = "/microlynx-logo-mark-bw.png";
const LABEL_W = "54mm";
const LABEL_H = "25.4mm";

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

/* Cascade: try to fill 1 line at max size, shrink until it fits,
   then spill to 2 → 3 → 4 lines (which lets font grow again). */
function fitDesc(text: string): { size: number; lines: number } {
  const n = text.length;
  // 1 line
  if (n <= 11) return { size: 24, lines: 1 };
  if (n <= 14) return { size: 20, lines: 1 };
  if (n <= 17) return { size: 17, lines: 1 };
  if (n <= 20) return { size: 14, lines: 1 };
  if (n <= 24) return { size: 12, lines: 1 };
  if (n <= 28) return { size: 10, lines: 1 };
  if (n <= 35) return { size:  8, lines: 1 };
  // 2 lines
  if (n <= 42) return { size: 14, lines: 2 };
  if (n <= 54) return { size: 11, lines: 2 };
  if (n <= 70) return { size:  9, lines: 2 };
  // 3 lines
  if (n <= 80) return { size: 11, lines: 3 };
  if (n <= 99) return { size:  9, lines: 3 };
  // 4 lines
  if (n <= 115) return { size: 9, lines: 4 };
  if (n <= 140) return { size: 8, lines: 4 };
  return { size: 7, lines: 4 };
}

/* Sticker 1: name + phone centred, footer with logo + shop number. */
function customerLabel(t: Ticket): string {
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

/* Sticker 2: password vertically centred above footer. */
function passwordLabel(t: Ticket): string {
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

/* Sticker 3: first line of the description, fills the sticker edge-to-edge. */
function descLabel(firstLine: string): string {
  const { size, lines } = fitDesc(firstLine);
  const wrapCss = lines > 1
    ? `display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lines};overflow:hidden;`
    : `white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
  return `<div class="label label-plain label-desc">
    <div class="desc-value" style="font-size:${size}pt;${wrapCss}">${esc(firstLine)}</div>
  </div>`;
}

function buildDoc(t: Ticket): string {
  const labels = [customerLabel(t)];
  if (t.password?.trim()) labels.push(passwordLabel(t));
  const firstLine = (t.desc || "").split(/\r?\n/)[0].trim();
  if (firstLine) labels.push(descLabel(firstLine));

  return `<!doctype html><html><head><meta charset="utf-8">
<title>Labels ${esc(t.id)}</title>
<style>
  @page { size: ${LABEL_W} ${LABEL_H}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: ${LABEL_W}; background: #fff; }
  body { font-family: Arial, "Helvetica Neue", sans-serif; color: #000; }
  .label {
    width: ${LABEL_W}; height: ${LABEL_H};
    padding: 1.8mm 2.4mm;
    display: flex; flex-direction: column; justify-content: space-between;
    overflow: hidden; page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }
  /* Password + desc stickers: centred, no footer */
  .label-plain { justify-content: center; align-items: center; text-align: center; }
  /* Desc sticker gets tighter margins to maximise text area */
  .label-desc { padding: 0.8mm 1.2mm; }
  /* Customer label: top section centred */
  .top { text-align: center; min-height: 0; }
  .cust-name { font-weight: 800; line-height: 1.05; }
  .cust-name.wrap { display: -webkit-box; -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2; overflow: hidden; }
  .cust-phone { font-size: 14pt; margin-top: 1mm; letter-spacing: 0.02em; }
  /* Password sticker */
  .pw-wrap { flex: 1; display: flex; align-items: center; justify-content: center; }
  .pw-value { font-family: "Courier New", monospace; font-weight: 700;
              line-height: 1.1; word-break: break-all; text-align: center; }
  /* Desc sticker — wrap/clamp applied inline per-label */
  .desc-value { font-weight: 700; line-height: 1.15; }
  /* Footer (customer sticker only) */
  .foot { display: flex; flex-direction: column; align-items: center; gap: 0.6mm;
          border-top: 0.3mm solid #bbb; padding-top: 0.9mm; }
  .logo { height: 3.4mm; width: auto; max-width: 47mm; }
  .shop-phone { font-size: 9.5pt; color: #333; white-space: nowrap; }
</style></head><body>
${labels.join("\n")}
</body></html>`;
}

export function printTicketLabels(t: Ticket): void {
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
  doc.write(buildDoc(t));
  doc.close();

  const fire = () => {
    win.focus();
    win.print();
    window.setTimeout(() => iframe.remove(), 1000);
  };

  const imgs = Array.from(doc.images);
  let pending = imgs.filter((im) => !im.complete).length;
  if (pending === 0) {
    window.setTimeout(fire, 60);
  } else {
    imgs.forEach((im) => {
      if (im.complete) return;
      im.onload = im.onerror = () => { if (--pending === 0) window.setTimeout(fire, 40); };
    });
  }
}
