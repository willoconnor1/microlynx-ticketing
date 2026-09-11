import { getState } from "@/lib/store";
import App from "./_client/app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { tickets, archive } = await getState();
  return <App initialTickets={tickets} initialArchive={archive} />;
}
