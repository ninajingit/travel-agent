import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Run `vercel env pull .env.local`.");
}

// HTTP driver: one round trip per query, no connection to keep alive. Right
// fit for serverless functions and plenty for this app.
export const db = drizzle(neon(process.env.DATABASE_URL), { schema });
