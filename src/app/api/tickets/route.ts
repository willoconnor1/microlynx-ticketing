import { NextRequest, NextResponse } from 'next/server';
import { migrate } from '@/lib/db';
import { getLeaderboardTickets, getKanbanTickets, createTicket } from '@/lib/tickets';

let migrated = false;
async function ensureMigrated() {
  if (!migrated) {
    await migrate();
    migrated = true;
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureMigrated();
    const view = req.nextUrl.searchParams.get('view');
    const tickets = view === 'kanban'
      ? await getKanbanTickets()
      : await getLeaderboardTickets();
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureMigrated();
    const body = await req.json();

    if (!body.customer_name?.trim()) {
      return NextResponse.json({ error: 'customer_name is required' }, { status: 400 });
    }
    const priority = Number(body.priority);
    if (!priority || priority < 1 || priority > 5) {
      return NextResponse.json({ error: 'priority must be 1–5' }, { status: 400 });
    }

    const ticket = await createTicket({
      customer_name: body.customer_name.trim(),
      received_at: body.received_at,
      has_charger: Boolean(body.has_charger),
      password: body.password ?? '',
      description: body.description ?? '',
      priority: priority as 1 | 2 | 3 | 4 | 5,
      notes: body.notes ?? '',
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
