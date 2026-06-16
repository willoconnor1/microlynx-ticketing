"use server";

import {
  getState,
  createTicket,
  updateTicket,
  moveTicket,
  deleteTicket,
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
): Promise<{ state: AppState; id: string }> {
  if (id) return { state: await updateTicket(id, data), id };
  return createTicket(data);
}

export async function setUrgencyAction(id: string, urgency: number): Promise<AppState> {
  return updateTicket(id, { urgency });
}

export async function setStatusAction(id: string, status: TicketPatch["status"]): Promise<AppState> {
  return updateTicket(id, { status });
}

export async function moveTicketAction(
  id: string,
  urgency: number,
  prevId: string | null,
  nextId: string | null
): Promise<AppState> {
  return moveTicket(id, urgency, prevId, nextId);
}

export async function deleteTicketAction(id: string): Promise<AppState> {
  return deleteTicket(id);
}

/* Inline edits from the expanded list row. */
export async function patchTicketAction(id: string, patch: TicketPatch): Promise<AppState> {
  return updateTicket(id, patch);
}

export async function sweepArchiveAction(): Promise<number> {
  return sweepArchive();
}
