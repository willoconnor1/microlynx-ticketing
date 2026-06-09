# Repair Shop Ticketing System

Track incoming computer repairs with a priority leaderboard and kanban board.

## How to deploy (one-time setup)

### 1. Push to GitHub
Create a new GitHub repository and push this folder to it.

### 2. Deploy on Vercel
1. Go to vercel.com → New Project → import your GitHub repo
2. Click **Deploy** (no settings to change — Vercel detects Next.js automatically)

### 3. Add a database
1. In your Vercel project, go to **Storage** → **Create Database** → **Postgres**
2. Follow the prompts (free tier is fine)
3. After creation, go to the database → **.env.local** tab
4. Click **Copy Snippet** — paste those variables into a new file called `.env.local` in this folder (for local dev)
5. Vercel automatically injects these into your deployed app — no extra steps

### 4. That's it
Open your Vercel URL from any device in the shop. The database is created automatically on the first page load.

---

## Running locally (for development)

```bash
# 1. Copy env template and fill in your Postgres credentials
cp .env.local.example .env.local

# 2. Install dependencies
npm install

# 3. Start dev server
npm run dev
```

Open http://localhost:3000

---

## Using the app

- **+ New Ticket** — create a ticket when a computer comes in
- **Leaderboard** — ranked list: Priority 1 at the top, oldest first within each priority
- **Kanban** — drag cards between columns to update repair status
- Click any ticket to edit it or change its priority/status

## Ticket fields
| Field | Description |
|---|---|
| Customer Name | Who dropped it off |
| Date Received | When it came in (defaults to now) |
| Priority 1–5 | 1 = most urgent, 5 = least urgent |
| Has Charger | Whether the charger was included |
| Password | Computer login password (stored privately) |
| Description | What's wrong |
| Status | Which kanban column it's in |
| Technician Notes | Internal notes for the repair team |
