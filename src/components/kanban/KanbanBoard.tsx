'use client';

import { useState, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Ticket, TicketStatus, STATUSES } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';

interface Props {
  initialTickets: Ticket[];
}

function groupByStatus(tickets: Ticket[]): Record<TicketStatus, Ticket[]> {
  const groups = Object.fromEntries(
    STATUSES.map((s) => [s.key, [] as Ticket[]])
  ) as Record<TicketStatus, Ticket[]>;

  for (const t of tickets) {
    groups[t.status]?.push(t);
  }
  return groups;
}

export function KanbanBoard({ initialTickets }: Props) {
  const [tickets, setTickets] = useState(initialTickets);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/tickets?view=kanban');
    const data = await res.json();
    setTickets(data.tickets);
  }, []);

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId as TicketStatus;
    const ticketId = Number(draggableId);

    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
    );

    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure
      refresh();
    }
  }

  const groups = groupByStatus(tickets);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map((s) => (
          <KanbanColumn
            key={s.key}
            status={s.key}
            label={s.label}
            tickets={groups[s.key]}
            onSaved={refresh}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
