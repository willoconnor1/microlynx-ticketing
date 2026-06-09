'use client';

const colors: Record<number, string> = {
  1: 'bg-red-500 text-white',
  2: 'bg-orange-400 text-white',
  3: 'bg-yellow-400 text-black',
  4: 'bg-blue-400 text-white',
  5: 'bg-gray-300 text-gray-700',
};

export function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${colors[priority] ?? colors[3]}`}
    >
      {priority}
    </span>
  );
}
