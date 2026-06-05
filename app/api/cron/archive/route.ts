import { NextResponse } from "next/server";
import { sweepArchive } from "@/lib/store";

export const dynamic = "force-dynamic";

// Daily Vercel Cron sweep: move picked-up tickets older than 3 days into the archive.
export async function GET() {
  const archived = await sweepArchive();
  return NextResponse.json({ ok: true, archived });
}
