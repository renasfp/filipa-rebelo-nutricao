CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrium_sync" (
	"uid" text PRIMARY KEY NOT NULL,
	"nutrium_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"version" text NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"mode" text NOT NULL,
	"uid" text NOT NULL,
	"start" text NOT NULL,
	"telefone" text NOT NULL,
	"ok" boolean NOT NULL,
	"error" text,
	"texto" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trigger_event" text NOT NULL,
	"uid" text,
	"status" text,
	"start_time" text,
	"reschedule_uid" text,
	"duplicate" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reminder_log_at_idx" ON "reminder_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "webhook_events_received_idx" ON "webhook_events" USING btree ("received_at");