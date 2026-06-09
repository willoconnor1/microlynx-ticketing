import { getLeaderboardTickets } from '@/lib/tickets';
import { migrate } from '@/lib/db';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  await migrate();
  const tickets = await getLeaderboardTickets();

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {tickets.length} open {tickets.length === 1 ? 'ticket' : 'tickets'} · sorted by priority, then oldest first
          </p>
        </div>
      </div>
      <LeaderboardTable initialTickets={tickets} />
    </div>
  );
}
