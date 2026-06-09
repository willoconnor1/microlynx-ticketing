import * as fs from 'fs';
import * as path from 'path';
import type { Ticket, CreateTicketInput, UpdateTicketInput, TicketStatus } from './types';

const DB_FILE = path.join(process.cwd(), 'local-tickets.json');

function read(): Ticket[] {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function write(tickets: Ticket[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(tickets, null, 2));
}

function nextId(tickets: Ticket[]) {
  return tickets.length === 0 ? 1 : Math.max(...tickets.map((t) => t.id)) + 1;
}

export function localGetLeaderboard(): Ticket[] {
  return read()
    .filter((t) => t.status !== 'completed')
    .sort((a, b) =>
      a.priority !== b.priority
        ? a.priority - b.priority
        : new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    );
}

export function localGetKanban(): Ticket[] {
  return read().sort(
    (a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()
  );
}

export function localGetById(id: number): Ticket | null {
  return read().find((t) => t.id === id) ?? null;
}

export function localCreate(input: CreateTicketInput): Ticket {
  const tickets = read();
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: nextId(tickets),
    customer_name: input.customer_name,
    received_at: input.received_at ?? now,
    has_charger: input.has_charger,
    password: input.password ?? '',
    description: input.description ?? '',
    priority: input.priority,
    status: 'intake',
    notes: input.notes ?? '',
    created_at: now,
    updated_at: now,
  };
  write([...tickets, ticket]);
  return ticket;
}

export function localUpdate(id: number, input: UpdateTicketInput): Ticket | null {
  const tickets = read();
  const idx = tickets.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const updated: Ticket = {
    ...tickets[idx],
    ...Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined)
    ),
    status: (input.status ?? tickets[idx].status) as TicketStatus,
    updated_at: new Date().toISOString(),
  };
  tickets[idx] = updated;
  write(tickets);
  return updated;
}

export function localDelete(id: number): boolean {
  const tickets = read();
  const filtered = tickets.filter((t) => t.id !== id);
  if (filtered.length === tickets.length) return false;
  write(filtered);
  return true;
}
