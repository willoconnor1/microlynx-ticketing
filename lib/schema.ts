import { pgTable, text, integer, boolean, timestamp, serial, doublePrecision } from "drizzle-orm/pg-core";

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(), // e.g. MLX-4821
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  desc: text("description").notNull(),
  urgency: integer("urgency").notNull().default(3),
  charger: boolean("charger").notNull().default(false),
  status: text("status").notNull().default("todo"), // todo | prog | done | picked
  dropoff: text("dropoff").notNull(), // YYYY-MM-DD
  dropoffAmPm: text("dropoff_ampm"), // "AM" | "PM" — morning vs afternoon drop-off
  dueAt: timestamp("due_at", { withTimezone: true }), // optional promised-by date & time
  sortPos: doublePrecision("sort_pos"), // position within the urgency group; auto-assigned from dueAt, overridden by manual drags
  pickedAt: text("picked_at"), // YYYY-MM-DD, set when status = picked
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  archived: boolean("archived").notNull().default(false),
  archivedAt: text("archived_at"), // YYYY-MM-DD, set when archived
});

// Counter used to generate sequential ticket ids (MLX-####).
export const counters = pgTable("counters", {
  id: serial("id").primaryKey(),
  nextTicketNo: integer("next_ticket_no").notNull().default(5210),
});

export type TicketRow = typeof tickets.$inferSelect;
