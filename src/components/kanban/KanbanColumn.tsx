'use client';

import { Droppable } from '@hello-pangea/dnd';
import { Ticket, TicketStatus } from '@/lib/types';
import { KanbanCard } from './KanbanCard';

const columnColors: Record<TicketStatus, string> = {
  intake: 'bg-gray-100 text-gray-600',
  diagnosing: 'bg-yellow-100 text-yellow-700',
  in_repair: 'bg-blue-100 text-blue-700',
  ready_pickup: 'bg-green-100 text-green-700',
  completed: 'bg-gray-200 text-gray-500',
};

interface Props {
  status: TicketStatus;
  label: string;
  tickets: Ticket[];
  onSaved: () => void;
}

export function KanbanColumn({ status, label, tickets, onSaved }: Props) {
  return (
    <div className="flex flex-col min-w-[220px] w-full max-w-xs flex-shrink-0">
      <div className={`flex items-center justify-between px-3 py-2 rounded-xl mb-2 ${columnColors[status]}`}>
        <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
        <span className="text-xs font-semibold bg-white/60 rounded-full px-1.5 py-0.5">
          {tickets.length}
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-col gap-2 min-h-[80px] rounded-xl p-2 transition-colors flex-1 ${
              snapshot.isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-gray-50/50'
            }`}
          >
            {tickets.map((ticket, index) => (
              <KanbanCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                onSaved={onSaved}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
