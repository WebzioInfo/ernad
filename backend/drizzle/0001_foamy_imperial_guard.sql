ALTER TABLE "operator_sessions" ADD COLUMN "last_activity" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "operator_sessions" DROP COLUMN "last_activity_at";