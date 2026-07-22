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
import { broadcast } from "./broadcast";

export async function fetchState(): Promise<AppState> {
  return getState();
}

export async function saveTicketAction(
  id: string | null,
  data: NewTicketInput
): Promise<{ state: AppState; id: string }> {
  const result = id
    ? { state: await updateTicket(id, data), id }
    : await createTicket(data);
  broadcast();
  return result;
}

export async function setUrgencyAction(id: string, urgency: number): Promise<AppState> {
  const state = await updateTicket(id, { urgency });
  broadcast();
  return state;
}

export async function setStatusAction(id: string, status: TicketPatch["status"]): Promise<AppState> {
  const state = await updateTicket(id, { status });
  broadcast();
  return state;
}

export async function moveTicketAction(
  id: string,
  urgency: number,
  prevId: string | null,
  nextId: string | null
): Promise<AppState> {
  const state = await moveTicket(id, urgency, prevId, nextId);
  broadcast();
  return state;
}

export async function deleteTicketAction(id: string): Promise<AppState> {
  const state = await deleteTicket(id);
  broadcast();
  return state;
}

/* Inline edits from the expanded list row. */
export async function patchTicketAction(id: string, patch: TicketPatch): Promise<AppState> {
  const state = await updateTicket(id, patch);
  broadcast();
  return state;
}

export async function sweepArchiveAction(): Promise<number> {
  return sweepArchive();
}
