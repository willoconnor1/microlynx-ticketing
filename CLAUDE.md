# Microlynx Ticketing System

Internal ticketing app for **Microlynx**, a computer/tech repair shop in Gig Harbor, WA.
Users: **Garrett** (owner), **Marisa** (owner), **Keith** (tech). No login — a private shared
URL hosted on Vercel.

## What it does
Tracks repair tickets ranked by urgency (1 = most urgent ... 5 = least), oldest-first within
each level. Three views over the same data:
- **List** (primary, default screen) — To Do + In Progress, plus a Completed section
- **Waiting on Parts** — tickets with status `parts`, parked until parts arrive
- **Archive** — picked-up tickets land here the MOMENT they're marked picked up

(The old Urgency/Status kanban boards were removed June 2026 — Garrett didn't use them.
Status changes happen via the status pill or the quick menu in the List.)

The Archive shows the last 7 days by default; older records are kept forever and surface
when searching. A small restore button on each archive row sends a mis-clicked ticket back
to Completed.

## The ranking rule (do not break this)
- Default order: **urgency ASC, then `sortPos` ASC**. `sortPos` is assigned automatically
  from the due date & time (soonest due first, no due date last) whenever a ticket is
  created or its urgency/due date changes; dragging a row in the List overrides it manually
  and the override persists until urgency or due date changes again.
- A level-N ticket never sorts above any level-(N-1) ticket.
- The **List** shows To Do + In Progress grouped by urgency, then a **Completed** section
  (entry order) with a Picked Up button. Drag rows by the grip to reorder; moving a ticket
  ahead of sooner-due tickets asks for confirmation.
- The **Completed** section and the **Waiting on Parts** tab order by `statusChangedAt`
  (the moment they entered that status), NOT urgency.
- **Waiting on parts** (`status = "parts"`): the ticket leaves the List and the active counts
  and parks in its own tab (badge on the tab shows the shop-wide count). It is NEVER
  auto-archived. Setting any other status returns it to its old slot in the queue
  (`sortPos` is kept; it re-slots only when urgency or due date changes).
- Archive: `status = "picked"` sets `archived` immediately (store handles it); the daily
  cron sweep is just a backstop. Archive view = last 7 days; search = all records.

## Ticket fields
`date` (drop-off), `dropoffAmPm` (morning/afternoon drop-off), `dueAt` (optional half-day
pickup window — stored as a timestamp where AM = 11:00 and PM = 17:00 Pacific; no exact
times in the UI), `sortPos` (queue position), `assignedTo` (ARRAY of one or more of
keith | garrett | marisa, default [keith] — `assignees()` in lib/tickets.ts is the single
source of the default rule; the DB column is Postgres `text[]`), `deviceType` ("desktop" | "laptop" | "printer" | "misc" | null — desktops
get a cool blue-white background tint), `serviceTag` ("expedite" | "contract" | null —
mutually exclusive, purely visual chip, does NOT affect sorting), `name`, `description`,
`urgency` (1-5), `phone`, `hasCharger` (bool), `status` (todo | prog | resp | parts | done |
picked — `resp` = "Awaiting response", behaves like `prog`: stays in the List, counts as
active), `createdAt`, `statusChangedAt`, `archived`.

## List rows are accordions
Clicking a queue row expands it inline (one at a time); the expansion edits every field —
buttons save instantly via `patchTicketAction`, text saves on blur and on collapse. The
collapsed row shows name/desc, both dates, phone, status, and actions; charger + assignee
live in the expansion. Rows collapse automatically when a drag starts.

## Person filter
All | Keith | Garrett | Marisa tabs filter every view. A multi-assigned ticket shows under
EACH of its people's tabs. Manual drag-reordering is disabled while a person filter or
search is active (hidden rows would get jumped silently and the sooner-due confirmation
can't see them).

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
- `app/api/cron/archive` — daily archive sweep, now a backstop only (also runs on every read).

## Conventions
- The ranking/sorting rules live in `lib/tickets.ts`; all reads/writes go through `lib/store.ts`.
- Changing a ticket's status MUST update `statusChangedAt` (store handles this).
- Run the DB setup with `npm run db:push` after `DATABASE_URL` is set.

## Workflow note
The visual frontend is built in **Claude design** (claude.ai) and exported as a ZIP, then wired
into this app. The design defines look & feel; the app provides data, drag-and-drop persistence,
and deployment.

## For Will (non-technical owner of this project)
Explain changes in plain English first, then show the diff. Define any technical term the first
time it's used. Pacific timezone.
