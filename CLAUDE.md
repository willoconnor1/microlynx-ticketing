# Microlynx Ticketing System

Internal ticketing app for **Microlynx**, a computer/tech repair shop in Gig Harbor, WA.
Users: **Garrett** (owner), **Marisa** (owner), **Keith** (tech). No login — a private shared
URL hosted on Vercel.

## What it does
Tracks repair tickets ranked by urgency (1 = most urgent ... 5 = least), oldest-first within
each level. Three views over the same data:
- **List** (primary, default screen)
- **Urgency Kanban** — columns 1-5; drag to re-rank a device
- **Status Kanban** — To Do / In Progress / Complete / Picked Up; drag to move through the flow

Picked Up tickets auto-archive after 3 days into a permanent, searchable **Archive**.

## The ranking rule (do not break this)
- Default order: **urgency ASC, then `sortPos` ASC**. `sortPos` is assigned automatically
  from the due date & time (soonest due first, no due date last) whenever a ticket is
  created or its urgency/due date changes; dragging a row in the List overrides it manually
  and the override persists until urgency or due date changes again.
- A level-N ticket never sorts above any level-(N-1) ticket.
- The **List** shows To Do + In Progress grouped by urgency, then a **Completed** section
  (entry order) with a Picked Up button. Drag rows by the grip to reorder; moving a ticket
  ahead of sooner-due tickets asks for confirmation.
- **To Do** and **In Progress** columns use the default order.
- **Complete** and **Picked Up** columns order by `statusChangedAt` (the moment they entered
  that column), NOT urgency.
- The Urgency board shows active tickets only (To Do, In Progress, Complete); Picked Up devices
  drop off it.
- Auto-archive: `status = picked_up` AND in that status for more than 3 days.

## Ticket fields
`date` (drop-off), `dropoffAmPm` (morning/afternoon drop-off), `dueAt` (optional due date &
time), `sortPos` (queue position), `assignedTo` (keith | garrett | marisa, default keith),
`name`, `description`, `urgency` (1-5), `phone`, `hasCharger` (bool), `status`, `createdAt`,
`statusChangedAt`, `archived`.

## Person filter
All | Keith | Garrett | Marisa tabs filter every view. Manual drag-reordering is disabled
while a person filter or search is active (hidden rows would get jumped silently and the
sooner-due confirmation can't see them).

## UI conventions
- Will says "native UI" to mean **app-styled** (matching this design system), not browser/OS
  controls. Date, time, and status pickers are custom popovers (`Pop`/`CalendarPop`/`TimePop`/
  `StatusPillMenu` in `app/_client/ui.tsx`) — never bare `<select>` or `<input type="date">`.

## Stack
Next.js App Router + TypeScript, plain CSS design system (from Claude design, in
`app/globals.css`), lucide-react icons, native HTML5 drag & drop, Neon Postgres + Drizzle ORM,
Next.js Server Actions, Vercel Cron, deployed on Vercel. Build uses `--webpack` (this dev
machine is Intel/x64 where Turbopack native bindings are unavailable).

## Where things live
- `lib/tickets.ts` — shared types, constants, sorting rules (the ranking rule).
- `lib/store.ts` — the data layer: Neon Postgres when `DATABASE_URL` (or `POSTGRES_URL`) is set,
  otherwise an in-memory fallback so it runs locally before the DB exists. Reads AND writes.
- `lib/actions.ts` — `"use server"` actions the client calls (fetch/save/urgency/status/sweep).
- `lib/schema.ts` — Drizzle table. `app/_client/*` — ported UI (client components).
- `app/api/cron/archive` — daily auto-archive sweep (also runs on every read).

## Conventions
- The ranking/sorting rules live in `lib/tickets.ts`; all reads/writes go through `lib/store.ts`.
- Changing a ticket's status MUST update `statusChangedAt` (store handles this).
- The two boards mutate the SAME tickets — never duplicate ticket state.
- Run the DB setup with `npm run db:push` after `DATABASE_URL` is set.

## Workflow note
The visual frontend is built in **Claude design** (claude.ai) and exported as a ZIP, then wired
into this app. The design defines look & feel; the app provides data, drag-and-drop persistence,
and deployment.

## For Will (non-technical owner of this project)
Explain changes in plain English first, then show the diff. Define any technical term the first
time it's used. Pacific timezone.
