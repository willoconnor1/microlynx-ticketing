import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Accept the common env var names injected by the Neon / Postgres Vercel integrations.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_PRISMA_URL ||
  "";

export const hasDb = !!connectionString;

// Only construct the client when a connection string exists. Local dev without a
// database falls back to the in-memory store (see lib/store.ts).
export const db = hasDb
  ? drizzle(neon(connectionString), { schema })
  : (null as unknown as ReturnType<typeof drizzle>);
