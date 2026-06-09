'use client';

import { useState, useRef } from 'react';
import { Ticket } from '@/lib/types';
import { PriorityBadge } from '@/components/tickets/PriorityBadge';
import { StatusBadge } from '@/components/tickets/StatusBadge';
import { TicketModal } from '@/components/tickets/TicketModal';

interface Props {
  rank: number;
  ticket: Ticket;
  index: number;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  onSaved: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function LeaderboardRow({ rank, ticket, index, isDragging, isOver, onDragStart, onDragOver, onDrop, onDragEnd, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const dragged = useRef(false);

  return (
    <>
      <tr
        draggable
        onDragStart={(e) => { e.stopPropagation(); dragged.current = true; onDragStart(index); }}
        onDragOver={(e) => { e.preventDefault(); onDragOver(index); }}
        onDrop={(e) => { e.preventDefault(); onDrop(index); }}
        onDragEnd={() => { onDragEnd(); setTimeout(() => { dragged.current = false; }, 0); }}
        onClick={() => { if (dragged.current) return; setOpen(true); }}
        className={[
          'cursor-pointer transition-colors border-b border-gray-100 last:border-0',
          isDragging ? 'opacity-40 bg-gray-50' : '',
          isOver && !isDragging ? 'border-t-2 border-t-blue-400 bg-blue-50' : '',
          !isDragging && !isOver ? 'hover:bg-blue-50' : '',
        ].filter(Boolean).join(' ')}
      >
        <td
          className="px-2 py-3 w-8"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing text-xl select-none leading-none">
            ⠿
          </span>
        </td>
        <td className="px-4 py-3 text-sm font-bold text-gray-400 w-10">{rank}</td>
        <td className="px-4 py-3 w-12">
          <PriorityBadge priority={ticket.priority} />
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{ticket.customer_name}</td>
        <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">
          {formatDate(ticket.received_at)}
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <StatusBadge status={ticket.status} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs hidden lg:table-cell">
          <span className="line-clamp-1">{ticket.description || '—'}</span>
        </td>
        <td className="px-4 py-3 text-center text-gray-400 hidden sm:table-cell">
          {ticket.has_charger ? (
            <span title="Has charger" className="text-green-500">⚡</span>
          ) : (
            <span title="No charger" className="text-gray-300">⚡</span>
          )}
        </td>
      </tr>

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
