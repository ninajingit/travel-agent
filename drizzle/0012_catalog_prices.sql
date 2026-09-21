CREATE TABLE "catalog_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"lookup_key" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"product_name" text NOT NULL,
	"unit_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"interval" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_prices_lookup_key_unique" UNIQUE("lookup_key")
);
