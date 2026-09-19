CREATE TYPE "public"."channel_kind" AS ENUM('web', 'whatsapp', 'imessage');--> statement-breakpoint
CREATE TABLE "agent_settings" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"auto_rebook" boolean DEFAULT false NOT NULL,
	"per_booking_cap_cents" integer DEFAULT 50000 NOT NULL,
	"monthly_cap_cents" integer DEFAULT 200000 NOT NULL,
	"allowed_channels" "channel_kind"[] DEFAULT '{"web"}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_settings" ADD CONSTRAINT "agent_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;