import { getKanbanTickets } from '@/lib/tickets';
import { migrate } from '@/lib/db';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';

export const dynamic = 'force-dynamic';

export default async function KanbanPage() {
  await migrate();
  const tickets = await getKanbanTickets();

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
        <p className="text-sm text-gray-500 mt-0.5">Drag cards between columns to update status</p>
      </div>
      <KanbanBoard initialTickets={tickets} />
    </div>
  );
}
