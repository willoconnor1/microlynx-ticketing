'use client';

import { useEffect, useRef } from 'react';
import { Ticket, CreateTicketInput, UpdateTicketInput } from '@/lib/types';
import { TicketForm } from './TicketForm';

interface Props {
  ticket?: Ticket;
  onClose: () => void;
  onSaved: () => void;
}

export function TicketModal({ ticket, onClose, onSaved }: Props) {
  const [loading, setLoading] = [false, (_: boolean) => {}];
  const loadingRef = useRef(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  async function handleSubmit(data: CreateTicketInput | UpdateTicketInput) {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      if (ticket) {
        await fetch(`/api/tickets/${ticket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      onSaved();
      onClose();
    } finally {
      loadingRef.current = false;
    }
  }

  async function handleDelete() {
    if (!ticket) return;
    if (!confirm('Delete this ticket? This cannot be undone.')) return;
    await fetch(`/api/tickets/${ticket.id}`, { method: 'DELETE' });
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {ticket ? 'Edit Ticket' : 'New Ticket'}
          </h2>
          <div className="flex items-center gap-2">
            {ticket && (
              <button
                onClick={handleDelete}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <TicketForm
            initial={ticket}
            onSubmit={handleSubmit}
            onCancel={onClose}
            loading={loadingRef.current}
          />
        </div>
      </div>
    </div>
  );
}
