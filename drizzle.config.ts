import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Vercel pulls env vars into .env.local; fall back to .env for other setups.
config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
