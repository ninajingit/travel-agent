import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// One row per person who has signed in. clerk_id is the identity; everything
// else is a copy of what Clerk told us at the time.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
