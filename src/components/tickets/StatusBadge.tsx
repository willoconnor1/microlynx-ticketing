'use client';

import { STATUSES, TicketStatus } from '@/lib/types';

const colors: Record<TicketStatus, string> = {
  intake: 'bg-gray-100 text-gray-700',
  diagnosing: 'bg-yellow-100 text-yellow-800',
  in_repair: 'bg-blue-100 text-blue-800',
  ready_pickup: 'bg-green-100 text-green-800',
  completed: 'bg-gray-200 text-gray-500',
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const label = STATUSES.find((s) => s.key === status)?.label ?? status;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {label}
    </span>
  );
}
