import { NextResponse } from "next/server";
import { sweepArchive } from "@/lib/store";

export const dynamic = "force-dynamic";

// Daily Vercel Cron sweep: backstop that archives any picked-up ticket that
// somehow isn't archived yet (the status change itself archives immediately).
export async function GET() {
  const archived = await sweepArchive();
  return NextResponse.json({ ok: true, archived });
}
