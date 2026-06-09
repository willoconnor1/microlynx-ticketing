'use client';

import { useState, useCallback } from 'react';
import { Ticket } from '@/lib/types';
import { LeaderboardRow } from './LeaderboardRow';

interface Props {
  initialTickets: Ticket[];
}

const ORDER_KEY = 'leaderboard-order';

function applyStoredOrder(tickets: Ticket[]): Ticket[] {
  if (typeof window === 'undefined') return tickets;
  try {
    const stored = localStorage.getItem(ORDER_KEY);
    if (!stored) return tickets;
    const ids: string[] = JSON.parse(stored);
    const map = new Map(tickets.map(t => [String(t.id), t]));
    const ordered: Ticket[] = [];
    for (const id of ids) {
      if (map.has(id)) ordered.push(map.get(id)!);
    }
    for (const t of tickets) {
      if (!ids.includes(String(t.id))) ordered.push(t);
    }
    return ordered;
  } catch {
    return tickets;
  }
}

function saveOrder(tickets: Ticket[]) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(tickets.map(t => String(t.id))));
  } catch {}
}

export function LeaderboardTable({ initialTickets }: Props) {
  const [tickets, setTickets] = useState(() => applyStoredOrder(initialTickets));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/tickets?view=leaderboard');
    const data = await res.json();
    setTickets(applyStoredOrder(data.tickets));
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((index: number) => {
    setOverIndex(index);
  }, []);

  const handleDrop = useCallback((dropIndex: number) => {
    setDragIndex(prev => {
      if (prev === null || prev === dropIndex) {
        setOverIndex(null);
        return null;
      }
      setTickets(ts => {
        const next = [...ts];
        const [moved] = next.splice(prev, 1);
        next.splice(dropIndex, 0, moved);
        saveOrder(next);
        return next;
      });
      setOverIndex(null);
      return null;
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  if (tickets.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-4xl mb-3">🎉</p>
        <p className="font-medium">No open tickets — all clear!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            <th className="px-2 py-3 w-8" />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-10">#</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">P</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Received</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Issue</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">⚡</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket, i) => (
            <LeaderboardRow
              key={ticket.id}
              rank={i + 1}
              ticket={ticket}
              index={i}
              isDragging={dragIndex === i}
              isOver={overIndex === i}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              onSaved={refresh}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
