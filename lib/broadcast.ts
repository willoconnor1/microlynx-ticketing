const enc = new TextEncoder();

type Ctrl = ReadableStreamDefaultController<Uint8Array>;
const clients = new Set<Ctrl>();

export function addClient(ctrl: Ctrl) { clients.add(ctrl); }
export function removeClient(ctrl: Ctrl) { clients.delete(ctrl); }

export function broadcast() {
  const msg = enc.encode("data: tick\n\n");
  for (const ctrl of clients) {
    try { ctrl.enqueue(msg); } catch { clients.delete(ctrl); }
  }
}
