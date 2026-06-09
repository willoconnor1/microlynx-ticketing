import type { Ticket, CreateTicketInput, UpdateTicketInput } from './types';
import {
  localGetLeaderboard,
  localGetKanban,
  localGetById,
  localCreate,
  localUpdate,
  localDelete,
} from './local-store';

export async function getLeaderboardTickets(): Promise<Ticket[]> {
  return localGetLeaderboard();
}

export async function getKanbanTickets(): Promise<Ticket[]> {
  return localGetKanban();
}

export async function getTicketById(id: number): Promise<Ticket | null> {
  return localGetById(id);
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  return localCreate(input);
}

export async function updateTicket(id: number, input: UpdateTicketInput): Promise<Ticket | null> {
  return localUpdate(id, input);
}

export async function deleteTicket(id: number): Promise<boolean> {
  return localDelete(id);
}
