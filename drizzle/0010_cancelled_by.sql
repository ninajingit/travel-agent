CREATE TYPE "public"."cancelled_by" AS ENUM('traveller', 'mira');--> statement-breakpoint
ALTER TABLE "agent_transactions" ADD COLUMN "cancelled_by" "cancelled_by";