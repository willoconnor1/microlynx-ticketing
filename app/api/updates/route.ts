import { addClient, removeClient } from "@/lib/broadcast";

export const dynamic = "force-dynamic";

const enc = new TextEncoder();

export function GET() {
  let ctrl: ReadableStreamDefaultController<Uint8Array>;
  let hb: ReturnType<typeof setInterval>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
      addClient(ctrl);
      ctrl.enqueue(enc.encode(": connected\n\n"));
      // Heartbeat every 25 s keeps the connection alive through proxies/load balancers.
      hb = setInterval(() => {
        try { ctrl.enqueue(enc.encode(": heartbeat\n\n")); }
        catch { clearInterval(hb); removeClient(ctrl); }
      }, 25000);
    },
    cancel() {
      clearInterval(hb);
      removeClient(ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
