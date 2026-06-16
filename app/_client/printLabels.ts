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

/* The shop logo + phone shown along the bottom of every sticker. */
function footer(): string {
  return `<div class="foot">
    <img class="logo" src="${LOGO_SRC}" alt="Microlynx">
    <span class="shop-phone">${esc(SHOP_PHONE)}</span>
  </div>`;
}

function customerLabel(t: Ticket): string {
  return `<div class="label">
    <div class="top">
      <div class="cust-name">${esc(t.name)}</div>
      <div class="cust-phone">${esc(t.phone)}</div>
    </div>
    ${footer()}
  </div>`;
}

function passwordLabel(t: Ticket): string {
  return `<div class="label">
    <div class="top">
      <div class="pw-who">${esc(t.name)} &middot; ${esc(t.id)}</div>
      <div class="pw-label">Device password</div>
      <div class="pw-value">${esc(t.password || "")}</div>
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
  .cust-name { font-weight: 800; font-size: 13.5pt; line-height: 1.05;
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cust-phone { font-size: 11.5pt; margin-top: 0.6mm; letter-spacing: 0.02em; }
  .pw-who { font-size: 6.5pt; color: #555; white-space: nowrap;
            overflow: hidden; text-overflow: ellipsis; }
  .pw-label { font-size: 6pt; letter-spacing: 0.1em; text-transform: uppercase;
              color: #666; margin-top: 0.4mm; }
  .pw-value { font-family: "Courier New", monospace; font-weight: 700;
              font-size: 13pt; line-height: 1.05; margin-top: 0.3mm;
              word-break: break-all; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 0.4mm;
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
