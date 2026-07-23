"use server";

import {
  getState,
  createTicket,
  updateTicket,
  reorderTicket,
  sweepArchive,
  type AppState,
  type NewTicketInput,
  type TicketPatch,
} from "./store";

export async function fetchState(): Promise<AppState> {
  return getState();
}

export async function saveTicketAction(
  id: string | null,
  data: NewTicketInput
): Promise<AppState> {
  if (id) return updateTicket(id, data);
  return createTicket(data);
}

export async function setUrgencyAction(id: string, urgency: number): Promise<AppState> {
  return updateTicket(id, { urgency });
}

export async function setStatusAction(id: string, status: TicketPatch["status"]): Promise<AppState> {
  return updateTicket(id, { status });
}

export async function reorderTicketAction(id: string, prevId: string | null): Promise<AppState> {
  return reorderTicket(id, prevId);
}

export async function sweepArchiveAction(): Promise<number> {
  return sweepArchive();
}
