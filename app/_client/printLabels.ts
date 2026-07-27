/* Dymo 30336 label printing (1" x 2-1/8" multi-purpose).

   Three stickers per ticket:
     1. Customer    — name + phone, centered, maximised (always)
     2. Password    — just the password, big mono text (only when a password is on file)
     3. Job summary — first line of the description field, big text (always when desc present)

   Browser-native: hidden iframe + window.print(). No SDK required. */

import type { Ticket } from "@/lib/tickets";
import { fmtPacific } from "@/lib/tickets";

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

/* Initial font size guess before JS auto-scale kicks in (avoids jarring reflow). */
function descStartSize(text: string): number {
  const n = text.length;
  if (n <= 14) return 24;
  if (n <= 28) return 18;
  if (n <= 55) return 13;
  if (n <= 90) return 9;
  return 7;
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

/* Sticker 3: full description, wraps freely — JS shrinks font until it fits vertically.
   Footer shows ticket ID on the left and entry timestamp (Pacific) on the right. */
function descLabel(t: Ticket): string {
  const text = (t.desc || "").trim();
  const startSize = descStartSize(text);
  const entryTime = fmtPacific(t.createdAt)
    || (t.dropoff ? t.dropoff.slice(5).replace("-", "/") : "");
  return `<div class="label label-desc">
    <div class="desc-body">
      <div class="desc-value" id="dv" style="font-size:${startSize}pt">${esc(text)}</div>
    </div>
    <div class="desc-foot">
      <span class="desc-id">${esc(t.id)}</span>
      <span class="desc-time">${esc(entryTime)}</span>
    </div>
  </div>`;
}

function buildDoc(t: Ticket): string {
  const labels = [customerLabel(t)];
  if (t.charger) labels.push(customerLabel(t));
  if (t.password?.trim()) labels.push(passwordLabel(t));
  if ((t.desc || "").trim()) labels.push(descLabel(t));

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
    page-break-after: always;
  }
  .label:last-child { page-break-after: auto; }
  /* Customer label: top section centred */
  .top { text-align: center; min-height: 0; }
  .cust-name { font-weight: 800; line-height: 1.05; }
  .cust-name.wrap { word-break: break-word; }
  .cust-phone { font-size: 14pt; margin-top: 1mm; letter-spacing: 0.02em; }
  /* Password sticker */
  .pw-wrap { flex: 1; display: flex; align-items: center; justify-content: center; }
  .pw-value { font-family: "Courier New", monospace; font-weight: 700;
              line-height: 1.1; word-break: break-all; text-align: center; }
  /* Desc sticker */
  .label-desc { padding: 0.8mm 1.2mm; }
  .desc-body { flex: 1; display: flex; align-items: center; justify-content: center;
               padding-bottom: 0.5mm; min-height: 0; }
  .desc-value { font-weight: 700; line-height: 1.15; text-align: center;
                word-break: break-word; overflow-wrap: break-word; display: block; width: 100%; }
  .desc-foot { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;
               border-top: 0.3mm solid #bbb; padding-top: 0.6mm; }
  .desc-id   { font-size: 6pt; color: #555; white-space: nowrap; }
  .desc-time { font-size: 6pt; color: #555; white-space: nowrap; font-variant-numeric: tabular-nums; }
  /* Customer/password footer */
  .foot { display: flex; flex-direction: column; align-items: center; gap: 0.6mm;
          border-top: 0.3mm solid #bbb; padding-top: 0.9mm; }
  .logo { height: 3.4mm; width: auto; max-width: 47mm; }
  .shop-phone { font-size: 9.5pt; color: #333; white-space: nowrap; }
</style></head><body>
${labels.join("\n")}
<script>
(function(){
  var el=document.getElementById('dv');
  if(!el)return;
  var parent=el.parentElement;
  var size=parseFloat(el.style.fontSize)||14;
  while(el.scrollHeight>parent.clientHeight&&size>4){size-=0.5;el.style.fontSize=size+'pt';}
})();
</script>
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
