# Microlynx Ticketing

Repair ticketing for **Microlynx**, a computer/tech repair shop in Gig Harbor, WA.
Tickets are ranked by urgency (1 = most urgent ... 5 = least), oldest-first within each level.

## Views
- **List** — the primary screen; everything sorted by the ranking rule.
- **Urgency Board** — columns 1-5; drag a card to change its urgency.
- **Status Board** — To Do / In Progress / Complete / Picked Up; drag to move a device along.
- **Archive** — picked-up tickets auto-move here after 3 days; permanent and searchable.

## Stack
Next.js (App Router) + TypeScript, plain CSS design system, lucide-react icons,
native HTML5 drag & drop, Neon Postgres + Drizzle ORM, Server Actions, Vercel Cron, on Vercel.

## Develop
```bash
npm install
npm run dev        # http://localhost:3000  (uses an in-memory fallback if no DATABASE_URL)
```

## Database
Set `DATABASE_URL` (Neon Postgres) in `.env` or via the Vercel integration, then:
```bash
npm run db:push    # create the tables; the app seeds sample tickets on first load
```

See `CLAUDE.md` for the ranking rules and where things live.
