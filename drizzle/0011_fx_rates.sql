CREATE TABLE "fx_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"base_rate" numeric(20, 10) NOT NULL,
	"quoted_rate" numeric(20, 10) NOT NULL,
	"stripe_fx_quote_id" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_currency_key" ON "fx_rates" USING btree ("currency");