'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { TicketModal } from './tickets/TicketModal';

export function Nav() {
  const path = usePathname();
  const [showModal, setShowModal] = useState(false);

  function refresh() {
    window.location.reload();
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-gray-900">🔧 Repair Shop</span>
            <div className="flex gap-1">
              <Link
                href="/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  path === '/leaderboard'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Leaderboard
              </Link>
              <Link
                href="/kanban"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  path === '/kanban'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Kanban
              </Link>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + New Ticket
          </button>
        </div>
      </nav>

      {showModal && (
        <TicketModal
          onClose={() => setShowModal(false)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
