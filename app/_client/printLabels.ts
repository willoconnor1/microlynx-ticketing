/* Dymo 30336 label printing (1" x 2-1/8" multi-purpose).

   Browser-native printing: we build a tiny HTML document sized to the label,
   drop it in a hidden iframe, and call print(). The Dymo just needs to be the
   selected/default printer in the print dialog. No SDK, no local web service.

   Two stickers per ticket:
     1. Customer  — name + phone (goes on the outside / the ticket).
     2. Password  — device login, in big mono type (goes inside the case).
   The password sticker only prints when a password is on file. */

import type { Ticket } from "@/lib/tickets";

export const SHOP_PHONE = "(253) 853-3298";

/* Solid-black wordmark (no tagline) — sharpest for the Dymo's black-only thermal
   printing. Served from /public, same origin as the app, so the iframe loads it. */
const LOGO_SRC = "/microlynx-logo-mark-bw.png";

/* The 30336 prints landscape: 2-1/8" wide (54mm) x 1" tall (25.4mm). */
const LABEL_W = "54mm";
const LABEL_H = "25.4mm";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/* Auto-shrink the customer name so a long name never spills off the edge of the
   label; the very longest names wrap to a second line instead of clipping. */
function fitName(name: string): { size: number; wrap: boolean } {
  const n = name.trim().length;
  if (n <= 15) return { size: 13.5, wrap: false };
  if (n <= 19) return { size: 11.5, wrap: false };
  if (n <= 25) return { size: 9.5, wrap: false };
  return { size: 9, wrap: true };
}

/* Same idea for the device password: long values step down in size and still
   wrap (break-all in CSS) rather than running off the sticker. */
function fitPw(pw: string): number {
  const n = pw.length;
  if (n <= 10) return 13;
  if (n <= 16) return 11;
  if (n <= 24) return 9;
  return 7.5;
}

/* The shop logo + phone shown along the bottom of every sticker. */
function footer(): string {
  return `<div class="foot">
    <img class="logo" src="${LOGO_SRC}" alt="Microlynx">
    <span class="shop-phone">${esc(SHOP_PHONE)}</span>
  </div>`;
}

function customerLabel(t: Ticket): string {
  const fit = fitName(t.name);
  const nameStyle = `font-size:${fit.size}pt;${fit.wrap ? "white-space:normal;-webkit-line-clamp:2;" : "white-space:nowrap;"}`;
  return `<div class="label">
    <div class="top">
      <div class="cust-name${fit.wrap ? " wrap" : ""}" style="${nameStyle}">${esc(t.name)}</div>
      <div class="cust-phone">${esc(t.phone)}</div>
    </div>
    ${footer()}
  </div>`;
}

function passwordLabel(t: Ticket): string {
  const pw = t.password || "";
  return `<div class="label">
    <div class="top">
      <div class="pw-who">${esc(t.name)} &middot; ${esc(t.id)}</div>
      <div class="pw-label">Device password</div>
      <div class="pw-value" style="font-size:${fitPw(pw)}pt">${esc(pw)}</div>
    </div>
    ${footer()}
  </div>`;
}

function buildDoc(t: Ticket): string {
  const labels = [customerLabel(t)];
  if (t.password && t.password.trim()) labels.push(passwordLabel(t));
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
  .top { min-height: 0; }
  .cust-name { font-weight: 800; line-height: 1.05; overflow: hidden;
               text-overflow: ellipsis; }
  /* Longest names wrap to two lines instead of clipping. */
  .cust-name.wrap { display: -webkit-box; -webkit-box-orient: vertical;
                    -webkit-line-clamp: 2; }
  .cust-phone { font-size: 11.5pt; margin-top: 0.6mm; letter-spacing: 0.02em; }
  .pw-who { font-size: 6.5pt; color: #555; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis; }
  .pw-label { font-size: 6pt; letter-spacing: 0.1em; text-transform: uppercase;
              color: #666; margin-top: 0.4mm; }
  .pw-value { font-family: "Courier New", monospace; font-weight: 700;
              font-size: 13pt; line-height: 1.05; margin-top: 0.3mm;
              word-break: break-all; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 1.4mm;
          border-top: 0.3mm solid #bbb; padding-top: 0.9mm; }
  .logo { height: 3.4mm; width: auto; max-width: 47mm; }
  .shop-phone { font-size: 7.5pt; color: #333; white-space: nowrap; }
</style></head><body>
${labels.join("\n")}
</body></html>`;
}

/* Render the labels in a throwaway hidden iframe and fire the print dialog.
   The iframe is removed after printing so nothing lingers in the page. */
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

  // Don't print until the logo has loaded, or it can come out blank the first time.
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
