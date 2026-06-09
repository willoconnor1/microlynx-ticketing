'use client';

import { Ticket, CreateTicketInput, UpdateTicketInput, STATUSES, TicketStatus } from '@/lib/types';

type FormData = {
  customer_name: string;
  received_at: string;
  has_charger: boolean;
  password: string;
  description: string;
  priority: number;
  status: TicketStatus;
  notes: string;
};

interface Props {
  initial?: Ticket;
  onSubmit: (data: CreateTicketInput | UpdateTicketInput) => void;
  onCancel: () => void;
  loading?: boolean;
}

function toDateInputValue(iso: string) {
  return iso.slice(0, 16);
}

function toIso(local: string) {
  return new Date(local).toISOString();
}

export function TicketForm({ initial, onSubmit, onCancel, loading }: Props) {
  const now = new Date().toISOString();
  const defaults: FormData = {
    customer_name: initial?.customer_name ?? '',
    received_at: toDateInputValue(initial?.received_at ?? now),
    has_charger: initial?.has_charger ?? false,
    password: initial?.password ?? '',
    description: initial?.description ?? '',
    priority: initial?.priority ?? 3,
    status: initial?.status ?? 'intake',
    notes: initial?.notes ?? '',
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      customer_name: (fd.get('customer_name') as string).trim(),
      received_at: toIso(fd.get('received_at') as string),
      has_charger: fd.get('has_charger') === 'true',
      password: fd.get('password') as string,
      description: fd.get('description') as string,
      priority: Number(fd.get('priority')) as 1 | 2 | 3 | 4 | 5,
      status: fd.get('status') as TicketStatus,
      notes: fd.get('notes') as string,
    });
  }

  const priorityStyles: Record<number, string> = {
    1: 'peer-checked:bg-red-500 peer-checked:text-white peer-checked:border-red-500',
    2: 'peer-checked:bg-orange-400 peer-checked:text-white peer-checked:border-orange-400',
    3: 'peer-checked:bg-yellow-400 peer-checked:text-black peer-checked:border-yellow-400',
    4: 'peer-checked:bg-blue-400 peer-checked:text-white peer-checked:border-blue-400',
    5: 'peer-checked:bg-gray-300 peer-checked:text-gray-700 peer-checked:border-gray-300',
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Customer name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          name="customer_name"
          required
          defaultValue={defaults.customer_name}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g. John Smith"
        />
      </div>

      {/* Date received */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date Received
        </label>
        <input
          type="datetime-local"
          name="received_at"
          defaultValue={defaults.received_at}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Priority
        </label>
        <div className="flex gap-2" role="group">
          {([1, 2, 3, 4, 5] as const).map((p) => (
            <label key={p} className="flex-1">
              <input
                type="radio"
                name="priority"
                value={p}
                defaultChecked={defaults.priority === p}
                className="sr-only peer"
              />
              <span className={`block text-center border-2 rounded-lg py-1.5 text-sm font-bold cursor-pointer transition-colors border-gray-200 text-gray-500 ${priorityStyles[p]}`}>
                {p}
              </span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-1">1 = most urgent · 5 = least urgent</p>
      </div>

      {/* Has charger */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Charger Included?
        </label>
        <div className="flex gap-2">
          {[{ val: 'true', label: 'Yes' }, { val: 'false', label: 'No' }].map(({ val, label }) => (
            <label key={val} className="flex-1">
              <input
                type="radio"
                name="has_charger"
                value={val}
                defaultChecked={String(defaults.has_charger) === val}
                className="sr-only peer"
              />
              <span className="block text-center border-2 border-gray-200 rounded-lg py-1.5 text-sm font-medium cursor-pointer transition-colors text-gray-500 peer-checked:bg-blue-500 peer-checked:text-white peer-checked:border-blue-500">
                {label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Computer Password
        </label>
        <input
          name="password"
          defaultValue={defaults.password}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Leave blank if none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Issue Description
        </label>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaults.description}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="What's wrong with the computer?"
        />
      </div>

      {/* Status (only show when editing) */}
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            name="status"
            defaultValue={defaults.status}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {STATUSES.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      )}
      {!initial && <input type="hidden" name="status" value="intake" />}

      {/* Technician notes (only on edit) */}
      {initial && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Technician Notes
          </label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={defaults.notes}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Internal notes for techs"
          />
        </div>
      )}
      {!initial && <input type="hidden" name="notes" value="" />}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Saving...' : initial ? 'Save Changes' : 'Create Ticket'}
        </button>
      </div>
    </form>
  );
}
