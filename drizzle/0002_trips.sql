CREATE TYPE "public"."segment_kind" AS ENUM('flight', 'hotel', 'train');--> statement-breakpoint
CREATE TYPE "public"."segment_status" AS ENUM('scheduled', 'delayed', 'rebooked', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('planned', 'booked', 'in_progress', 'complete', 'cancelled');--> statement-breakpoint
CREATE TABLE "trip_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"kind" "segment_kind" NOT NULL,
	"carrier" text NOT NULL,
	"ref" text NOT NULL,
	"depart_at" timestamp with time zone NOT NULL,
	"arrive_at" timestamp with time zone NOT NULL,
	"status" "segment_status" DEFAULT 'scheduled' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"destination_id" integer NOT NULL,
	"status" "trip_status" DEFAULT 'planned' NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_segments" ADD CONSTRAINT "trip_segments_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE no action ON UPDATE no action;