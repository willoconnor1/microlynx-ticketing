import { getState } from "@/lib/store";
import App from "./_client/app";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const { tickets, archive } = await getState();
    return <App initialTickets={tickets} initialArchive={archive} />;
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ""}` : String(err);
    return (
      <div style={{ padding: "2rem", fontFamily: "monospace", background: "#fef2f2", minHeight: "100vh" }}>
        <h2 style={{ color: "#991b1b", marginBottom: "1rem" }}>Database error — diagnostic mode</h2>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#7f1d1d", fontSize: "13px" }}>{msg}</pre>
      </div>
    );
  }
}
