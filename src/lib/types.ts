export type TicketStatus =
  | 'intake'
  | 'diagnosing'
  | 'in_repair'
  | 'ready_pickup'
  | 'completed';

export const STATUSES: { key: TicketStatus; label: string }[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'diagnosing', label: 'Diagnosing' },
  { key: 'in_repair', label: 'In Repair' },
  { key: 'ready_pickup', label: 'Ready for Pickup' },
  { key: 'completed', label: 'Completed' },
];

export interface Ticket {
  id: number;
  customer_name: string;
  received_at: string;
  has_charger: boolean;
  password: string;
  description: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: TicketStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTicketInput {
  customer_name: string;
  received_at?: string;
  has_charger: boolean;
  password?: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface UpdateTicketInput {
  customer_name?: string;
  received_at?: string;
  has_charger?: boolean;
  password?: string;
  description?: string;
  priority?: 1 | 2 | 3 | 4 | 5;
  status?: TicketStatus;
  notes?: string;
}
