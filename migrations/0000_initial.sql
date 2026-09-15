CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"event_data" jsonb,
	"visitor_id" text NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"winner" text,
	"peak" integer,
	"color" text NOT NULL,
	"is_active" boolean DEFAULT false,
	"draws" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jackpot_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"estimated" integer NOT NULL,
	"cash_value" text NOT NULL,
	"next_draw" text NOT NULL,
	"next_draw_time" text NOT NULL,
	"last_draw" text NOT NULL,
	"winning_numbers" jsonb NOT NULL,
	"powerball" integer NOT NULL,
	"winner" text NOT NULL,
	"cycle_start" text NOT NULL,
	"draws_without_winner" integer NOT NULL,
	"jackpot_growth" integer NOT NULL,
	"moon_price_at_reset" integer NOT NULL,
	"verification_status" text DEFAULT 'unconfirmed',
	"verified_at" timestamp,
	"verification_sources" jsonb
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"visitor_id" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entries_email_unique" UNIQUE("email")
);
