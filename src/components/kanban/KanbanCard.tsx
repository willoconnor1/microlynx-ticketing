'use client';

import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Ticket } from '@/lib/types';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { TicketModal } from '@/components/tickets/TicketModal';

interface Props {
  ticket: Ticket;
  index: number;
  onSaved: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function KanbanCard({ ticket, index, onSaved }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Draggable draggableId={String(ticket.id)} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setOpen(true)}
            className={`bg-white rounded-xl border p-3 cursor-pointer select-none transition-shadow ${
              snapshot.isDragging
                ? 'shadow-lg border-blue-300 rotate-1'
                : 'border-gray-100 shadow-sm hover:shadow-md'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <PriorityBadge priority={ticket.priority} />
              {ticket.has_charger && (
                <span className="text-green-500 text-xs" title="Has charger">⚡</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">{ticket.customer_name}</p>
            {ticket.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{ticket.description}</p>
            )}
            <p className="text-xs text-gray-400 mt-2">{formatDate(ticket.received_at)}</p>
          </div>
        )}
      </Draggable>

      {open && (
        <TicketModal
          ticket={ticket}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onSaved(); }}
        />
      )}
    </>
  );
}
